import type { EvalError } from "../eval/evaluate-answer";
import type { CheckResult } from "../eval/objective-checks";

// Shared answer shapes — client-safe (types only + a pure projection).
// Server-side reads live in answer-queries.ts.

export interface PaidInfo {
  amount: string; // USDC decimal string actually forwarded to the winner
  // Present ONLY when PaymentReleased.amount != the net_payout snapshot
  // (admin fee drift). The FULL released amount is still forwarded — the
  // agent never retains residue — and both numbers are shown on the receipt.
  discrepancy?: { expectedNet: string; released: string };
}

export interface EvalResultsJson {
  results?: CheckResult[];
  error?: EvalError | null; // set => "evaluation pending, retrying" (R3)
  failReason?: string; // e.g. lost the first-pass-wins race
  paid?: PaidInfo;
  payoutError?: string; // last payout failure, shown on the receipt banner
}

export interface AnswerRow {
  id: string;
  question_id: string;
  answerer_address: string;
  body: string;
  status: "pending" | "failed" | "accepted";
  eval_results: EvalResultsJson | null;
  payout_tx: string | null;
  created_at: string;
  complete_tx: string | null;
  forward_tx: string | null;
  payout_status: "payout_pending" | "paid" | "payout_failed" | null;
  content_hash: string | null;
  signature: string | null;
}

export interface PublicAnswer {
  id: string;
  questionId: string;
  answererAddress: string;
  body: string;
  status: AnswerRow["status"];
  evalResults: EvalResultsJson | null;
  createdAt: string;
  completeTx: string | null;
  forwardTx: string | null;
  payoutStatus: AnswerRow["payout_status"];
}

export function toPublicAnswer(row: AnswerRow): PublicAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    answererAddress: row.answerer_address,
    body: row.body,
    status: row.status,
    evalResults: row.eval_results,
    createdAt: row.created_at,
    completeTx: row.complete_tx,
    forwardTx: row.forward_tx,
    payoutStatus: row.payout_status,
  };
}
