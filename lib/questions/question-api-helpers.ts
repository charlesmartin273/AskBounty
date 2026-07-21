import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../supabase/server-client";

// Shared plumbing for /api/questions/* route handlers.

export interface QuestionRow {
  id: string;
  asker_address: string;
  title: string;
  body: string;
  budget: string | number; // Postgres NUMERIC arrives as a JSON number
  criteria: Record<string, unknown>;
  job_id: number | null;
  status: "draft" | "open" | "answered" | "expired";
  deadline: string;
  created_at: string;
  net_payout: string | number | null;
  platform_fee_bp: number | null;
  evaluator_fee_bp: number | null;
  create_tx: string | null;
  fund_tx: string | null;
}

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function getQuestionRow(id: string): Promise<QuestionRow | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`db read failed: ${error.message}`);
  return (data as QuestionRow) ?? null;
}

// Public projection — everything on the row is public by design (RLS allows
// read), this just keeps API responses stable and explicit.
export function toPublicQuestion(row: QuestionRow) {
  return {
    id: row.id,
    askerAddress: row.asker_address,
    title: row.title,
    body: row.body,
    budget: String(row.budget), // normalize NUMERIC->string at the boundary
    criteria: row.criteria,
    jobId: row.job_id,
    status: row.status,
    deadline: row.deadline,
    createdAt: row.created_at,
    netPayout: row.net_payout === null ? null : String(row.net_payout),
    platformFeeBp: row.platform_fee_bp,
    evaluatorFeeBp: row.evaluator_fee_bp,
    createTx: row.create_tx,
    fundTx: row.fund_tx,
  };
}
