import { NextResponse } from "next/server";
import { getAnswerRow } from "@/lib/answers/answer-queries";
import { toPublicAnswer } from "@/lib/answers/answer-types";
import {
  ensureQuestionAnswered,
  processAnswerEvaluation,
} from "@/lib/answers/process-answer-evaluation";
import { acceptAnswer } from "@/lib/payout/accept-answer";
import type { Criteria } from "@/lib/questions/criteria-schema";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Anti-spam (review M2): per-answer retry throttle. In-process is enough —
// single-instance deployment, and retries are idempotent anyway.
const RETRY_THROTTLE_MS = 10_000;
const lastRetryAt = new Map<string, number>();

// POST /api/answers/[id]/retry — the manual Retry button (R3). Two cases:
//   1. pending answer whose evaluation ERRORED -> re-run the evaluation
//      (an eval still in flight has no recorded error and is refused — C2)
//   2. accepted answer whose payout is not paid -> heal the question flip
//      (H2 crash window) and resume the payout pipeline
// Both paths are idempotent, so the endpoint needs no auth: the worst a
// stranger can do is help.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, "invalid answer id");
  const now = Date.now();
  if (now - (lastRetryAt.get(id) ?? 0) < RETRY_THROTTLE_MS) {
    return jsonError(429, "retry throttled — wait a few seconds");
  }
  lastRetryAt.set(id, now);

  const answer = await getAnswerRow(id);
  if (!answer) return jsonError(404, "answer not found");

  if (answer.status === "accepted") {
    if (answer.payout_status === "paid") {
      return NextResponse.json({ answer: toPublicAnswer(answer), payout: null, already: true });
    }
    await ensureQuestionAnswered(getSupabaseServerClient(), answer.question_id, answer.id);
    const payout = await acceptAnswer(answer.id);
    const fresh = await getAnswerRow(id);
    return NextResponse.json({ answer: toPublicAnswer(fresh ?? answer), payout });
  }

  if (answer.status === "failed") {
    return jsonError(409, "answer already evaluated as failed — submit a new answer instead");
  }

  // pending: only re-evaluate when the previous evaluation ERRORED. A pending
  // row without a recorded error means an evaluation is in flight right now —
  // re-running would race it (C2).
  if (!answer.eval_results?.error) {
    return jsonError(409, "evaluation is in progress — wait for it to finish");
  }
  const question = await getQuestionRow(answer.question_id);
  if (!question) return jsonError(404, "question not found");
  const processed = await processAnswerEvaluation(
    answer,
    question.criteria as unknown as Criteria,
    { title: question.title, body: question.body },
  );
  return NextResponse.json({
    answer: toPublicAnswer({
      ...answer,
      status: processed.status,
      eval_results: processed.evalResults,
    }),
    payout: processed.payout ?? null,
  });
}
