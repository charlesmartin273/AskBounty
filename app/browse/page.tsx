import { QuestionCard, type BrowseQuestion } from "@/components/browse/question-card";
import { SiteNav } from "@/components/site-nav";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Open bounties" };

// Public browse list (C3): ONLY live questions. status='open' is granted
// exclusively by the finalize route AFTER onchain-verifying Funded + budget
// matches the promise (Phase 2 live guard), so drafts/unfunded rows can
// never appear here; the deadline predicate hides expired-but-not-yet-swept
// rows between daily cron runs.
export default async function BrowsePage() {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("questions")
    .select("id, title, budget::text, net_payout::text, deadline")
    .eq("status", "open")
    .gt("deadline", new Date().toISOString())
    .order("budget", { ascending: false })
    .limit(50);
  if (error) throw new Error(`browse read failed: ${error.message}`);

  const questions: BrowseQuestion[] = (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    budget: String(r.budget),
    netPayout: String(r.net_payout ?? r.budget),
    deadline: r.deadline as string,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <SiteNav />
      <h1 className="text-2xl font-semibold">Open bounties</h1>
      <p className="text-sm text-muted-foreground">
        Every listed bounty is provably funded in escrow. First answer that
        passes all criteria wins.
      </p>
      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No open bounties right now — be the first to ask one.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      )}
    </main>
  );
}
