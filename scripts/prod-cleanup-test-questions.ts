// One-off: clean up the 2 test questions created on production while
// verifying the answer-leak fix (qt5w1tyk0tj4, qoab3l2repdx). Both are real
// escrow, real deadline - no admin/cancel path exists (documented
// limitation, PRD-ERRATA), so this does the ONLY honest thing: wait for the
// real onchain deadline, sweep to expired, and claim the refund through the
// actual asker wallet that funded them. No DB writes from this machine -
// the sweep and the refund-record both go through the production HTTP API,
// so this runs correctly even though .env.local points at the dev project.
// The only local dependency is the asker's private key (chain-only, works
// against any Supabase project) and CRON_SECRET.
//
// Run: E2E_BASE_URL=https://askbounty.vercel.app npx tsx scripts/prod-cleanup-test-questions.ts
import { publicClient, makeSigner, pause } from "./phase3-test-helpers";
import { claimRefund } from "../lib/escrow/escrow-writes";

const BASE = process.env.E2E_BASE_URL;
if (!BASE?.startsWith("https://")) {
  throw new Error(`refusing to run: E2E_BASE_URL must be the production URL, got ${BASE}`);
}

const TARGETS = [
  { questionId: "qt5w1tyk0tj4", jobId: 165701n },
  { questionId: "qoab3l2repdx", jobId: 165704n },
];

async function apiGet(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function apiPost(path: string, body?: object, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function waitForRealExpiry() {
  const deadlines = await Promise.all(
    TARGETS.map((t) => apiGet(`/api/questions/${t.questionId}`)),
  );
  const latest = Math.max(...deadlines.map((d) => Date.parse(d.data.question.deadline)));
  const waitMs = latest - Date.now() + 30_000; // +30s block-time margin, same as e2e-phase4-refund
  if (waitMs > 0) {
    console.log(`[wait] ${Math.ceil(waitMs / 1000)}s until both questions truly expire…`);
    await pause(waitMs);
  }
}

async function main() {
  console.log(`[target] ${BASE}`);
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing in .env.local");
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");

  await waitForRealExpiry();

  // GET, not POST - the route only exports GET (app/api/cron/sweep/route.ts).
  const swept = await apiGet("/api/cron/sweep", { Authorization: `Bearer ${secret}` });
  console.log(`[sweep] status=${swept.status} ${JSON.stringify(swept.data)}`);

  for (const { questionId, jobId } of TARGETS) {
    const before = await apiGet(`/api/questions/${questionId}`);
    if (before.data.question?.status !== "expired") {
      throw new Error(`${questionId} not expired after sweep: ${before.data.question?.status}`);
    }

    const refundTx = await claimRefund({ wallet: asker, publicClient }, jobId);
    await pause(2000);
    const recorded = await apiPost(`/api/questions/${questionId}/refund`, { refundTx });
    console.log(
      `[${questionId}] refund tx=https://testnet.arcscan.app/tx/${refundTx} ` +
        `record=${recorded.status} status=${recorded.data.status}`,
    );
    if (recorded.status !== 200 || recorded.data.status !== "refunded") {
      throw new Error(`refund record failed for ${questionId}: ${JSON.stringify(recorded.data)}`);
    }
  }

  const browse = await (await fetch(`${BASE}/browse`, { cache: "no-store" })).text();
  const stillListed = TARGETS.filter((t) => browse.includes(t.questionId));
  console.log(
    stillListed.length === 0
      ? "\nboth questions gone from /browse"
      : `\nSTILL ON BROWSE: ${stillListed.map((t) => t.questionId).join(", ")}`,
  );

  console.log("\n===== PROD CLEANUP: DONE =====");
}

main().catch((e) => {
  console.error("CLEANUP FAILED:", e);
  process.exit(1);
});
