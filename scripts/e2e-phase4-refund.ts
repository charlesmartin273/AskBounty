// Phase 4 dedicated E2E - CLAIM REFUND, the money path (C2, heaviest tested).
// Real onchain expiry: the create API enforces deadline >= now+10min and
// claimRefund needs block.timestamp > expiredAt, so this script waits the
// window out (~11 min total).
// PRD-ERRATA E6 (live finding): claimRefund is PERMISSIONLESS as to caller -
// the contract ALWAYS pays the job's client (asker). So the C2 assertions
// are: a NON-asker trigger succeeds but the FULL budget lands with the
// ASKER (stronger money-safety proof than a revert); forged record hashes
// are rejected by calldata decoding; a second refund fails everywhere.
// Run: npx tsx scripts/e2e-phase4-refund.ts (dev server + CRON_SECRET)
import { usdcFmt } from "./dry-run-wallet-setup";
import {
  api, BASE, createOpenQuestion, makeSigner, pause, preflightAskerBalance,
  publicClient, record, submitAnswer, summarize, GOOD_ANSWER,
} from "./phase3-test-helpers";
import { JOB_STATUS } from "../lib/chain/abi-agentic-commerce";
import { getJob, getUsdcBalance } from "../lib/escrow/escrow-reads";
import { claimRefund } from "../lib/escrow/escrow-writes";

const DEADLINE_MS = 10 * 60_000 + 20_000; // API minimum (10min) + margin

async function sweep(secret: string) {
  const res = await fetch(`${BASE}/api/cron/sweep`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing in .env.local");
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  const nonAsker = makeSigner("DRYRUN_WINNER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);

  const deadlineAt = Date.now() + DEADLINE_MS;
  const { questionId, jobId, budgetRaw } = await createOpenQuestion(
    asker, "1", "E2E refund: expires in 10 minutes", { deadlineMs: deadlineAt },
  );
  const createTx = (await api("GET", `/api/questions/${questionId}`)).data.question
    ?.createTx as string | undefined;

  // ---- BEFORE expiry: contract + API both refuse ----
  try {
    await claimRefund({ wallet: asker, publicClient }, jobId);
    record("refund BEFORE expiry reverts", false, "unexpectedly succeeded");
  } catch (err) {
    record("refund BEFORE expiry reverts", true,
      `reverted: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
  }
  const early = await api("POST", `/api/questions/${questionId}/refund`, {
    refundTx: "0x" + "ab".repeat(32),
  });
  record("refund API before expiry -> 409", early.status === 409,
    `${early.status} ${early.data.error ?? ""}`);

  // ---- wait out the REAL deadline (onchain expiredAt == DB deadline) ----
  const waitMs = deadlineAt - Date.now() + 30_000; // +30s block-time margin
  console.log(`[wait] ${Math.ceil(waitMs / 1000)}s until the question truly expires…`);
  await pause(waitMs);

  // Cron opens the refund path (C1)
  const swept = await sweep(secret);
  const afterSweep = await api("GET", `/api/questions/${questionId}`);
  record("cron marks the question expired", afterSweep.data.question?.status === "expired",
    `sweep=${JSON.stringify(swept.data)} status=${afterSweep.data.question?.status}`);
  const submitLate = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, GOOD_ANSWER);
  record("submitting to an expired question -> 409", submitLate.status === 409,
    `${submitLate.status} ${submitLate.data.error ?? ""}`);

  // ---- forged records must be rejected by calldata decoding (E6/M1) ----
  if (createTx) {
    const forged1 = await api("POST", `/api/questions/${questionId}/refund`, { refundTx: createTx });
    record("forged record (successful createJob tx) -> 400 (wrong calldata)",
      forged1.status === 400, `${forged1.status} ${forged1.data.error ?? ""}`);
  }
  const forged2 = await api("POST", `/api/questions/${questionId}/refund`, {
    refundTx: "0x" + "11".repeat(32),
  });
  record("forged record (nonexistent tx) -> 400", forged2.status === 400,
    `${forged2.status} ${forged2.data.error ?? ""}`);

  // ---- E6 money-safety core: NON-asker triggers, ASKER gets paid ----
  const before = await getUsdcBalance(publicClient, asker.account.address);
  const refundHash = await claimRefund({ wallet: nonAsker, publicClient }, jobId);
  await pause(2000);
  const after = await getUsdcBalance(publicClient, asker.account.address);
  const delta = after - before;
  record(
    "C2/E6 non-asker trigger succeeds AND the FULL budget lands with the ASKER (exact, gas paid by the trigger caller)",
    delta === budgetRaw,
    `trigger=${nonAsker.account.address.slice(0, 10)} askerDelta=${usdcFmt(delta)} budget=${usdcFmt(budgetRaw)} tx=${refundHash}`,
  );
  const job = await getJob(publicClient, jobId);
  record("job no longer Funded after refund", job.status !== JOB_STATUS.Funded,
    `onchain status=${job.status}`);

  // ---- record + public surfaces ----
  const rec = await api("POST", `/api/questions/${questionId}/refund`, { refundTx: refundHash });
  record("refund recorded -> status refunded", rec.status === 200 && rec.data.status === "refunded",
    `${rec.status} ${JSON.stringify(rec.data)}`);
  const html = await fetch(`${BASE}/q/${questionId}`).then((r) => r.text());
  record("page shows refunded banner + Arcscan link",
    html.includes("Bounty refunded") && html.includes(refundHash), `/q/${questionId}`);
  const browse = await fetch(`${BASE}/browse`).then((r) => r.text());
  record("C3 refunded question absent from browse",
    !browse.includes("E2E refund: expires in 10 minutes"), "/browse");

  // ---- C2: second refund must fail everywhere ----
  try {
    await claimRefund({ wallet: asker, publicClient }, jobId);
    record("C2 second onchain refund reverts (even from the asker)", false, "unexpectedly succeeded");
  } catch (err) {
    record("C2 second onchain refund reverts (even from the asker)", true,
      `reverted: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
  }
  const rec2 = await api("POST", `/api/questions/${questionId}/refund`, { refundTx: refundHash });
  record("C2 second refund record -> 409", rec2.status === 409,
    `${rec2.status} ${rec2.data.error ?? ""}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`refund tx: https://testnet.arcscan.app/tx/${refundHash}`);
  summarize("PHASE 4 CLAIM REFUND (C2/E6)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
