import "server-only";
import { evaluateAnswer } from "../eval/evaluate-answer";
import type { QuestionContext } from "../eval/llm-review-prompt";
import { acceptAnswer, type PayoutOutcome } from "../payout/accept-answer";
import type { Criteria } from "../questions/criteria-schema";
import { getSupabaseServerClient } from "../supabase/server-client";
import type { AnswerRow, EvalResultsJson } from "./answer-types";

export interface ProcessedEvaluation {
  status: "pending" | "failed" | "accepted";
  evalResults: EvalResultsJson;
  payout?: PayoutOutcome;
}

type Db = ReturnType<typeof getSupabaseServerClient>;

// M2 fix (user-approved 2026-07-24): an answer must never be accepted after
// the deadline - the escrow may already be refundable/refunded. The reason
// is deliberately distinct from a content failure so the answerer never
// thinks their answer was wrong.
export const DEADLINE_MISS_REASON =
  "Submitted in time, but evaluation did not finish before the deadline. " +
  "The bounty was refunded to the asker.";

const deadlinePassed = (deadline: string) => Date.parse(deadline) <= Date.now();

// Evaluates an answer row and persists the outcome. Shared by the submit
// route (trigger-on-submit) and the manual retry route.
// Concurrency rules (review C2/H2): EVERY answer-status write is guarded on
// status='pending' - a concurrent evaluation that already resolved the row
// can never be overwritten. Accept order: answer is accepted FIRST (the
// partial unique index one_accepted_per_question arbitrates races), THEN the
// question CAS-flips open->answered - a crash between the two heals via
// ensureQuestionAnswered on the retry path.
export async function processAnswerEvaluation(
  answer: AnswerRow,
  criteria: Criteria,
  question: QuestionContext & { deadline: string },
): Promise<ProcessedEvaluation> {
  const db = getSupabaseServerClient();

  // Deadline guard #1 - BEFORE the LLM call (no API cost on dead questions;
  // reachable via the retry path, since fresh submissions are rejected at
  // the route when the deadline has passed).
  if (deadlinePassed(question.deadline)) {
    const evalResults: EvalResultsJson = {
      error: null,
      failReason: DEADLINE_MISS_REASON,
    };
    const changed = await guardedUpdate(db, answer.id, {
      status: "failed",
      eval_results: evalResults,
    });
    return changed ? { status: "failed", evalResults } : refreshState(db, answer.id);
  }

  const evalOutcome = await evaluateAnswer(answer.body, criteria, question);
  const evalResults: EvalResultsJson = {
    results: evalOutcome.results,
    error: evalOutcome.outcome === "error" ? evalOutcome.error : null,
  };

  if (evalOutcome.outcome === "error") {
    // R3: stays pending with the error surfaced - "evaluation pending,
    // retrying" + manual Retry. Never silent, never accepted.
    const changed = await guardedUpdate(db, answer.id, { eval_results: evalResults });
    return changed ? { status: "pending", evalResults } : refreshState(db, answer.id);
  }

  if (evalOutcome.outcome === "fail") {
    const changed = await guardedUpdate(db, answer.id, {
      status: "failed",
      eval_results: evalResults,
    });
    return changed ? { status: "failed", evalResults } : refreshState(db, answer.id);
  }

  // Deadline guard #2 - the evaluation itself may have outlasted the
  // deadline; re-check right before anything is accepted or paid.
  if (deadlinePassed(question.deadline)) {
    const evalResults: EvalResultsJson = {
      results: evalOutcome.results,
      error: null,
      failReason: DEADLINE_MISS_REASON,
    };
    const changed = await guardedUpdate(db, answer.id, {
      status: "failed",
      eval_results: evalResults,
    });
    return changed ? { status: "failed", evalResults } : refreshState(db, answer.id);
  }

  // PASS -> accept FIRST. Unique-index violation (23505) = another answer on
  // this question is already accepted -> this one loses deterministically.
  const { data: acc, error: accErr } = await db
    .from("answers")
    .update({ status: "accepted", eval_results: evalResults })
    .eq("id", answer.id)
    .eq("status", "pending")
    .select("id");
  if (accErr) {
    if (accErr.code === "23505") {
      const lost: EvalResultsJson = {
        ...evalResults,
        failReason: "another answer was accepted first",
      };
      await guardedUpdate(db, answer.id, { status: "failed", eval_results: lost });
      return { status: "failed", evalResults: lost };
    }
    throw new Error(`accept write failed: ${accErr.message}`);
  }
  if (!acc || acc.length === 0) return refreshState(db, answer.id);

  const flipped = await ensureQuestionAnswered(db, answer.question_id, answer.id);
  if (!flipped) {
    const lost: EvalResultsJson = {
      ...evalResults,
      failReason: "question is no longer open (expired before acceptance)",
    };
    return { status: "failed", evalResults: lost };
  }

  const payout = await acceptAnswer(answer.id);
  return { status: "accepted", evalResults, payout };
}

// Answer-status write that can never clobber a concurrently resolved row.
async function guardedUpdate(
  db: Db,
  answerId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await db
    .from("answers")
    .update(patch)
    .eq("id", answerId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`answer update failed: ${error.message}`);
  return !!data && data.length > 0;
}

// The row was resolved by a concurrent evaluation - report ITS state.
async function refreshState(db: Db, answerId: string): Promise<ProcessedEvaluation> {
  const { data, error } = await db
    .from("answers")
    .select("status, eval_results")
    .eq("id", answerId)
    .single();
  if (error) throw new Error(`answer re-read failed: ${error.message}`);
  const row = data as Pick<AnswerRow, "status" | "eval_results">;
  return { status: row.status, evalResults: row.eval_results ?? {} };
}

// CAS-flip the question open->answered for an ACCEPTED answer. Idempotent -
// also used by the retry route to heal a crash between accept and flip.
// Returns false only when the question can no longer be answered (expired):
// the accept is then reverted so the bounty is not stranded.
export async function ensureQuestionAnswered(
  db: Db,
  questionId: string,
  answerId: string,
): Promise<boolean> {
  const { data: flipped, error } = await db
    .from("questions")
    .update({ status: "answered" })
    .eq("id", questionId)
    .eq("status", "open")
    .select("id");
  if (error) throw new Error(`question CAS failed: ${error.message}`);
  if (flipped && flipped.length > 0) return true;
  const { data: q } = await db
    .from("questions")
    .select("status")
    .eq("id", questionId)
    .single();
  if (q?.status === "answered") return true; // already flipped - healed
  await db
    .from("answers")
    .update({ status: "failed" })
    .eq("id", answerId)
    .eq("status", "accepted");
  return false;
}
