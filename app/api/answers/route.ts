import { NextResponse } from "next/server";
import { toPublicAnswer, type AnswerRow } from "@/lib/answers/answer-types";
import { processAnswerEvaluation } from "@/lib/answers/process-answer-evaluation";
import { checkSubmissionCooldown } from "@/lib/auth/submission-cooldown";
import { verifySubmission } from "@/lib/auth/verify-submission-signature";
import type { Criteria } from "@/lib/questions/criteria-schema";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";
import { isQuestionId } from "@/lib/questions/question-id";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

const MAX_BODY_CHARS = 20_000;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// POST /api/answers — signed answer submission + trigger-on-submit
// evaluation. Order is security-relevant (R5): the wallet signature is
// verified BEFORE any DB write, and the stored answerer_address is the
// RECOVERED signer, never the client-claimed value.
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }
  const { questionId, body, address, signature } = payload;
  if (typeof questionId !== "string" || !isQuestionId(questionId)) {
    return jsonError(400, "invalid question id");
  }
  if (typeof body !== "string" || body.trim() === "") {
    return jsonError(400, "answer body is required");
  }
  if (body.length > MAX_BODY_CHARS) {
    return jsonError(400, `answer body too long (max ${MAX_BODY_CHARS} chars)`);
  }
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
    return jsonError(400, "invalid address");
  }
  if (typeof signature !== "string" || !signature.startsWith("0x")) {
    return jsonError(400, "invalid signature");
  }

  // R5: signature check FIRST — nothing touches the DB on failure.
  const auth = await verifySubmission({ questionId, body, address, signature });
  if (!auth.ok) return jsonError(401, `signature rejected: ${auth.reason}`);

  const question = await getQuestionRow(questionId);
  if (!question) return jsonError(404, "question not found");
  if (question.status !== "open") {
    return jsonError(409, `question is not accepting answers (status: ${question.status})`);
  }
  if (Date.parse(question.deadline) <= Date.now()) {
    return jsonError(409, "question deadline has passed");
  }

  const cooldown = await checkSubmissionCooldown(questionId, auth.recovered);
  if (cooldown.blocked) {
    return jsonError(
      429,
      `cooldown: wait ${cooldown.retryAfterSeconds}s before submitting to this question again`,
    );
  }

  const db = getSupabaseServerClient();
  const { data: inserted, error: insErr } = await db
    .from("answers")
    .insert({
      question_id: questionId,
      answerer_address: auth.recovered,
      body,
      status: "pending",
      content_hash: auth.contentHash,
      signature,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    return jsonError(500, `answer insert failed: ${insErr?.message ?? "no row"}`);
  }

  const row = inserted as AnswerRow;
  let processed;
  try {
    processed = await processAnswerEvaluation(
      row,
      question.criteria as unknown as Criteria,
      { title: question.title, body: question.body, deadline: question.deadline },
    );
  } catch (err) {
    // Review M3: an unexpected pipeline throw must never leave the answer
    // pending WITHOUT a surfaced error (that would hide the Retry button).
    const message =
      (err instanceof Error ? err.message : String(err))
        .replace(/\s+/g, " ")
        .slice(0, 200);
    const evalResults = { error: { code: "internal", message, retryable: true } };
    await db
      .from("answers")
      .update({ eval_results: evalResults })
      .eq("id", row.id)
      .eq("status", "pending");
    processed = { status: "pending" as const, evalResults };
  }
  return NextResponse.json({
    answer: toPublicAnswer({
      ...row,
      status: processed.status,
      eval_results: processed.evalResults,
    }),
    payout: processed.payout ?? null,
  });
}
