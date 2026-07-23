// Phase 3 PERMANENT regression E2E — time-sensitive evaluation. Found via
// manual testing: the LLM has no clock, so it rejected the CORRECT current
// year using its stale training data ("2026 is incorrect as the current year
// is 2024"). The prompt now injects the server date at call time. This
// script is deliberately YEAR-AGNOSTIC: it computes the current year from
// the system clock at run time (never hardcoded), so it still asserts the
// right thing in 2030 — current year passes, current year + 1 fails.
// Needs: dev server (E2E_BASE_URL), funded asker wallet, valid GEMINI key.
// Run: npx tsx scripts/e2e-phase3-current-year-eval.ts
import {
  api, BASE, createOpenQuestion, getAnswer, makeSigner, pause,
  preflightAskerBalance, record, resolvePendingEval, submitAnswer, summarize,
} from "./phase3-test-helpers";

async function main() {
  const currentYear = new Date().getFullYear(); // system clock, never hardcoded
  const wrongYear = currentYear + 1;

  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const { questionId } = await createOpenQuestion(
    asker, "1", "E2E current-year: what year is it right now?",
    {
      body: "What year are we in right now? Reply with the year number.",
      criteria: { minWords: 1, mustIncludeCode: false, topics: [] },
    },
  );

  // Current year + 1 -> must FAIL on correctness.
  const wrong = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, String(wrongYear));
  if (wrong.status !== 200) throw new Error(`wrong submit failed: ${JSON.stringify(wrong.data)}`);
  const wrongRow = await resolvePendingEval(wrong.data.answer.id, 8);
  const wrongDetail = wrongRow.eval_results?.results?.find((r) => r.check === "topics_covered");
  record(`answer "${wrongYear}" (current year + 1) -> failed`,
    wrongRow.status === "failed" && wrongDetail?.pass === false,
    `status=${wrongRow.status} detail="${wrongDetail?.detail?.slice(0, 160)}"`);

  // Current year -> must PASS (the LLM must trust the injected server date
  // over its own training-data cutoff).
  await pause(2000);
  const right = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, String(currentYear));
  if (right.status !== 200) throw new Error(`right submit failed: ${JSON.stringify(right.data)}`);
  let rightRow = await resolvePendingEval(right.data.answer.id, 8);
  if (rightRow.status === "accepted" && rightRow.payout_status !== "paid") {
    await pause(3000);
    await api("POST", `/api/answers/${rightRow.id}/retry`);
    rightRow = await getAnswer(rightRow.id);
  }
  record(`answer "${currentYear}" (current year from system clock) -> accepted + paid`,
    rightRow.status === "accepted" && rightRow.payout_status === "paid",
    `status=${rightRow.status}/${rightRow.payout_status} complete=${rightRow.complete_tx?.slice(0, 18)} forward=${rightRow.forward_tx?.slice(0, 18)}`);

  const q = await api("GET", `/api/questions/${questionId}`);
  record("question answered", q.data.question?.status === "answered",
    `status=${q.data.question?.status}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`complete tx: https://testnet.arcscan.app/tx/${rightRow.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${rightRow.forward_tx}`);
  summarize("PHASE 3 CURRENT-YEAR EVAL");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
