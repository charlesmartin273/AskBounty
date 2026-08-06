// Phase 3 PERMANENT regression E2E - empty-topics evaluation branch. Found
// via manual testing: with topics=[] the old prompt never showed the LLM the
// question, so terse-but-correct answers ("19" for "what is 9+10") failed as
// "no context". The prompt now embeds the question (own delimiter, context
// only) and judges one "direct_answer" criterion. This script keeps that
// branch from regressing: a WRONG terse answer must fail on correctness, a
// CORRECT terse answer must pass and win the payout.
// Needs: dev server (E2E_BASE_URL), funded asker wallet, valid GEMINI key.
// Run: npx tsx scripts/e2e-phase3-empty-topics-eval.ts
import {
  api, BASE, createOpenQuestion, getAnswer, makeSigner, pause,
  preflightAskerBalance, record, resolvePendingEval, submitAnswer, summarize,
} from "./phase3-test-helpers";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const { questionId } = await createOpenQuestion(
    asker, "1", "E2E empty-topics: what is 9 + 10?",
    {
      body: "What is 9 + 10? Reply with the number.",
      criteria: { minWords: 1, mustIncludeCode: false, topics: [] },
    },
  );

  // WRONG terse answer -> objective checks pass (1/1 words), LLM must fail
  // it on CORRECTNESS (not on "lacks context").
  const wrong = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, "21");
  if (wrong.status !== 200) throw new Error(`wrong submit failed: ${JSON.stringify(wrong.data)}`);
  const wrongRow = await resolvePendingEval(wrong.data.answer.id, 8);
  const wrongTopics = wrongRow.eval_results?.results?.find((r) => r.check === "topics_covered");
  record("wrong terse answer '21' -> failed by the LLM correctness signal",
    wrongRow.status === "failed" && wrongTopics?.pass === false,
    `status=${wrongRow.status} detail="${wrongTopics?.detail?.slice(0, 160)}"`);
  record("objective checks still ran first and passed (LLM was not sole gate)",
    wrongRow.eval_results?.results?.some((r) => r.check === "min_words" && r.pass) === true,
    JSON.stringify(wrongRow.eval_results?.results?.map((r) => `${r.check}:${r.pass}`)));

  // CORRECT terse answer -> must pass and take the bounty.
  await pause(2000);
  const right = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, "19");
  if (right.status !== 200) throw new Error(`right submit failed: ${JSON.stringify(right.data)}`);
  let rightRow = await resolvePendingEval(right.data.answer.id, 8);
  if (rightRow.status === "accepted" && rightRow.payout_status !== "paid") {
    await pause(3000);
    await api("POST", `/api/answers/${rightRow.id}/retry`);
    rightRow = await getAnswer(rightRow.id);
  }
  record("correct terse answer '19' -> accepted + paid",
    rightRow.status === "accepted" && rightRow.payout_status === "paid",
    `status=${rightRow.status}/${rightRow.payout_status} complete=${rightRow.complete_tx?.slice(0, 18)} forward=${rightRow.forward_tx?.slice(0, 18)}`);

  const q = await api("GET", `/api/questions/${questionId}`);
  record("question answered", q.data.question?.status === "answered",
    `status=${q.data.question?.status}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`complete tx: https://testnet.arcscan.app/tx/${rightRow.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${rightRow.forward_tx}`);
  summarize("PHASE 3 EMPTY-TOPICS EVAL");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
