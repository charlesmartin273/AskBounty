import "server-only";
import { getSupabaseServerClient } from "../supabase/server-client";

// Per-wallet spam guard: one submission per question per wallet per minute.
// Cheap DB check that runs BEFORE the (costly) LLM evaluation path.
export const COOLDOWN_SECONDS = 60;

export async function checkSubmissionCooldown(
  questionId: string,
  answerer: string,
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("answers")
    .select("created_at")
    .eq("question_id", questionId)
    // Addresses are stored checksummed - compare case-insensitively. The
    // address contains no LIKE wildcards, so ilike is an exact match here.
    .ilike("answerer_address", answerer)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`cooldown read failed: ${error.message}`);

  const last = data?.[0]?.created_at as string | undefined;
  if (!last) return { blocked: false, retryAfterSeconds: 0 };
  const elapsedSeconds = (Date.now() - Date.parse(last)) / 1000;
  if (elapsedSeconds >= COOLDOWN_SECONDS) {
    return { blocked: false, retryAfterSeconds: 0 };
  }
  return {
    blocked: true,
    retryAfterSeconds: Math.ceil(COOLDOWN_SECONDS - elapsedSeconds),
  };
}
