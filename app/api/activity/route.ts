import { NextResponse } from "next/server";
import type { AnswerRow } from "@/lib/answers/answer-types";
import { jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// GET /api/activity?address=0x… - the wallet's asked questions + submitted
// answers. Reads the DB, but the payout label the UI derives from this data
// follows "chain is truth" (C4): answers carry payout_status + forward_tx,
// and 'paid' is only ever written after both onchain receipts succeeded.
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!ADDRESS_RE.test(address)) return jsonError(400, "invalid address");
  const db = getSupabaseServerClient();

  const { data: asked, error: qErr } = await db
    .from("questions")
    .select("id, title, budget::text, net_payout::text, status, deadline, refund_tx, created_at")
    .ilike("asker_address", address)
    .order("created_at", { ascending: false })
    .limit(100);
  if (qErr) return jsonError(500, `asked read failed: ${qErr.message}`);

  const { data: answered, error: aErr } = await db
    .from("answers")
    .select("id, question_id, status, payout_status, forward_tx, eval_results, created_at")
    .ilike("answerer_address", address)
    .order("created_at", { ascending: false })
    .limit(100);
  if (aErr) return jsonError(500, `answered read failed: ${aErr.message}`);

  // Join question titles for the answered tab (one indexed IN query).
  const rows = (answered ?? []) as Pick<
    AnswerRow,
    "id" | "question_id" | "status" | "payout_status" | "forward_tx" | "eval_results" | "created_at"
  >[];
  const qids = [...new Set(rows.map((a) => a.question_id))];
  const titles = new Map<string, string>();
  if (qids.length > 0) {
    const { data: qs } = await db.from("questions").select("id, title").in("id", qids);
    for (const q of qs ?? []) titles.set(q.id as string, q.title as string);
  }

  return NextResponse.json({
    asked: asked ?? [],
    answered: rows.map((a) => ({
      id: a.id,
      questionId: a.question_id,
      questionTitle: titles.get(a.question_id) ?? a.question_id,
      status: a.status,
      payoutStatus: a.payout_status,
      forwardTx: a.forward_tx,
      paidAmount: a.eval_results?.paid?.amount ?? null,
      createdAt: a.created_at,
    })),
  });
}
