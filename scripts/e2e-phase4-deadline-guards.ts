// Phase 4 PERMANENT regression E2E — the two deadline guards (review M2,
// user-approved fix): an answer must NEVER be accepted after the question's
// deadline, and the failure reason must be honest (distinct from a content
// failure). Exercised through the REAL retry route:
//   Guard 1: deadline already past when evaluation starts -> failed BEFORE
//            any Gemini call (no results array, exact reason).
//   Guard 2: deadline passes DURING the evaluation (fixture deadline ~1s
//            ahead; Gemini latency >= ~1.5s) -> eval completes and PASSES,
//            but the accept is blocked (results include topics_covered=true,
//            same exact reason, question never flips, no payout tx).
// Run: npx tsx scripts/e2e-phase4-deadline-guards.ts (dev server + GEMINI key)
import { api, db, record, summarize } from "./phase3-test-helpers";

// Must match DEADLINE_MISS_REASON in lib/answers/process-answer-evaluation.ts
// verbatim — asserting the honest user-facing copy is the point.
const REASON =
  "Submitted in time, but evaluation did not finish before the deadline. " +
  "The bounty was refunded to the asker.";

const FIX_ASKER = "0x000000000000000000000000000000000000f1x9";
const QIDS = ["qdlguardpast0", "qdlguardrace0"];

async function makeFixture(
  client: ReturnType<typeof db>,
  id: string,
  deadlineMs: number,
) {
  const { error: qErr } = await client.from("questions").insert({
    id, asker_address: FIX_ASKER, title: `DLGUARD ${id}`,
    body: "What is 9 + 10? Reply with the number.", budget: "1", net_payout: "1",
    criteria: { minWords: 1, mustIncludeCode: false, topics: [] },
    status: "open", deadline: new Date(deadlineMs).toISOString(),
  });
  if (qErr) throw new Error(`question fixture: ${qErr.message}`);
  // Pending answer with a recorded eval error — the state the retry route
  // legitimately re-evaluates (exactly the M2 window).
  const { data, error: aErr } = await client.from("answers").insert({
    question_id: id, answerer_address: "0x000000000000000000000000000000000000a1x9",
    body: "19", status: "pending", content_hash: "0x0", signature: "0x0",
    eval_results: { error: { code: "rate_limited", message: "fixture", retryable: true } },
  }).select("id").single();
  if (aErr || !data) throw new Error(`answer fixture: ${aErr?.message}`);
  return data.id as string;
}

async function main() {
  const client = db();
  await client.from("answers").delete().in("question_id", QIDS);
  await client.from("questions").delete().in("id", QIDS);

  // ---- Guard 1: deadline long past when the retry starts ----
  const a1 = await makeFixture(client, "qdlguardpast0", Date.now() - 3600_000);
  const t0 = Date.now();
  const r1 = await api("POST", `/api/answers/${a1}/retry`);
  const g1ms = Date.now() - t0;
  record("guard1 retry on past-deadline question -> failed",
    r1.status === 200 && r1.data.answer?.status === "failed",
    `${r1.status} status=${r1.data.answer?.status} in ${g1ms}ms`);
  record("guard1 EXACT honest reason (not a content failure)",
    r1.data.answer?.evalResults?.failReason === REASON,
    `"${r1.data.answer?.evalResults?.failReason}"`);
  record("guard1 fired BEFORE the LLM (no check results, fast return)",
    !r1.data.answer?.evalResults?.results && g1ms < 5000,
    `results=${JSON.stringify(r1.data.answer?.evalResults?.results)} ${g1ms}ms`);

  // ---- Guard 2: deadline passes DURING the evaluation ----
  const a2 = await makeFixture(client, "qdlguardrace0", Date.now() + 1200);
  const r2 = await api("POST", `/api/answers/${a2}/retry`);
  const res2 = r2.data.answer?.evalResults;
  const topics = res2?.results?.find(
    (r: { check: string }) => r.check === "topics_covered",
  );
  record("guard2 answer failed despite a PASSING evaluation",
    r2.status === 200 && r2.data.answer?.status === "failed" && topics?.pass === true,
    `status=${r2.data.answer?.status} topics_covered=${topics?.pass} (eval DID run and pass)`);
  record("guard2 EXACT honest reason", res2?.failReason === REASON, `"${res2?.failReason}"`);
  const { data: q2 } = await client.from("questions").select("status").eq("id", "qdlguardrace0").single();
  const { data: a2row } = await client.from("answers").select("status, complete_tx, payout_status").eq("id", a2).single();
  record("guard2 question never flipped, no payout started",
    q2?.status === "open" && a2row?.status === "failed" && !a2row?.complete_tx && !a2row?.payout_status,
    `question=${q2?.status} answer=${a2row?.status} complete_tx=${a2row?.complete_tx}`);

  await client.from("answers").delete().in("question_id", QIDS);
  await client.from("questions").delete().in("id", QIDS);
  console.log("[cleanup] fixtures removed");
  summarize("PHASE 4 DEADLINE GUARDS (M2)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
