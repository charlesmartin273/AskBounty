import { NextResponse } from "next/server";
import { getAgentWalletClient, publicClient } from "@/lib/chain/clients";
import { JOB_STATUS } from "@/lib/chain/abi-agentic-commerce";
import { getJob } from "@/lib/escrow/escrow-reads";
import { setBudget } from "@/lib/escrow/escrow-writes";
import { usdcToRaw } from "@/lib/format-usdc";
import { isQuestionId } from "@/lib/questions/question-id";
import { getQuestionRow, jsonError } from "@/lib/questions/question-api-helpers";

// POST /api/questions/[id]/set-budget — wizard step 2. setBudget is
// provider-only onchain (Phase 1 dry-run finding), so the agent backend
// signs it. Idempotent: if the budget already matches, returns ok without
// a second tx (safe to retry after a mid-flow refresh).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isQuestionId(id)) return jsonError(400, "invalid question id");
  const row = await getQuestionRow(id);
  if (!row) return jsonError(404, "question not found");
  if (row.job_id === null) return jsonError(409, "createJob not recorded yet (step 1)");
  if (row.status !== "draft") return NextResponse.json({ ok: true, already: true });

  const jobId = BigInt(row.job_id);
  const expected = usdcToRaw(row.budget);
  const job = await getJob(publicClient, jobId);

  if (job.budget === expected) {
    return NextResponse.json({ ok: true, already: true }); // idempotent
  }
  if (job.status !== JOB_STATUS.Open) {
    return jsonError(409, `job not in Open state (status ${job.status})`);
  }
  if (job.budget !== 0n) {
    return jsonError(409, `job already has a different budget ${job.budget}`);
  }

  try {
    const hash = await setBudget(
      { wallet: getAgentWalletClient(), publicClient },
      jobId,
      expected,
    );
    return NextResponse.json({ ok: true, tx: hash });
  } catch (err) {
    return jsonError(502, `setBudget failed: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
  }
}
