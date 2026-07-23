import { decodeFunctionData } from "viem";
import { NextResponse } from "next/server";
import { agenticCommerceAbi } from "@/lib/chain/abi-agentic-commerce";
import { publicClient } from "@/lib/chain/clients";
import { AGENTIC_COMMERCE } from "@/lib/chain/config";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";
import { isQuestionId } from "@/lib/questions/question-id";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

// POST /api/questions/[id]/refund — records an onchain claimRefund.
// PRD-ERRATA E6: claimRefund is PERMISSIONLESS as to caller — the contract
// always pays the job's CLIENT (asker), so any successful trigger is
// legitimate and no `from` check applies. What the route must prove is that
// the submitted hash IS the refund of THIS job (a forged hash must never
// flip the public status or plant a wrong receipt link):
//   1. question must be 'expired' (409 otherwise — also kills double-record)
//   2. no accepted answer may exist (belt-and-braces; accepted => 'answered')
//   3. receipt succeeded AND tx.to == escrow contract
//   4. tx INPUT decodes to claimRefund(jobId) for exactly this question's job
//   5. CAS expired->refunded (second call => 0 rows => 409)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isQuestionId(id)) return jsonError(400, "invalid question id");
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }
  const refundTx = payload.refundTx;
  if (typeof refundTx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(refundTx)) {
    return jsonError(400, "invalid refundTx hash");
  }

  const question = await getQuestionRow(id);
  if (!question) return jsonError(404, "question not found");
  if (question.status !== "expired") {
    return jsonError(409, `question is not expired (status: ${question.status})`);
  }
  if (question.job_id === null) return jsonError(409, "question has no onchain job");

  const db = getSupabaseServerClient();
  const { count: acceptedCount, error: accErr } = await db
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", id)
    .eq("status", "accepted");
  if (accErr) return jsonError(500, `answers read failed: ${accErr.message}`);
  if ((acceptedCount ?? 0) > 0) {
    return jsonError(409, "question has an accepted answer — refund not applicable");
  }

  let receipt, tx;
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: refundTx as `0x${string}`,
    });
    tx = await publicClient.getTransaction({ hash: refundTx as `0x${string}` });
  } catch {
    return jsonError(400, "refundTx not found onchain");
  }
  if (
    receipt.status !== "success" ||
    receipt.to?.toLowerCase() !== AGENTIC_COMMERCE.toLowerCase()
  ) {
    return jsonError(400, "refundTx is not a successful escrow contract call");
  }
  // The strong check (E6/review M1): the calldata must BE claimRefund for
  // exactly this question's job. Any other function (createJob, fund, …) or
  // any other jobId fails to decode/match — the receipt link is unforgeable.
  try {
    const decoded = decodeFunctionData({
      abi: agenticCommerceAbi,
      data: tx.input,
    });
    if (
      decoded.functionName !== "claimRefund" ||
      (decoded.args[0] as bigint) !== BigInt(question.job_id)
    ) {
      return jsonError(400, "refundTx is not claimRefund for this question's job");
    }
  } catch {
    return jsonError(400, "refundTx is not claimRefund for this question's job");
  }

  const { data: flipped, error: casErr } = await db
    .from("questions")
    .update({ status: "refunded", refund_tx: refundTx })
    .eq("id", id)
    .eq("status", "expired")
    .select("id");
  if (casErr) return jsonError(500, `refund record failed: ${casErr.message}`);
  if (!flipped || flipped.length === 0) {
    return jsonError(409, "refund already recorded");
  }
  return NextResponse.json({ ok: true, status: "refunded", refundTx });
}
