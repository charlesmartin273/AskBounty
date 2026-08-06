// Phase 2 AUDIT evidence: drives the full ask/fund wizard through the REAL
// API routes (dev server on :3000) with the REAL asker throwaway wallet on
// Arc Testnet, then runs 5 edge cases. Simulates exactly what the browser
// wizard does, including an interrupted-and-resumed flow.
// Run: npx tsx scripts/e2e-phase2-wizard.ts
import { ensureWalletKey } from "./dry-run-wallet-setup";
import { createPublicClient, createWalletClient, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../lib/chain/config";
import { arcTransport } from "../lib/chain/rpc-transport";
import { createJob, approveAndFund, type Signer } from "../lib/escrow/escrow-writes";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const results: string[] = [];
const record = (name: string, pass: boolean, detail: string) => {
  results.push(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
  console.log(results[results.length - 1]);
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function createDraft(asker: Signer, budget: string, deadlineMs: number) {
  return api("POST", "/api/questions", {
    askerAddress: asker.account.address,
    title: "E2E: paginate getLogs on Arc",
    body: "How to page getLogs when range exceeds RPC limits? Needs chunking + retry.",
    budget,
    deadline: new Date(deadlineMs).toISOString(),
    criteria: { minWords: 10, mustIncludeCode: true, codeLanguage: "typescript", topics: ["chunked ranges"] },
  });
}

async function main() {
  const publicClient = createPublicClient({ chain: arcTestnet, transport: arcTransport() }) as PublicClient;
  const asker = createWalletClient({
    account: privateKeyToAccount(ensureWalletKey("DRYRUN_ASKER_PRIVATE_KEY")),
    chain: arcTestnet,
    transport: arcTransport(),
  }) as Signer;
  const askerCtx = { wallet: asker, publicClient };

  // ---- Happy path (wizard steps 1-3 with a simulated interruption) ----
  const created = await createDraft(asker, "1", Date.now() + 3600_000);
  if (created.status !== 200) throw new Error(`create failed: ${JSON.stringify(created.data)}`);
  const { questionId, agentAddress, netPayout, deadlineUnix } = created.data;
  console.log(`[draft] ${questionId} netPayout=${netPayout}`);

  // step 1 - asker creates job (same call the browser wizard makes)
  const { hash: createTx, jobId } = await createJob(askerCtx, {
    provider: agentAddress, evaluator: agentAddress,
    expiredAt: BigInt(deadlineUnix), description: questionId,
  });
  const job = await api("POST", `/api/questions/${questionId}/job`, { jobId: jobId.toString(), createTx });
  record("step1 record jobId", job.status === 200, `job ${jobId} tx=${createTx}`);

  // simulated interruption: "reopen tab" → wizard state must resume at step 2
  const resume1 = await api("GET", `/api/questions/${questionId}`);
  record("resume after step 1 -> step 2", resume1.data.wizard?.step === 2, `wizard=${JSON.stringify(resume1.data.wizard)}`);

  // EDGE 1: finalize BEFORE funding must be rejected (live guard)
  const early = await api("POST", `/api/questions/${questionId}/finalize`, {});
  record("EDGE finalize before fund rejected", early.status === 409, `${early.status} ${early.data.error ?? ""}`);

  await pause(1500);
  // step 2 - backend setBudget
  const sb1 = await api("POST", `/api/questions/${questionId}/set-budget`);
  record("step2 setBudget", sb1.status === 200, JSON.stringify(sb1.data));
  // EDGE 2: set-budget retry is idempotent (no second tx)
  const sb2 = await api("POST", `/api/questions/${questionId}/set-budget`);
  record("EDGE setBudget idempotent", sb2.status === 200 && sb2.data.already === true, JSON.stringify(sb2.data));

  const resume2 = await api("GET", `/api/questions/${questionId}`);
  record("resume after step 2 -> step 3", resume2.data.wizard?.step === 3, `wizard=${JSON.stringify(resume2.data.wizard)}`);

  await pause(1500);
  // step 3 - asker approve + fund, then finalize
  const { fundHash } = await approveAndFund(askerCtx, jobId, 1_000_000n);
  const fin = await api("POST", `/api/questions/${questionId}/finalize`, { fundTx: fundHash });
  record("step3 finalize after fund", fin.status === 200, `fund tx=${fundHash}`);

  const done = await api("GET", `/api/questions/${questionId}`);
  record(
    "question open with locked snapshot",
    done.data.question?.status === "open" &&
      done.data.question?.netPayout === "1" &&
      done.data.question?.fundTx === fundHash,
    `status=${done.data.question?.status} net=${done.data.question?.netPayout} fees=${done.data.question?.platformFeeBp}/${done.data.question?.evaluatorFeeBp}bp`,
  );

  const html = await fetch(`${BASE}/q/${questionId}`).then((r) => r.text());
  record(
    "public page shows locked net payout",
    html.includes("winner receives") && html.includes("Verify escrow on Arcscan"),
    `/q/${questionId} rendered`,
  );

  // ---- Edge cases on a second, never-funded draft ----
  const draft2 = await createDraft(asker, "1", Date.now() + 3600_000);
  const q2 = draft2.data.questionId as string;

  // EDGE 3: forged jobId (belongs to question 1) must be rejected
  const forged = await api("POST", `/api/questions/${q2}/job`, { jobId: jobId.toString(), createTx });
  record("EDGE forged jobId rejected", forged.status === 400, `${forged.status} ${forged.data.error ?? ""}`);

  // EDGE 4: invalid create payloads rejected
  const past = await createDraft(asker, "1", Date.now() - 1000);
  const zero = await createDraft(asker, "0", Date.now() + 3600_000);
  record("EDGE past deadline / zero budget rejected", past.status === 400 && zero.status === 400,
    `past=${past.status} zero=${zero.status}`);

  // EDGE 6 (review C1): job with an onchain expiry different from the DB
  // deadline must be rejected (early-expiry rug prevention)
  await pause(1500);
  const { jobId: rugJobId, hash: rugTx } = await createJob(askerCtx, {
    provider: draft2.data.agentAddress, evaluator: draft2.data.agentAddress,
    expiredAt: BigInt(draft2.data.deadlineUnix + 9999), description: q2,
  });
  const rug = await api("POST", `/api/questions/${q2}/job`, { jobId: rugJobId.toString(), createTx: rugTx });
  record("EDGE mismatched expiry rejected", rug.status === 400, `${rug.status} ${rug.data.error ?? ""}`);

  // EDGE 5: draft question page must show the not-live notice (live guard UI)
  const draftHtml = await fetch(`${BASE}/q/${q2}`).then((r) => r.text());
  record("EDGE draft page shows not-live notice",
    draftHtml.includes("not live yet") && !draftHtml.includes("winner receives"),
    `/q/${q2} is draft-guarded`);

  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n===== PHASE 2 E2E: ${results.length - failed}/${results.length} PASS =====`);
  console.log(`question: ${BASE}/q/${questionId}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
