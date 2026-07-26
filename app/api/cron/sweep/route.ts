import { NextResponse } from "next/server";
import { jsonError } from "@/lib/questions/question-api-helpers";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

// GET /api/cron/sweep - daily Vercel cron (vercel.json, Hobby plan = 1×/day).
// Deliberately does ONE thing (user constraint C1): flip open questions whose
// deadline has passed to 'expired', which is what unlocks the asker's
// claim-refund button on /q/[id]. NO realtime work here - stuck evaluations
// and payouts have their own manual Retry buttons; the sweep never touches
// the chain or the agent wallet.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: with no secret configured the endpoint is unusable rather
  // than open.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "unauthorized");
  }

  const db = getSupabaseServerClient();
  // CAS on status='open': answered/refunded/draft rows are untouchable by
  // construction, and a question accepted mid-sweep loses the race safely.
  const { data, error } = await db
    .from("questions")
    .update({ status: "expired" })
    .eq("status", "open")
    .lt("deadline", new Date().toISOString())
    .select("id");
  if (error) return jsonError(500, `sweep failed: ${error.message}`);

  const expired = data?.map((r) => r.id as string) ?? [];
  return NextResponse.json({ expired: expired.length, ids: expired });
}
