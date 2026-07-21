import { NextResponse } from "next/server";
import { getAgentWalletClient, publicClient } from "@/lib/chain/clients";
import { JOB_STATUS } from "@/lib/chain/abi-agentic-commerce";
import { getJob } from "@/lib/escrow/escrow-reads";
import { usdcToRaw } from "@/lib/format-usdc";
import { isQuestionId } from "@/lib/questions/question-id";
import {
  getQuestionRow,
  jsonError,
  toPublicQuestion,
} from "@/lib/questions/question-api-helpers";

// GET /api/questions/[id] — question + wizard resume state (yêu cầu 3).
// The wizard step is derived from DB + ONCHAIN truth, never from client
// memory, so closing the tab mid-flow loses nothing.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isQuestionId(id)) return jsonError(400, "invalid question id");
  const row = await getQuestionRow(id);
  if (!row) return jsonError(404, "question not found");

  // Steps: 1=createJob, 2=setBudget, 3=approve+fund, 4=done(open)
  let step = 1;
  let onchain: { status: number; budget: string } | null = null;
  if (row.status !== "draft") {
    step = 4;
  } else if (row.job_id !== null) {
    const job = await getJob(publicClient, BigInt(row.job_id));
    onchain = { status: job.status, budget: job.budget.toString() };
    const expected = usdcToRaw(row.budget);
    if (job.status === JOB_STATUS.Funded && job.budget === expected) {
      step = 4; // funded onchain, finalize pending — client should call finalize
    } else if (job.budget === expected) {
      step = 3; // budget set, waiting for approve+fund
    } else {
      step = 2; // job exists, budget not set yet
    }
  }

  return NextResponse.json({
    question: toPublicQuestion(row),
    wizard: { step, onchain, finalized: row.status !== "draft" },
    agentAddress: getAgentWalletClient().account.address,
  });
}
