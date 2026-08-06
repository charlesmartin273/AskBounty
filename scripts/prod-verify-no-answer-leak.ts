// One-off: verify the answer-leak fix on the LIVE production deployment.
// Runs entirely over the public HTTP API + polling the public question page
// - no Supabase credentials needed, so it works while .env.local points at
// the dev database (see scripts/prod-smoke-money-flow.ts for the same
// pattern). Reuses the "sterile clone fruit" trivia shape from
// scripts/e2e-phase3-no-answer-leak.ts.
//
// Run: E2E_BASE_URL=https://askbounty.vercel.app npx tsx scripts/prod-verify-no-answer-leak.ts
import { createOpenQuestion, makeSigner, pause, preflightAskerBalance, submitAnswer } from "./phase3-test-helpers";

const BASE = process.env.E2E_BASE_URL;
if (!BASE?.startsWith("https://")) {
  throw new Error(`refusing to run: E2E_BASE_URL must be the production URL, got ${BASE}`);
}

const SECRET_TERMS = ["banana", "cavendish"];

async function waitForFailedVerdict(questionId: string, maxAttempts = 15) {
  for (let i = 1; i <= maxAttempts; i++) {
    const html = await (await fetch(`${BASE}/q/${questionId}`, { cache: "no-store" })).text();
    const idx = html.indexOf("does not address");
    const idx2 = html.indexOf("factually incorrect");
    const idx3 = html.indexOf("identifies the correct fruit");
    if (idx >= 0 || idx2 >= 0 || idx3 >= 0) return html;
    console.log(`[poll ${i}/${maxAttempts}] verdict not rendered yet`);
    await pause(6000);
  }
  throw new Error("verdict did not appear in time");
}

async function main() {
  console.log(`[target] ${BASE}`);
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 1_000_000n);

  const { questionId } = await createOpenQuestion(
    asker,
    "1",
    "PROD verify no-answer-leak: the sterile clone fruit",
    {
      body: [
        "Which fruit sold in nearly every supermarket worldwide is, genetically,",
        "a single sterile clone that can only be propagated by cuttings rather",
        "than from seed - and name the specific commercial cultivar involved.",
      ].join(" "),
      criteria: {
        minWords: 1,
        mustIncludeCode: false,
        topics: ["identifies the correct fruit", "names the correct cultivar"],
      },
      deadlineMs: Date.now() + 3600_000,
    },
  );

  const submitted = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, "melon");
  console.log(`[submit] status=${submitted.status}`);
  if (submitted.status !== 200) throw new Error(`submit failed: ${JSON.stringify(submitted.data)}`);

  const html = await waitForFailedVerdict(questionId);

  // Extract the visible verdict line for inspection.
  const start = html.indexOf("topics_covered") - 1;
  const around = html.slice(Math.max(0, start), start + 500).replace(/<[^>]+>/g, " ").trim();

  const lower = html.toLowerCase();
  const leaked = SECRET_TERMS.find((t) => lower.includes(t));

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`verdict text near "topics_covered":\n  ${around.slice(0, 300)}`);
  console.log(leaked ? `\nLEAK DETECTED: "${leaked}" found in page` : "\nNo leak: neither secret term found on the page");

  if (leaked) {
    console.error("PROD VERIFY FAILED");
    process.exitCode = 1;
    return;
  }
  console.log("\n===== PROD VERIFY: PASS =====");
}

main().catch((e) => {
  console.error("PROD VERIFY FAILED:", e);
  process.exitCode = 1;
});
