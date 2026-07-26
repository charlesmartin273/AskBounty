// Phase 4 E2E - browse leak-proofing (C3) + activity data contract (C4).
// Fixture-driven (no chain writes). C4: an accepted answer whose payout has
// NOT completed must surface payoutStatus!=paid so the UI can never label it
// bare "accepted"; a paid answer must carry forwardTx + exact paidAmount.
// Run: npx tsx scripts/e2e-phase4-browse-activity.ts (dev server on :3002)
import { ensureWalletKey } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import { api, BASE, db, record, summarize } from "./phase3-test-helpers";

const FIX_ASKER = "0x000000000000000000000000000000000000f1x8";
const QIDS = ["qactfixlive00", "qactfixunpaid"] as const;

async function main() {
  const client = db();
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY")).address;
  await client.from("answers").delete().in("question_id", QIDS as unknown as string[]);
  await client.from("questions").delete().in("id", QIDS as unknown as string[]);

  // Fixtures: a live question (browse must show) + an answered question with
  // an accepted-but-UNPAID answer by the winner wallet (C4 target).
  for (const [id, title, status] of [
    ["qactfixlive00", "ACTFIX live browse row", "open"],
    ["qactfixunpaid", "ACTFIX accepted unpaid", "answered"],
  ] as const) {
    const { error } = await client.from("questions").insert({
      id, asker_address: FIX_ASKER, title, body: "activity fixture", budget: "1",
      net_payout: "1", criteria: { minWords: 1, mustIncludeCode: false, topics: [] },
      status, deadline: new Date(Date.now() + 3600_000).toISOString(),
    });
    if (error) throw new Error(`question fixture failed: ${error.message}`);
  }
  const { error: ansErr } = await client.from("answers").insert({
    question_id: "qactfixunpaid", answerer_address: winner, body: "fixture answer",
    status: "accepted", payout_status: null, content_hash: "0x0", signature: "0x0",
  });
  if (ansErr) throw new Error(`answer fixture failed: ${ansErr.message}`);

  // C3 via /browse HTML
  const html = await fetch(`${BASE}/browse`).then((r) => r.text());
  record("C3 browse lists live fixture, hides answered one",
    html.includes("ACTFIX live browse row") && !html.includes("ACTFIX accepted unpaid"),
    "/browse");

  // Activity API contract
  const bad = await api("GET", "/api/activity?address=nonsense");
  record("activity invalid address -> 400", bad.status === 400, `${bad.status}`);

  const act = await api("GET", `/api/activity?address=${winner}`);
  record("activity responds for winner wallet", act.status === 200,
    `${act.status} answered=${act.data.answered?.length}`);
  const rows = (act.data.answered ?? []) as {
    questionId: string; status: string; payoutStatus: string | null;
    forwardTx: string | null; paidAmount: string | null;
  }[];
  const unpaidFix = rows.find((a) => a.questionId === "qactfixunpaid");
  record("C4 accepted-but-unpaid answer exposes payoutStatus != 'paid'",
    !!unpaidFix && unpaidFix.status === "accepted" && unpaidFix.payoutStatus !== "paid",
    JSON.stringify(unpaidFix));
  const paidReal = rows.find((a) => a.status === "accepted" && a.payoutStatus === "paid");
  record("C4 real paid answer carries forwardTx + exact paidAmount",
    !!paidReal && !!paidReal.forwardTx && !!paidReal.paidAmount,
    `q=${paidReal?.questionId} amount=${paidReal?.paidAmount} tx=${paidReal?.forwardTx?.slice(0, 18)}`);

  // Asked tab for the dry-run asker (has many real questions from E2E)
  const asker = privateKeyToAccount(ensureWalletKey("DRYRUN_ASKER_PRIVATE_KEY")).address;
  const asked = await api("GET", `/api/activity?address=${asker}`);
  record("asked list returns the asker's questions",
    asked.status === 200 && (asked.data.asked?.length ?? 0) > 0,
    `asked=${asked.data.asked?.length}`);

  // /activity page route exists and renders (client page shell)
  const pageHtml = await fetch(`${BASE}/activity`).then((r) => r.text());
  record("R10 /activity route renders", pageHtml.includes("My activity"), "/activity");

  await client.from("answers").delete().in("question_id", QIDS as unknown as string[]);
  await client.from("questions").delete().in("id", QIDS as unknown as string[]);
  console.log("[cleanup] fixtures removed");
  summarize("PHASE 4 BROWSE + ACTIVITY (C3/C4)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
