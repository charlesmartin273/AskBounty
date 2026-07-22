// Phase 3 dedicated E2E — snapshot-vs-released discrepancy (user rule "số
// vào bằng số ra"): if PaymentReleased.amount != the net_payout snapshot, the
// agent must STILL forward the full released amount (retaining nothing), log
// a warning, and the receipt must show BOTH numbers. We cannot change the
// contract's fee BPs (no admin role), so the drift is simulated by tampering
// the DB snapshot before the payout runs — the discrepancy code path is the
// same one a real fee change would hit.
// Run: npx tsx scripts/e2e-phase3-payout-discrepancy.ts
import {
  api, BASE, createOpenQuestion, db, getAnswer, GOOD_ANSWER, makeSigner,
  pause, preflightAskerBalance, publicClient, record, resolvePendingEval,
  submitAnswer, summarize,
} from "./phase3-test-helpers";
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import { getUsdcBalance } from "../lib/escrow/escrow-reads";

const BUDGET_RAW = 1_000_000n; // real escrow releases 1.000000 USDC (BPs=0)
const TAMPERED_SNAPSHOT = "0.75"; // pretend the page promised less

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY"));
  const { questionId } = await createOpenQuestion(asker, "1", "E2E payout discrepancy");

  // Simulate fee drift: snapshot says 0.75, escrow will release 1.000000.
  const { error: tamperErr } = await db()
    .from("questions").update({ net_payout: TAMPERED_SNAPSHOT }).eq("id", questionId);
  if (tamperErr) throw new Error(`tamper failed: ${tamperErr.message}`);
  console.log(`[tamper] net_payout snapshot set to ${TAMPERED_SNAPSHOT} (escrow will release 1.000000)`);

  const balBefore = await getUsdcBalance(publicClient, winner.address);
  const res = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER);
  if (res.status !== 200) throw new Error(`submit failed: ${JSON.stringify(res.data)}`);
  let a = await resolvePendingEval(res.data.answer.id, 8);
  if (a.status === "accepted" && a.payout_status !== "paid") {
    await pause(3000);
    await api("POST", `/api/answers/${a.id}/retry`);
    a = await getAnswer(a.id);
  }
  record("answer accepted + paid despite discrepancy",
    a.status === "accepted" && a.payout_status === "paid",
    `status=${a.status}/${a.payout_status} err=${a.eval_results?.payoutError ?? "none"}`);

  await pause(2000);
  const balAfter = await getUsdcBalance(publicClient, winner.address);
  const delta = balAfter - balBefore;
  record(
    "winner received the FULL released amount (agent retained nothing)",
    delta === BUDGET_RAW,
    `delta=${usdcFmt(delta)} (full release), tampered snapshot promised only ${TAMPERED_SNAPSHOT}`,
  );

  const disc = a.eval_results?.paid?.discrepancy;
  record(
    "discrepancy recorded with BOTH numbers",
    disc?.expectedNet === TAMPERED_SNAPSHOT && disc?.released === "1",
    JSON.stringify(a.eval_results?.paid),
  );

  const html = await fetch(`${BASE}/q/${questionId}`).then((r) => r.text());
  record("receipt page shows the discrepancy line",
    html.includes("Fee change detected"), `/q/${questionId}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`complete tx: https://testnet.arcscan.app/tx/${a.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${a.forward_tx}`);
  summarize("PHASE 3 PAYOUT DISCREPANCY");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
