import "server-only";
import { JOB_STATUS } from "../chain/abi-agentic-commerce";
import { withAgentWallet } from "../chain/agent-wallet-lock";
import { getAgentWalletClient, publicClient } from "../chain/clients";
import { getJob } from "../escrow/escrow-reads";
import {
  completeJob,
  forwardToWinner,
  parsePaymentReleasedAmount,
  submitDeliverable,
} from "../escrow/escrow-writes";
import { rawToUsdc, usdcToRaw } from "../format-usdc";
import { getSupabaseServerClient } from "../supabase/server-client";
import type { AnswerRow, EvalResultsJson, PaidInfo } from "../answers/answer-types";

// Pacing between txs — the public Arc RPC rate-limits bursts (Phase 1 finding).
const TX_PACING_MS = 1500;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PayoutOutcome {
  payoutStatus: "paid" | "payout_failed";
  completeTx: string | null;
  forwardTx: string | null;
  paid?: PaidInfo;
  error?: string;
}

// Option B payout: submit -> complete (escrow pays agent) -> forward the
// EXACT PaymentReleased amount to the winner (M2; "số vào bằng số ra" — the
// agent never retains residue). Every step is resumable and claim-gated so a
// retry can never double-pay; all agent-wallet txs are serialized (H2).
export async function acceptAnswer(answerId: string): Promise<PayoutOutcome> {
  return withAgentWallet(() => runPayout(answerId));
}

async function runPayout(answerId: string): Promise<PayoutOutcome> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("answers")
    .select("*")
    .eq("id", answerId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`answer load failed: ${error?.message ?? "not found"}`);
  }
  const a = data as AnswerRow;
  if (a.status !== "accepted") {
    throw new Error(`answer ${answerId} is not accepted — refusing to pay`);
  }
  if (a.payout_status === "paid") {
    return {
      payoutStatus: "paid",
      completeTx: a.complete_tx,
      forwardTx: a.forward_tx,
      paid: a.eval_results?.paid,
    };
  }

  // Claim (CAS): anything not already 'paid' may be (re)claimed. In-process
  // concurrency is impossible (withAgentWallet queue); this guards duplicate
  // HTTP retries and heals rows stuck in payout_pending after a crash.
  const { data: claimed, error: claimErr } = await db
    .from("answers")
    .update({ payout_status: "payout_pending" })
    .eq("id", answerId)
    .or("payout_status.is.null,payout_status.neq.paid")
    .select("id");
  if (claimErr) throw new Error(`payout claim failed: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) {
    return {
      payoutStatus: "paid",
      completeTx: a.complete_tx,
      forwardTx: a.forward_tx,
      paid: a.eval_results?.paid,
    };
  }

  let completeTx = a.complete_tx;
  let forwardTx = a.forward_tx;
  try {
    const question = await loadQuestionForPayout(a.question_id);
    const jobId = BigInt(question.job_id);
    const wallet = getAgentWalletClient();
    const ctx = { wallet, publicClient };
    const agentAddress = wallet.account.address;

    let released: bigint;
    if (!completeTx) {
      const job = await getJob(publicClient, jobId);
      if (job.status === JOB_STATUS.Funded) {
        if (!a.content_hash) throw new Error("answer has no content_hash");
        await submitDeliverable(ctx, jobId, a.content_hash as `0x${string}`);
        await pause(TX_PACING_MS);
      } else if (job.status !== JOB_STATUS.Submitted) {
        // Completed with no recorded complete_tx = crash window between the
        // tx and the DB write. Loud manual-recovery failure — never guess.
        throw new Error(
          `job ${jobId} in status ${job.status} with no recorded complete_tx — manual recovery needed`,
        );
      }
      const done = await completeJob(ctx, jobId, `askbounty:${a.id.slice(0, 8)}`);
      completeTx = done.hash;
      await db.from("answers").update({ complete_tx: completeTx }).eq("id", answerId);
      released = parsePaymentReleasedAmount(done.receipt, jobId, agentAddress);
    } else {
      // Resume: re-read the released amount from the recorded complete tx.
      const receipt = await publicClient.getTransactionReceipt({
        hash: completeTx as `0x${string}`,
      });
      released = parsePaymentReleasedAmount(receipt, jobId, agentAddress);
    }

    const expectedNet = usdcToRaw(question.net_payout);
    const paid: PaidInfo = { amount: rawToUsdc(released) };
    if (released !== expectedNet) {
      paid.discrepancy = {
        expectedNet: rawToUsdc(expectedNet),
        released: rawToUsdc(released),
      };
      console.warn(
        `[payout] PaymentReleased ${paid.discrepancy.released} != snapshot ${paid.discrepancy.expectedNet} USDC ` +
          `for ${a.question_id} (fee BPs drifted?) — forwarding the FULL released amount, agent retains nothing`,
      );
    }

    if (!forwardTx) {
      await pause(TX_PACING_MS);
      forwardTx = await forwardToWinner(
        ctx,
        a.answerer_address as `0x${string}`,
        released,
      );
    }

    const evalResults: EvalResultsJson = { ...(a.eval_results ?? {}), paid };
    delete evalResults.payoutError;
    await db
      .from("answers")
      .update({
        forward_tx: forwardTx,
        payout_tx: forwardTx,
        payout_status: "paid",
        eval_results: evalResults,
      })
      .eq("id", answerId);
    return { payoutStatus: "paid", completeTx, forwardTx, paid };
  } catch (err) {
    // viem puts the revert reason on line 2 — keep the first lines
    const msg =
      err instanceof Error
        ? err.message.split("\n").filter(Boolean).slice(0, 3).join(" ")
        : String(err);
    console.error(`[payout] FAILED for answer ${answerId}: ${msg}`);
    const evalResults: EvalResultsJson = {
      ...(a.eval_results ?? {}),
      payoutError: msg.slice(0, 500),
    };
    await db
      .from("answers")
      .update({ payout_status: "payout_failed", eval_results: evalResults })
      .eq("id", answerId);
    return { payoutStatus: "payout_failed", completeTx, forwardTx, error: msg };
  }
}

async function loadQuestionForPayout(questionId: string) {
  const db = getSupabaseServerClient();
  // net_payout as ::text — NUMERIC through JSON loses precision at 15+ digits
  // (Phase 2 review L2); payout math must be exact to the unit.
  const { data, error } = await db
    .from("questions")
    .select("id, job_id, net_payout::text")
    .eq("id", questionId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`question load failed: ${error?.message ?? "not found"}`);
  }
  const q = data as { job_id: number | null; net_payout: string | null };
  if (q.job_id === null || q.net_payout === null) {
    throw new Error(`question ${questionId} missing job_id/net_payout`);
  }
  return { job_id: q.job_id, net_payout: q.net_payout };
}
