import "server-only";
import { getSupabaseServerClient } from "../supabase/server-client";
import type { AnswerRow } from "./answer-types";

// Server-side answer reads (service-role). Ordered by created_at ASC -
// first-pass-wins display order matches evaluation order.

export async function getAnswersForQuestion(
  questionId: string,
): Promise<AnswerRow[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("answers")
    .select("*")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`answers read failed: ${error.message}`);
  return (data as AnswerRow[]) ?? [];
}

export async function getAnswerRow(id: string): Promise<AnswerRow | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("answers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`answer read failed: ${error.message}`);
  return (data as AnswerRow) ?? null;
}
