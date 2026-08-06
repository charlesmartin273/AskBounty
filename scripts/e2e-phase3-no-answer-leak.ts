// Phase 3 PERMANENT regression E2E - reasoning must never leak the correct
// answer. Found in production: a wrong guess ("melon") on a trivia question
// failed, but the LLM's "reasoning" text spelled out the actual answer
// ("Bananas, specifically the Cavendish variety, are the fruit most commonly
// known for being clones..."). Since evaluation feedback is public
// (lib/eval/evaluate-answer.ts folds `reasoning` into the publicly-readable
// topics_covered detail), any wrong guess plus a second wallet turned into a
// free win - the bounty mechanism was defeated.
//
// This reproduces that exact shape: a trivia question with one specific
// correct term, a deliberately wrong first guess, and an assertion that the
// public-facing text contains neither the term nor its usual companion word.
// Fix lives entirely in lib/eval/llm-review-prompt.ts (prompt only - no
// judging logic changed). This script proves the fix holds, not the
// mechanism - if it ever regresses, some prompt edit undid the constraint.
//
// Needs: dev server (E2E_BASE_URL), funded asker wallet, valid GEMINI key.
// Run: npx tsx scripts/e2e-phase3-no-answer-leak.ts
import {
  createOpenQuestion, makeSigner, pause, preflightAskerBalance,
  resolvePendingEval, submitAnswer, summarize, record, api,
} from "./phase3-test-helpers";

// Secret terms the correct answer would contain. A passing check requires
// NEITHER to appear (case-insensitive) anywhere in the public eval text.
const SECRET_TERMS = ["banana", "cavendish"];

function leaksSecret(text: string): string | null {
  const lower = text.toLowerCase();
  return SECRET_TERMS.find((t) => lower.includes(t)) ?? null;
}

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 1_000_000n);

  const { questionId } = await createOpenQuestion(
    asker,
    "1",
    "E2E no-answer-leak: the sterile clone fruit",
    {
      body: [
        "Which fruit sold in nearly every supermarket worldwide is, genetically,",
        "a single sterile clone that can only be propagated by cuttings rather",
        "than from seed - and name the specific commercial cultivar involved.",
      ].join(" "),
      criteria: {
        minWords: 1,
        mustIncludeCode: false,
        // Deliberately generic topic names - they must not themselves leak
        // the secret, so a leak found later can only have come from the LLM
        // elaborating in "reasoning" or a "topic" string, not from criteria
        // the asker already made public.
        topics: ["identifies the correct fruit", "names the correct cultivar"],
      },
      deadlineMs: Date.now() + 3600_000,
    },
  );

  // A deliberately wrong guess - this must fail, and fail WITHOUT telling
  // the submitter (or anyone reading the public page) what the right answer
  // actually is.
  const wrong = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, "melon");
  if (wrong.status !== 200) throw new Error(`submit failed: ${JSON.stringify(wrong.data)}`);
  const row = await resolvePendingEval(wrong.data.answer.id, 8);

  const topicsCheck = row.eval_results?.results?.find((r) => r.check === "topics_covered");
  record(
    'wrong answer "melon" -> failed (objective checks pass, LLM judges content)',
    row.status === "failed" && topicsCheck?.pass === false,
    `status=${row.status} pass=${topicsCheck?.pass}`,
  );

  const publicText = topicsCheck?.detail ?? "";
  const leaked = leaksSecret(publicText);
  record(
    "public eval text does not leak the correct answer",
    leaked === null,
    leaked
      ? `LEAK: found "${leaked}" in public text: "${publicText}"`
      : `clean: "${publicText}"`,
  );

  // Guard against a vacuous pass: if the objective gate had rejected the
  // answer before the LLM ever ran, `detail` would be empty and the leak
  // check above would trivially pass for the wrong reason.
  record(
    "LLM was actually reached (detail is non-empty, not a pre-LLM gate result)",
    publicText.trim().length > 0,
    `detail length=${publicText.length}`,
  );

  const q = await api("GET", `/api/questions/${questionId}`);
  console.log(`\nquestion: ${(process.env.E2E_BASE_URL ?? "http://localhost:3000")}/q/${questionId}`);
  console.log(`public reasoning shown to the submitter:\n  "${publicText}"`);
  console.log(`question status: ${q.data.question?.status}`);

  await pause(500);
  summarize("PHASE 3 NO-ANSWER-LEAK");
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exitCode = 1;
});
