// Phase 4 E2E - cron sweep (C1) + browse leak-proofing (C3). DB fixtures
// only (the sweep never touches the chain): one open+past-deadline question
// must flip to expired; answered/draft/open-future rows must be untouched;
// a second run is idempotent. Browse must show ONLY the live fixture.
// Run: npx tsx scripts/e2e-phase4-cron-sweep.ts (dev server + CRON_SECRET)
import { BASE, db, record, summarize } from "./phase3-test-helpers";

const FIXTURES = [
  { id: "qcronfixpast0", title: "CRONFIX past-deadline open", status: "open", deltaMs: -3600_000 },
  { id: "qcronfixansw0", title: "CRONFIX answered", status: "answered", deltaMs: -3600_000 },
  { id: "qcronfixdraft", title: "CRONFIX draft unfunded", status: "draft", deltaMs: 3600_000 },
  { id: "qcronfixlive0", title: "CRONFIX live open", status: "open", deltaMs: 3600_000 },
] as const;

async function sweep(auth?: string) {
  const res = await fetch(`${BASE}/api/cron/sweep`, {
    headers: auth ? { Authorization: auth } : {},
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing in .env.local");
  const client = db();
  const ids = FIXTURES.map((f) => f.id);
  await client.from("answers").delete().in("question_id", ids);
  await client.from("questions").delete().in("id", ids);
  for (const f of FIXTURES) {
    const { error } = await client.from("questions").insert({
      id: f.id, asker_address: "0x000000000000000000000000000000000000f1x7",
      title: f.title, body: "cron fixture", budget: "1", net_payout: "1",
      criteria: { minWords: 1, mustIncludeCode: false, topics: [] },
      status: f.status, deadline: new Date(Date.now() + f.deltaMs).toISOString(),
    });
    if (error) throw new Error(`fixture insert failed: ${error.message}`);
  }

  // Auth (fail closed)
  const noAuth = await sweep();
  const badAuth = await sweep("Bearer wrong-secret");
  record("cron without/with wrong secret -> 401", noAuth.status === 401 && badAuth.status === 401,
    `none=${noAuth.status} wrong=${badAuth.status}`);

  // First run: only the open+past fixture flips
  const run1 = await sweep(`Bearer ${secret}`);
  record("cron with secret -> 200", run1.status === 200, JSON.stringify(run1.data));
  const { data: rows } = await client.from("questions").select("id, status").in("id", ids);
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r.status as string]));
  record("C1 open+past -> expired", byId.get("qcronfixpast0") === "expired",
    `status=${byId.get("qcronfixpast0")}`);
  record("answered/draft/live untouched",
    byId.get("qcronfixansw0") === "answered" && byId.get("qcronfixdraft") === "draft" &&
      byId.get("qcronfixlive0") === "open",
    `answered=${byId.get("qcronfixansw0")} draft=${byId.get("qcronfixdraft")} live=${byId.get("qcronfixlive0")}`);

  // Idempotent second run (nothing new to expire)
  const run2 = await sweep(`Bearer ${secret}`);
  record("second run idempotent (expired: 0)", run2.status === 200 && run2.data.expired === 0,
    JSON.stringify(run2.data));

  // C3: browse shows ONLY the live fixture
  const html = await fetch(`${BASE}/browse`).then((r) => r.text());
  record("C3 browse shows live question only",
    html.includes("CRONFIX live open") && !html.includes("CRONFIX past-deadline open") &&
      !html.includes("CRONFIX answered") && !html.includes("CRONFIX draft unfunded"),
    `/browse`);

  await client.from("questions").delete().in("id", ids);
  console.log("[cleanup] fixtures removed");
  summarize("PHASE 4 CRON SWEEP (C1/C3)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
