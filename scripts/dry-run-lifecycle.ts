// Phase 1 blocking gate: full ERC-8183 lifecycle on Arc Testnet with
// throwaway wallets. Resolves: (1) setBudget caller restriction,
// (2) live platformFeeBP/evaluatorFeeBP, (3) exact winner net payout.
// Run: npx tsx scripts/dry-run-lifecycle.ts
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import {
  createPublicClient,
  createWalletClient,
  keccak256,
  toBytes,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, arcscanTxUrl } from "../lib/chain/config";
import { arcTransport } from "../lib/chain/rpc-transport";
import { JOB_STATUS } from "../lib/chain/abi-agentic-commerce";
import {
  computeNetPayout,
  getJob,
  getUsdcBalance,
  readFeeBps,
} from "../lib/escrow/escrow-reads";
import {
  approveAndFund,
  completeJob,
  createJob,
  forwardToWinner,
  setBudget,
  submitDeliverable,
  type Signer,
} from "../lib/escrow/escrow-writes";

const BUDGET = 1_000_000n; // 1 USDC dry-run budget
const TWENTY_USDC = 20_000_000n; // reference bounty for the question page copy

// Pacing between steps keeps us under the public RPC's burst limit.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STEP_DELAY_MS = 2000;

function makeWallet(key: `0x${string}`): Signer {
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: arcTestnet,
    transport: arcTransport(),
  });
}

async function main() {
  const agentKey = ensureWalletKey("EVALUATOR_PRIVATE_KEY");
  const askerKey = ensureWalletKey("DRYRUN_ASKER_PRIVATE_KEY");
  const winnerKey = ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY");

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: arcTransport(),
  }) as PublicClient;
  const agent = makeWallet(agentKey);
  const asker = makeWallet(askerKey);
  const winner = privateKeyToAccount(winnerKey).address;
  const agentCtx = { wallet: agent, publicClient };
  const askerCtx = { wallet: asker, publicClient };

  console.log(`agent  = ${agent.account.address}`);
  console.log(`asker  = ${asker.account.address}`);
  console.log(`winner = ${winner}`);

  // (a) live fee BPs - never hardcode (PRD-ERRATA E2)
  const bps = await readFeeBps(publicClient);
  console.log(`\n[fees] platformFeeBP  = ${bps.platformFeeBP}`);
  console.log(`[fees] evaluatorFeeBP = ${bps.evaluatorFeeBP}`);
  const net20 = computeNetPayout(TWENTY_USDC, bps);
  console.log(`[fees] 20 USDC bounty -> winner receives ${usdcFmt(net20)}`);
  const netBudget = computeNetPayout(BUDGET, bps);
  console.log(`[fees] dry-run ${usdcFmt(BUDGET)} -> net ${usdcFmt(netBudget)}`);

  // balance preflight - gas on Arc is USDC; abort with funding instructions.
  // Sequential reads: the public RPC rate-limits parallel bursts.
  const askerBal = await getUsdcBalance(publicClient, asker.account.address);
  const agentBal = await getUsdcBalance(publicClient, agent.account.address);
  const askerNative = await publicClient.getBalance({ address: asker.account.address });
  const agentNative = await publicClient.getBalance({ address: agent.account.address });
  console.log(`\n[balances] asker ERC-20 ${usdcFmt(askerBal)} | native ${askerNative}`);
  console.log(`[balances] agent ERC-20 ${usdcFmt(agentBal)} | native ${agentNative}`);
  if (askerBal < BUDGET * 4n) {
    console.error(
      `\nABORT: fund the ASKER wallet with Arc Testnet USDC (https://faucet.circle.com, network "Arc Testnet", one 20 USDC drip is enough):\n` +
        `  asker ${asker.account.address} needs >= ${usdcFmt(BUDGET * 4n)} (budget + gas + agent top-up)\nThen re-run this script.`,
    );
    process.exitCode = 1;
    return;
  }
  // Single-faucet-drip flow: asker tops up the agent's gas so only one wallet
  // ever needs manual funding (gas on Arc is USDC).
  if (agentBal < 500_000n) {
    const topUpHash = await forwardToWinner(askerCtx, agent.account.address, 2_000_000n);
    console.log(`[top-up] asker -> agent 2 USDC gas tx=${arcscanTxUrl(topUpHash)}`);
    await pause(STEP_DELAY_MS);
  }

  // (b) asker creates the job (client=asker, provider=evaluator=agent)
  await pause(STEP_DELAY_MS);
  const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const { hash: createHash, jobId } = await createJob(askerCtx, {
    provider: agent.account.address,
    evaluator: agent.account.address,
    expiredAt,
    description: "dryrun",
  });
  console.log(`\n[createJob] jobId=${jobId} tx=${arcscanTxUrl(createHash)}`);

  // (c) setBudget caller resolution: agent first, asker on revert
  await pause(STEP_DELAY_MS);
  let setBudgetCaller: "agent (provider/evaluator)" | "asker (client)";
  let agentAttemptError = "";
  try {
    const h = await setBudget(agentCtx, jobId, BUDGET);
    setBudgetCaller = "agent (provider/evaluator)";
    console.log(`[setBudget] SUCCEEDED from AGENT tx=${arcscanTxUrl(h)}`);
  } catch (err) {
    agentAttemptError = err instanceof Error ? err.message.split("\n")[0] : String(err);
    console.log(`[setBudget] agent attempt REVERTED: ${agentAttemptError}`);
    await pause(STEP_DELAY_MS);
    const h = await setBudget(askerCtx, jobId, BUDGET);
    setBudgetCaller = "asker (client)";
    console.log(`[setBudget] SUCCEEDED from ASKER tx=${arcscanTxUrl(h)}`);
  }

  // (d) asker approves + funds escrow
  await pause(STEP_DELAY_MS);
  const { approveHash, fundHash } = await approveAndFund(askerCtx, jobId, BUDGET);
  console.log(`[approve] tx=${arcscanTxUrl(approveHash)}`);
  console.log(`[fund] tx=${arcscanTxUrl(fundHash)}`);
  console.log(`[fund] job status=${(await getJob(publicClient, jobId)).status} (expect ${JOB_STATUS.Funded}=Funded)`);

  // (e) agent submits deliverable hash
  await pause(STEP_DELAY_MS);
  const submitHash = await submitDeliverable(
    agentCtx,
    jobId,
    keccak256(toBytes("test answer")),
  );
  console.log(`[submit] tx=${arcscanTxUrl(submitHash)}`);

  // (f) agent completes -> escrow pays agent (provider remainder + evaluator fee)
  await pause(STEP_DELAY_MS);
  const agentBefore = await getUsdcBalance(publicClient, agent.account.address);
  const { hash: completeHash } = await completeJob(agentCtx, jobId, "dryrun pass");
  const agentAfter = await getUsdcBalance(publicClient, agent.account.address);
  console.log(`[complete] tx=${arcscanTxUrl(completeHash)}`);
  console.log(`[complete] agent delta=${usdcFmt(agentAfter - agentBefore)} (provider net + evaluator fee − gas)`);
  console.log(`[complete] job status=${(await getJob(publicClient, jobId)).status} (expect ${JOB_STATUS.Completed}=Completed)`);

  // (g)+(h) forward exact provider remainder to winner; verify to the unit
  await pause(STEP_DELAY_MS);
  const winnerBefore = await getUsdcBalance(publicClient, winner);
  const forwardHash = await forwardToWinner(agentCtx, winner, netBudget);
  const winnerAfter = await getUsdcBalance(publicClient, winner);
  const winnerDelta = winnerAfter - winnerBefore;
  console.log(`[forward] tx=${arcscanTxUrl(forwardHash)}`);
  console.log(`[forward] winner delta=${usdcFmt(winnerDelta)} expected=${usdcFmt(netBudget)}`);
  if (winnerDelta !== netBudget) {
    throw new Error("winner balance delta != computed net payout");
  }

  console.log(`\n===== DRY-RUN PASS =====`);
  console.log(`1. setBudget caller: ${setBudgetCaller}${agentAttemptError ? ` (agent attempt failed: ${agentAttemptError})` : ""}`);
  console.log(`2. platformFeeBP=${bps.platformFeeBP} evaluatorFeeBP=${bps.evaluatorFeeBP}`);
  console.log(`3. 20 USDC bounty -> winner receives EXACTLY ${usdcFmt(net20)}`);
  console.log(`payout tx (complete): ${arcscanTxUrl(completeHash)}`);
  console.log(`payout tx (forward):  ${arcscanTxUrl(forwardHash)}`);
}

main().catch((err) => {
  console.error("\nDRY-RUN FAILED:", err);
  process.exitCode = 1;
});
