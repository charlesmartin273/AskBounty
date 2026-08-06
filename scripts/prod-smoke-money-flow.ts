// One-off production smoke test for the RESKIN audit (step 5).
//
// Runs the full money flow against the LIVE production deployment using only
// the public HTTP API + real onchain writes - it never touches Supabase
// directly, so it works while .env.local points at the dev database.
//
// Verification reads the public question PAGE (server-rendered) and extracts
// both payout tx hashes from the receipt, which is exactly what a judge sees.
//
// Run: E2E_BASE_URL=https://askbounty.vercel.app npx tsx scripts/prod-smoke-money-flow.ts
import {
  BASE,
  createOpenQuestion,
  makeSigner,
  pause,
  preflightAskerBalance,
  submitAnswer,
} from "./phase3-test-helpers";

if (!BASE.startsWith("https://")) {
  throw new Error(`refusing to run: E2E_BASE_URL must be the production URL, got ${BASE}`);
}

const GOOD = [
  "Paginate eth_getLogs by splitting the block range into fixed-size chunks and",
  "querying them sequentially, so no single call can exceed the provider's cap.",
  "Track the last successfully processed block as durable state, and on a failed",
  "chunk retry that chunk alone with backoff rather than restarting the scan.",
  "Failure handling matters: a chunk that throws must not advance the cursor, or",
  "you silently drop events. Resume from the last processed block after a crash.",
  "",
  "```typescript",
  "async function getLogsChunked(client, filter, from: bigint, to: bigint) {",
  "  const CHUNK = 2000n;",
  "  const out = [];",
  "  for (let start = from; start <= to; start += CHUNK) {",
  "    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;",
  "    for (let attempt = 0; ; attempt++) {",
  "      try {",
  "        out.push(...(await client.getLogs({ ...filter, fromBlock: start, toBlock: end })));",
  "        break;",
  "      } catch (err) {",
  "        if (attempt >= 4) throw err;",
  "        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));",
  "      }",
  "    }",
  "  }",
  "  return out;",
  "}",
  "```",
].join("\n");

/**
 * Pull the tx that follows a given receipt label. Anchoring on the label is
 * what makes this correct: every hash appears twice in the response (once in
 * the HTML, once in the RSC payload), so a bare global match would report
 * duplicates rather than the two distinct legs.
 */
function txAfterLabel(html: string, label: string): string | null {
  const at = html.indexOf(`(${label})`);
  if (at < 0) return null;
  const m = html.slice(at, at + 900).match(/tx\/(0x[a-fA-F0-9]{64})/);
  return m ? m[1] : null;
}

/** Poll the public page until the payout receipt renders, then pull both legs. */
async function waitForReceipt(questionId: string, maxAttempts = 20) {
  for (let i = 1; i <= maxAttempts; i++) {
    const html = await (await fetch(`${BASE}/q/${questionId}`, { cache: "no-store" })).text();
    const complete = txAfterLabel(html, "complete");
    const forward = txAfterLabel(html, "forward");
    if (/Bounty paid/i.test(html) && complete && forward && complete !== forward) {
      return { complete, forward, html };
    }
    console.log(`[poll ${i}/${maxAttempts}] complete=${!!complete} forward=${!!forward}`);
    await pause(6000);
  }
  throw new Error("receipt did not appear in time");
}

async function main() {
  console.log(`[target] ${BASE}`);
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 1_000_000n);

  const { questionId, jobId } = await createOpenQuestion(
    asker,
    "1",
    "RESKIN smoke: paginate eth_getLogs on Arc",
    {
      criteria: {
        minWords: 50,
        mustIncludeCode: true,
        codeLanguage: "typescript",
        topics: ["chunked ranges", "failure handling"],
      },
      deadlineMs: Date.now() + 7 * 24 * 3600_000,
    },
  );

  // Submit through the production API. submitAnswer builds the exact signed
  // message the route verifies (questionId + content hash), so reuse it
  // rather than re-deriving the payload here.
  const submitted = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD);
  console.log(
    `[submit] status=${submitted.status} ${JSON.stringify(submitted.data).slice(0, 220)}`,
  );
  if (submitted.status !== 200) throw new Error("submit failed");

  const { complete, forward } = await waitForReceipt(questionId);

  console.log("\n===== PRODUCTION SMOKE: PASS =====");
  console.log(`question : ${BASE}/q/${questionId}  (job ${jobId})`);
  console.log(`complete : https://testnet.arcscan.app/tx/${complete}`);
  console.log(`forward  : https://testnet.arcscan.app/tx/${forward}`);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exitCode = 1;
});
