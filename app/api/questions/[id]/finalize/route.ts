import { NextResponse, type NextRequest } from "next/server";
import { publicClient } from "@/lib/chain/clients";
import { JOB_STATUS } from "@/lib/chain/abi-agentic-commerce";
import { getJob } from "@/lib/escrow/escrow-reads";
import { usdcToRaw } from "@/lib/format-usdc";
import { isQuestionId } from "@/lib/questions/question-id";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

// POST /api/questions/[id]/finalize — wizard step 3 completion. THE live
// guard (yêu cầu 2): a question only flips to `open` after the SERVER
// verifies onchain that the job is Funded AND budget > 0 AND the budget
// matches the promised amount. A client cannot claim "funded" — the chain
// is the referee. Draft questions never appear as live anywhere.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isQuestionId(id)) return jsonError(400, "invalid question id");

  let fundTx: string | null = null;
  try {
    const body = await req.json();
    if (typeof body.fundTx === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.fundTx)) {
      fundTx = body.fundTx;
    }
  } catch {
    // body optional
  }

  const row = await getQuestionRow(id);
  if (!row) return jsonError(404, "question not found");
  if (row.status === "open") return NextResponse.json({ ok: true, already: true });
  if (row.status !== "draft") return jsonError(409, `question is ${row.status}`);
  if (row.job_id === null) return jsonError(409, "createJob not recorded yet (step 1)");

  const job = await getJob(publicClient, BigInt(row.job_id));
  const expected = usdcToRaw(row.budget);
  if (job.status !== JOB_STATUS.Funded) {
    return jsonError(409, `job not Funded onchain (status ${job.status}) — question stays draft`);
  }
  if (job.budget <= 0n || job.budget !== expected) {
    return jsonError(409, `onchain budget ${job.budget} does not match promised ${expected}`);
  }
  // Review C1: never open a question whose escrow can already expire.
  if (job.expiredAt <= BigInt(Math.floor(Date.now() / 1000))) {
    return jsonError(409, "job already past its onchain expiry — cannot go live");
  }

  const db = getSupabaseServerClient();
  const { error } = await db
    .from("questions")
    .update({ status: "open", fund_tx: fundTx })
    .eq("id", id)
    .eq("status", "draft"); // CAS
  if (error) return jsonError(500, `db update failed: ${error.message}`);

  return NextResponse.json({ ok: true });
}
