// Shared plumbing for the Phase 3 E2E scripts: drives the REAL API routes
// (dev server :3000) + real Arc Testnet txs with the dry-run throwaway
// wallets. NO server-only imports here — scripts run under tsx.
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../lib/chain/config";
import { arcTransport } from "../lib/chain/rpc-transport";
import { getUsdcBalance } from "../lib/escrow/escrow-reads";
import { approveAndFund, createJob, type Signer } from "../lib/escrow/escrow-writes";
import {
  buildAnswerMessage,
  contentHashOf,
} from "../lib/auth/verify-submission-signature";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const results: string[] = [];
export const record = (name: string, pass: boolean, detail: string) => {
  results.push(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
  console.log(results[results.length - 1]);
};
export function summarize(label: string) {
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n===== ${label}: ${results.length - failed}/${results.length} PASS =====`);
  if (failed > 0) process.exit(1);
}

export async function api(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: arcTransport(),
}) as PublicClient;

export function makeSigner(envVar: string): Signer {
  return createWalletClient({
    account: privateKeyToAccount(ensureWalletKey(envVar)),
    chain: arcTestnet,
    transport: arcTransport(),
  }) as Signer;
}

// Service-role DB client for test assertions/tampering (values from .env.local).
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const CRITERIA = {
  minWords: 50,
  mustIncludeCode: true,
  codeLanguage: "typescript",
  topics: ["chunked ranges", "failure handling"],
};

// Genuinely strong answer (passes objective checks + Gemini on both topics).
export const GOOD_ANSWER = `To paginate getLogs on Arc when the range exceeds RPC
limits, split the block range into fixed-size chunks and query sequentially,
retrying failed chunks with backoff:

\`\`\`typescript
async function getLogsChunked(client, filter, from: bigint, to: bigint) {
  const CHUNK = 2000n;
  const logs = [];
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logs.push(...await client.getLogs({ ...filter, fromBlock: start, toBlock: end }));
        break;
      } catch (err) {
        if (attempt === 2) throw err; // chunk failed 3x — surface it
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  return logs;
}
\`\`\`

Chunk size matters: Arc's public RPC caps result sets, so 2000 blocks per
request stays under the limit. On chunk failure we retry the same chunk with
exponential backoff and only fail the whole scan after 3 attempts, so one
flaky range never loses the rest of the results.`;

export const LAZY_ANSWER = "Just use a smaller block range or a paid RPC provider.";

// Creates a draft via the API, then walks the funding wizard for real:
// createJob (asker) -> /job -> /set-budget (agent backend) -> approve+fund
// (asker) -> /finalize. Returns a LIVE question.
export async function createOpenQuestion(
  asker: Signer,
  budgetUsdc: string,
  title: string,
  opts?: { body?: string; criteria?: object; deadlineMs?: number },
) {
  const created = await api("POST", "/api/questions", {
    askerAddress: asker.account.address,
    title,
    body:
      opts?.body ??
      "How to page getLogs when the range exceeds RPC limits? Needs chunking + retry.",
    budget: budgetUsdc,
    deadline: new Date(opts?.deadlineMs ?? Date.now() + 3600_000).toISOString(),
    criteria: opts?.criteria ?? CRITERIA,
  });
  if (created.status !== 200) {
    throw new Error(`create failed: ${JSON.stringify(created.data)}`);
  }
  const { questionId, agentAddress, deadlineUnix, budgetRaw } = created.data;
  const askerCtx = { wallet: asker, publicClient };
  await pause(1500);
  const { hash: createTx, jobId } = await createJob(askerCtx, {
    provider: agentAddress,
    evaluator: agentAddress,
    expiredAt: BigInt(deadlineUnix),
    description: questionId,
  });
  const job = await api("POST", `/api/questions/${questionId}/job`, {
    jobId: jobId.toString(),
    createTx,
  });
  if (job.status !== 200) throw new Error(`/job failed: ${JSON.stringify(job.data)}`);
  await pause(1500);
  const sb = await api("POST", `/api/questions/${questionId}/set-budget`);
  if (sb.status !== 200) throw new Error(`set-budget failed: ${JSON.stringify(sb.data)}`);
  await pause(1500);
  const { fundHash } = await approveAndFund(askerCtx, jobId, BigInt(budgetRaw));
  const fin = await api("POST", `/api/questions/${questionId}/finalize`, { fundTx: fundHash });
  if (fin.status !== 200) throw new Error(`finalize failed: ${JSON.stringify(fin.data)}`);
  console.log(`[question] ${questionId} live, job ${jobId}, budget ${budgetUsdc} USDC`);
  return { questionId, jobId, budgetRaw: BigInt(budgetRaw), agentAddress };
}

// Sign + submit an answer with a throwaway key (offchain signature, no gas).
export async function submitAnswer(envVar: string, questionId: string, body: string) {
  const account = privateKeyToAccount(ensureWalletKey(envVar));
  const signature = await account.signMessage({
    message: buildAnswerMessage(questionId, contentHashOf(body)),
  });
  return api("POST", "/api/answers", {
    questionId,
    body,
    address: account.address,
    signature,
  });
}

// Re-runs evaluation via the retry endpoint until the answer leaves the
// pending+error state (Gemini free tier can 429 under concurrency).
export async function resolvePendingEval(answerId: string, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const row = await getAnswer(answerId);
    if (row.status !== "pending" || !row.eval_results?.error) return row;
    console.log(`[retry-eval] ${answerId} attempt ${i + 1} (${row.eval_results.error.code})`);
    await pause(5000);
    await api("POST", `/api/answers/${answerId}/retry`);
  }
  return getAnswer(answerId);
}

export async function getAnswer(answerId: string) {
  const { data, error } = await db().from("answers").select("*").eq("id", answerId).single();
  if (error) throw new Error(`answer read failed: ${error.message}`);
  return data as {
    id: string;
    question_id: string;
    answerer_address: string;
    status: string;
    eval_results: {
      results?: { check: string; pass: boolean; detail: string }[];
      error?: { code: string; retryable: boolean } | null;
      failReason?: string;
      paid?: { amount: string; discrepancy?: { expectedNet: string; released: string } };
      payoutError?: string;
    } | null;
    complete_tx: string | null;
    forward_tx: string | null;
    payout_status: string | null;
  };
}

// Preflight: the asker throwaway pays budgets + gas for every E2E question.
export async function preflightAskerBalance(asker: Signer, neededRaw: bigint) {
  const bal = await getUsdcBalance(publicClient, asker.account.address);
  console.log(`[preflight] asker ${asker.account.address} balance ${usdcFmt(bal)}`);
  if (bal < neededRaw) {
    console.error(
      `ABORT: asker needs >= ${usdcFmt(neededRaw)}. Fund via https://faucet.circle.com (network "Arc Testnet") and re-run.`,
    );
    process.exit(1);
  }
}
