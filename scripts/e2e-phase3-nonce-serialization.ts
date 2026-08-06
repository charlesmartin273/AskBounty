// Phase 3 dedicated E2E - H2 agent-wallet nonce serialization: two questions
// accepted near-simultaneously trigger two full payout pipelines (submit +
// complete + forward = 6 agent-wallet txs) through the withAgentWallet queue.
// Without serialization the same key WOULD collide on nonces. PASS = both
// payouts land with distinct txs and zero nonce errors.
// Run: npx tsx scripts/e2e-phase3-nonce-serialization.ts
import {
  api, createOpenQuestion, getAnswer, GOOD_ANSWER, makeSigner, pause,
  preflightAskerBalance, record, resolvePendingEval, submitAnswer, summarize,
} from "./phase3-test-helpers";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 3_000_000n);
  const q1 = await createOpenQuestion(asker, "1", "E2E nonce test question A");
  await pause(2000);
  const q2 = await createOpenQuestion(asker, "1", "E2E nonce test question B");

  console.log("[race] two passing answers on two questions, concurrently…");
  const [r1, r2] = await Promise.all([
    submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", q1.questionId, GOOD_ANSWER),
    submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", q2.questionId, GOOD_ANSWER + "\n\n(question B)"),
  ]);
  record("both submissions reached the API", r1.status === 200 && r2.status === 200,
    `statuses ${r1.status}/${r2.status}`);

  const a1 = await resolvePendingEval(r1.data.answer.id, 8);
  const a2 = await resolvePendingEval(r2.data.answer.id, 8);

  // Resume payouts if either eval retried past the inline payout window.
  for (const a of [a1, a2]) {
    if (a.status === "accepted" && a.payout_status !== "paid") {
      await pause(3000);
      await api("POST", `/api/answers/${a.id}/retry`);
    }
  }
  const f1 = await getAnswer(a1.id);
  const f2 = await getAnswer(a2.id);

  record("H2 both answers accepted + paid (no nonce collision)",
    f1.status === "accepted" && f1.payout_status === "paid" &&
      f2.status === "accepted" && f2.payout_status === "paid",
    `A: ${f1.status}/${f1.payout_status} (${f1.eval_results?.payoutError ?? "ok"}) | B: ${f2.status}/${f2.payout_status} (${f2.eval_results?.payoutError ?? "ok"})`);

  const txs = [f1.complete_tx, f1.forward_tx, f2.complete_tx, f2.forward_tx];
  record("4 distinct agent-wallet txs landed",
    txs.every(Boolean) && new Set(txs).size === 4,
    txs.map((t) => t?.slice(0, 18)).join(", "));

  console.log("\nEvidence - all four agent-wallet txs:");
  console.log(`A complete: https://testnet.arcscan.app/tx/${f1.complete_tx}`);
  console.log(`A forward:  https://testnet.arcscan.app/tx/${f1.forward_tx}`);
  console.log(`B complete: https://testnet.arcscan.app/tx/${f2.complete_tx}`);
  console.log(`B forward:  https://testnet.arcscan.app/tx/${f2.forward_tx}`);
  summarize("PHASE 3 NONCE SERIALIZATION (H2)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
