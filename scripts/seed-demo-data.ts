// Phase 5 demo seeding — creates the 3 judge-facing questions on the target
// deployment (E2E_BASE_URL, default localhost):
//   1. PAID:     1 lazy answer rejected with reasons + 1 strong answer
//                accepted -> dual-tx receipt (escrow->agent, agent->winner).
//   2. OPEN:     long deadline (7 days), easy criteria so judges can submit
//                a passing answer themselves during review.
//   3. REFUNDED: real 10.5-minute deadline, waits it out, cron sweep marks
//                it expired, claimRefund returns the budget to the asker,
//                refund recorded -> refunded banner + Arcscan link.
// Total wall time ~13 min (dominated by the refund deadline wait).
// Run all:      E2E_BASE_URL=https://askbounty.vercel.app npx tsx scripts/seed-demo-data.ts
// Run one part: … seed-demo-data.ts --stage paid|open|refund-create
//               … seed-demo-data.ts --stage refund-finish --question <id>
// (staged runs let an orchestrator do the 11-min refund wait out-of-process)
import {
  api, BASE, createOpenQuestion, getAnswer, makeSigner, pause,
  preflightAskerBalance, publicClient, resolvePendingEval, submitAnswer,
  GOOD_ANSWER, LAZY_ANSWER,
} from "./phase3-test-helpers";
import { claimRefund } from "../lib/escrow/escrow-writes";

const REFUND_DEADLINE_MS = 10 * 60_000 + 30_000; // API minimum (10min) + margin

// Demo question 1 — answered + paid. Reuses the proven criteria/answer pair
// so the failed answer shows concrete per-check reasons and the strong one
// passes objective checks + LLM topics.
const PAID_Q = {
  title: "How do I paginate eth_getLogs on Arc when the range exceeds RPC limits?",
  body: [
    "I'm indexing PaymentReleased events from the AgenticCommerce contract on",
    "Arc Testnet. Once the block range grows past a few thousand blocks the",
    "public RPC starts rejecting my eth_getLogs calls. How should I page",
    "through large ranges reliably? I need chunking plus handling for chunks",
    "that fail mid-scan.",
  ].join(" "),
  budget: "2",
  criteria: {
    minWords: 50,
    mustIncludeCode: true,
    codeLanguage: "typescript",
    topics: ["chunked ranges", "failure handling"],
  },
};

// Demo question 2 — open, judge-answerable without writing code.
const OPEN_Q = {
  title: "What is the gas token on Arc Testnet and how do I get testnet funds?",
  body: [
    "I'm new to Arc. On other chains I pay gas in the native coin (ETH, MATIC).",
    "What do transactions on Arc Testnet use for gas, and what is the quickest",
    "way to get enough testnet funds to deploy and test a small contract?",
    "Mention the faucet and any gotchas about decimals.",
  ].join(" "),
  budget: "1",
  criteria: {
    minWords: 40,
    mustIncludeCode: false,
    topics: ["gas token", "faucet"],
  },
};

// Demo question 3 — expires with no answers, then refunded.
const REFUND_Q = {
  title: "Benchmark: Arc Testnet block times vs Base Sepolia under sustained load?",
  body: [
    "Looking for someone who has actually measured this: sustained-load block",
    "time and inclusion-latency numbers for Arc Testnet compared with Base",
    "Sepolia, including the methodology used (tx submission rate, measurement",
    "window, RPC endpoints). Charts optional, raw numbers required.",
  ].join(" "),
  budget: "1",
  criteria: {
    minWords: 120,
    mustIncludeCode: false,
    topics: ["block time measurements", "methodology"],
  },
};

async function seedPaidQuestion(asker: ReturnType<typeof makeSigner>) {
  const { questionId } = await createOpenQuestion(asker, PAID_Q.budget, PAID_Q.title, {
    body: PAID_Q.body,
    criteria: PAID_Q.criteria,
    deadlineMs: Date.now() + 2 * 24 * 3600_000,
  });

  // Lazy answer first: must FAIL with visible per-check reasons.
  const lazy = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, LAZY_ANSWER);
  if (lazy.status !== 200) throw new Error(`lazy submit failed: ${JSON.stringify(lazy.data)}`);
  const lazyRow = await resolvePendingEval(lazy.data.answer.id);
  console.log(`[paid-q] lazy answer -> ${lazyRow.status} (expect failed)`);

  // Strong answer: must PASS -> instant payout with the dual-tx receipt.
  const good = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER);
  if (good.status !== 200) throw new Error(`good submit failed: ${JSON.stringify(good.data)}`);
  let goodRow = await resolvePendingEval(good.data.answer.id);
  // Payout runs synchronously on accept; poll briefly until both txs recorded.
  for (let i = 0; i < 10 && goodRow.status === "accepted" && !goodRow.forward_tx; i++) {
    await pause(3000);
    goodRow = await getAnswer(good.data.answer.id);
  }
  console.log(`[paid-q] good answer -> ${goodRow.status}, payout ${goodRow.payout_status}`);
  console.log(`[paid-q] complete_tx ${goodRow.complete_tx}`);
  console.log(`[paid-q] forward_tx  ${goodRow.forward_tx}`);
  if (goodRow.status !== "accepted" || !goodRow.forward_tx) {
    throw new Error("paid demo question did not reach accepted+paid");
  }
  return questionId;
}

async function seedOpenQuestion(asker: ReturnType<typeof makeSigner>) {
  const { questionId } = await createOpenQuestion(asker, OPEN_Q.budget, OPEN_Q.title, {
    body: OPEN_Q.body,
    criteria: OPEN_Q.criteria,
    deadlineMs: Date.now() + 7 * 24 * 3600_000,
  });
  console.log(`[open-q] live with 7-day deadline`);
  return questionId;
}

// Stage 3a: create the soon-to-expire question. Returns immediately; the
// deadline must pass (10.5 min) before refund-finish can run.
async function seedRefundCreate(asker: ReturnType<typeof makeSigner>) {
  const deadlineAt = Date.now() + REFUND_DEADLINE_MS;
  const { questionId, jobId } = await createOpenQuestion(asker, REFUND_Q.budget, REFUND_Q.title, {
    body: REFUND_Q.body,
    criteria: REFUND_Q.criteria,
    deadlineMs: deadlineAt,
  });
  console.log(`[refund-q] created ${questionId} (job ${jobId}), deadline ${new Date(deadlineAt).toISOString()}`);
  return { questionId, deadlineAt };
}

// Stage 3b: after the deadline — sweep marks it expired, claimRefund returns
// the budget to the asker, and the refund is recorded (calldata-verified).
async function seedRefundFinish(
  asker: ReturnType<typeof makeSigner>, cronSecret: string, questionId: string,
) {
  const q = await api("GET", `/api/questions/${questionId}`);
  const jobId = q.data.question?.jobId;
  if (jobId == null) throw new Error(`question ${questionId} has no jobId`);
  const deadlineMs = Date.parse(q.data.question.deadline);
  const waitMs = deadlineMs - Date.now() + 30_000; // +30s block-time margin
  if (waitMs > 0) {
    console.log(`[refund-q] waiting ${Math.ceil(waitMs / 1000)}s for the real deadline…`);
    await pause(waitMs);
  }

  const swept = await fetch(`${BASE}/api/cron/sweep`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  }).then((r) => r.json());
  console.log(`[refund-q] sweep -> ${JSON.stringify(swept)}`);

  // Guard (review): claim ONLY once the DB says expired — a failed sweep
  // (bad CRON_SECRET) would otherwise empty the escrow while the question
  // stays 'open' and the /refund record 409s (inconsistent demo state).
  const afterSweep = await api("GET", `/api/questions/${questionId}`);
  if (afterSweep.data.question?.status !== "expired") {
    throw new Error(
      `sweep did not expire ${questionId} (status=${afterSweep.data.question?.status}) — check CRON_SECRET / deadline`,
    );
  }

  const refundHash = await claimRefund({ wallet: asker, publicClient }, BigInt(jobId));
  await pause(2000);
  const rec = await api("POST", `/api/questions/${questionId}/refund`, { refundTx: refundHash });
  if (rec.status !== 200 || rec.data.status !== "refunded") {
    throw new Error(`refund record failed: ${rec.status} ${JSON.stringify(rec.data)}`);
  }
  console.log(`[refund-q] refunded, tx ${refundHash}`);
  return questionId;
}

function cliArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET missing in .env.local");
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  const stage = cliArg("--stage"); // undefined = run everything
  // Budgets 2+1+1 USDC + gas headroom for createJob/approve/fund/claimRefund.
  await preflightAskerBalance(asker, stage ? 3_000_000n : 5_000_000n);
  console.log(`[seed] target ${BASE}${stage ? ` stage=${stage}` : ""}`);

  if (stage === "paid") {
    console.log(`paid+receipt : ${BASE}/q/${await seedPaidQuestion(asker)}`);
  } else if (stage === "open") {
    console.log(`open (7d)    : ${BASE}/q/${await seedOpenQuestion(asker)}`);
  } else if (stage === "refund-create") {
    const { questionId } = await seedRefundCreate(asker);
    console.log(`refund-pending: ${BASE}/q/${questionId} (run --stage refund-finish --question ${questionId} after the deadline)`);
  } else if (stage === "refund-finish") {
    const questionId = cliArg("--question");
    if (!questionId) throw new Error("--question <id> required for refund-finish");
    console.log(`refunded     : ${BASE}/q/${await seedRefundFinish(asker, cronSecret, questionId)}`);
  } else {
    const paidId = await seedPaidQuestion(asker);
    const openId = await seedOpenQuestion(asker);
    const { questionId: refundId } = await seedRefundCreate(asker);
    const refundedId = await seedRefundFinish(asker, cronSecret, refundId);
    console.log("\n===== DEMO QUESTIONS SEEDED =====");
    console.log(`paid+receipt : ${BASE}/q/${paidId}`);
    console.log(`open (7d)    : ${BASE}/q/${openId}`);
    console.log(`refunded     : ${BASE}/q/${refundedId}`);
  }
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
