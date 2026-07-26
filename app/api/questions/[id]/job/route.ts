import { NextResponse, type NextRequest } from "next/server";
import { getAgentWalletClient, publicClient } from "@/lib/chain/clients";
import { JOB_STATUS } from "@/lib/chain/abi-agentic-commerce";
import { getJob } from "@/lib/escrow/escrow-reads";
import { isQuestionId } from "@/lib/questions/question-id";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

// POST /api/questions/[id]/job - record the jobId right after wizard step 1
// (yêu cầu 3: persist immediately so an interrupted wizard can resume).
// The claimed jobId is VERIFIED against the chain before storing: the job's
// description must equal this questionId, provider+evaluator must be the
// agent wallet, and the client must be the asker - a forged jobId is rejected.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isQuestionId(id)) return jsonError(400, "invalid question id");

  let body: { jobId?: string | number; createTx?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid JSON body");
  }
  let jobId: bigint;
  try {
    jobId = BigInt(body.jobId ?? "");
  } catch {
    return jsonError(400, "jobId must be an integer");
  }
  const createTx =
    typeof body.createTx === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.createTx)
      ? body.createTx
      : null;

  const row = await getQuestionRow(id);
  if (!row) return jsonError(404, "question not found");
  if (row.status !== "draft") return jsonError(409, "question already finalized");
  if (row.job_id !== null) {
    if (BigInt(row.job_id) === jobId) return NextResponse.json({ ok: true }); // idempotent
    return jsonError(409, `question already bound to job ${row.job_id}`);
  }

  const agent = getAgentWalletClient().account.address.toLowerCase();
  const job = await getJob(publicClient, jobId);
  if (job.description !== id) return jsonError(400, "job description does not match question id");
  if (job.provider.toLowerCase() !== agent || job.evaluator.toLowerCase() !== agent) {
    return jsonError(400, "job provider/evaluator is not the AskBounty agent");
  }
  if (job.client.toLowerCase() !== row.asker_address.toLowerCase()) {
    return jsonError(400, "job client does not match asker address");
  }
  if (job.status !== JOB_STATUS.Open && job.status !== JOB_STATUS.Funded) {
    return jsonError(400, `job is not open (status ${job.status})`);
  }
  // Review C1: the onchain expiry MUST equal the promised deadline - otherwise
  // a modified client could set a short expiry, let answerers work, then
  // refund (early-expiry rug). Hook must be zero (an arbitrary hook contract
  // could block completion).
  const expectedExpiry = BigInt(Math.floor(Date.parse(row.deadline) / 1000));
  if (job.expiredAt !== expectedExpiry) {
    return jsonError(400, `job expiry ${job.expiredAt} does not match question deadline ${expectedExpiry}`);
  }
  if (job.hook !== "0x0000000000000000000000000000000000000000") {
    return jsonError(400, "job must have no hook contract");
  }

  const db = getSupabaseServerClient();
  const { data: updated, error } = await db
    .from("questions")
    .update({ job_id: Number(jobId), create_tx: createTx })
    .eq("id", id)
    .is("job_id", null) // CAS: never overwrite a concurrent bind
    .select("id");
  if (error) return jsonError(500, `db update failed: ${error.message}`);
  if (!updated || updated.length === 0) {
    // Review M1: CAS matched 0 rows - a concurrent bind won; report honestly.
    const fresh = await getQuestionRow(id);
    if (fresh && fresh.job_id !== null && BigInt(fresh.job_id) === jobId) {
      return NextResponse.json({ ok: true });
    }
    return jsonError(409, `question already bound to job ${fresh?.job_id}`);
  }

  return NextResponse.json({ ok: true });
}
