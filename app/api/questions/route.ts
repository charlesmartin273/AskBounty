import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { getAgentWalletClient, publicClient } from "@/lib/chain/clients";
import { computeNetPayout, readFeeBps } from "@/lib/escrow/escrow-reads";
import { rawToUsdc, usdcToRaw } from "@/lib/format-usdc";
import { validateCriteria } from "@/lib/questions/criteria-schema";
import { generateQuestionId } from "@/lib/questions/question-id";
import { jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

// POST /api/questions - create a DRAFT question row with the fee snapshot.
// The displayed net payout is LOCKED here (yêu cầu 1): computed from live
// onchain fee reads at creation time and persisted, so later admin fee
// changes never alter what answerers were promised on the page.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }

  const askerAddress = String(body.askerAddress ?? "");
  if (!isAddress(askerAddress)) return jsonError(400, "invalid askerAddress");

  const title = String(body.title ?? "").trim();
  if (title.length < 1 || title.length > 200) {
    return jsonError(400, "title must be 1-200 chars");
  }
  const questionBody = String(body.body ?? "").trim();
  if (questionBody.length < 1 || questionBody.length > 20_000) {
    return jsonError(400, "body must be 1-20000 chars");
  }

  // Optional private ground truth for the evaluator (PRD-ERRATA E7).
  const referenceNotes = String(body.referenceNotes ?? "").trim();
  if (referenceNotes.length > 5_000) {
    return jsonError(400, "referenceNotes must be at most 5000 chars");
  }

  let budgetRaw: bigint;
  try {
    budgetRaw = usdcToRaw(String(body.budget ?? ""));
  } catch {
    return jsonError(400, "budget must be a decimal USDC amount");
  }
  if (budgetRaw <= 0n) return jsonError(400, "budget must be > 0");

  const deadline = new Date(String(body.deadline ?? ""));
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now() + 10 * 60_000) {
    return jsonError(400, "deadline must be a valid time at least 10 minutes in the future");
  }

  const { criteria, errors, warnings } = validateCriteria(body.criteria ?? {});
  if (!criteria) return jsonError(400, `invalid criteria: ${errors.join("; ")}`);

  // Live fee snapshot (PRD-ERRATA E2) - never hardcode.
  const bps = await readFeeBps(publicClient);
  const netRaw = computeNetPayout(budgetRaw, bps);
  const questionId = generateQuestionId();
  const agentAddress = getAgentWalletClient().account.address;

  const db = getSupabaseServerClient();
  const { error } = await db.from("questions").insert({
    id: questionId,
    asker_address: askerAddress.toLowerCase(),
    title,
    body: questionBody,
    budget: rawToUsdc(budgetRaw),
    criteria,
    reference_notes: referenceNotes || null,
    status: "draft",
    deadline: deadline.toISOString(),
    net_payout: rawToUsdc(netRaw),
    platform_fee_bp: Number(bps.platformFeeBP),
    evaluator_fee_bp: Number(bps.evaluatorFeeBP),
  });
  if (error) return jsonError(500, `db insert failed: ${error.message}`);

  return NextResponse.json({
    questionId,
    netPayout: rawToUsdc(netRaw),
    budgetRaw: budgetRaw.toString(),
    deadlineUnix: Math.floor(deadline.getTime() / 1000),
    agentAddress,
    warnings,
  });
}
