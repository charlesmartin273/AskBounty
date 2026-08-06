// AUDIT GATE step 3 - edge cases for Phase 1. Run after a passing
// dry-run-lifecycle.ts. Onchain negative tests rely on viem's gas-estimation
// revert (no gas spent on expected failures).
// Run: npx tsx scripts/dry-run-edge-cases.ts <completedJobId>
import { ensureWalletKey } from "./dry-run-wallet-setup";
import { createPublicClient, createWalletClient, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, arcscanTxUrl } from "../lib/chain/config";
import { arcTransport } from "../lib/chain/rpc-transport";
import { computeNetPayout } from "../lib/escrow/escrow-reads";
import {
  completeJob,
  createJob,
  setBudget,
  toBytes32Reason,
  type Signer,
} from "../lib/escrow/escrow-writes";
import { agenticCommerceAbi } from "../lib/chain/abi-agentic-commerce";
import { AGENTIC_COMMERCE } from "../lib/chain/config";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: string[] = [];
const record = (name: string, pass: boolean, detail: string) => {
  results.push(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
  console.log(results[results.length - 1]);
};

function makeWallet(key: `0x${string}`): Signer {
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: arcTestnet,
    transport: arcTransport(),
  });
}

async function main() {
  const completedJobId = BigInt(process.argv[2] ?? "158903");

  // --- Edge 1 (in-process): computeNetPayout integer math with nonzero BPs
  const bps = { platformFeeBP: 250n, evaluatorFeeBP: 250n };
  const net = computeNetPayout(333_333n, bps); // fees floor to 8333 each
  record(
    "computeNetPayout rounding",
    net === 316_667n && computeNetPayout(0n, bps) === 0n,
    `net(333333, 2.5%+2.5%)=${net} (expect 316667), net(0)=0`,
  );

  // --- Edge 2 (in-process): bytes32 reason with long unicode input,
  // including a truncation boundary that splits a multibyte char (review H1)
  let e2 = true;
  let e2detail = "";
  try {
    const inputs = [
      "đánh giá đạt ✓ - very long reason ".repeat(10),
      "a".repeat(30) + "é", // byte 31/32 lands mid-char - H1 repro
      "a".repeat(31) + "✓", // 3-byte char split at byte 32
    ];
    e2 = inputs.every((s) => toBytes32Reason(s).length === 66); // 0x + 32 bytes
    e2detail = `all ${inputs.length} inputs -> 32-byte value`;
  } catch (err) {
    e2 = false;
    e2detail = String(err);
  }
  record("toBytes32Reason unicode + split boundary", e2, e2detail);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: arcTransport(),
  }) as PublicClient;
  const agent = makeWallet(ensureWalletKey("EVALUATOR_PRIVATE_KEY"));
  const asker = makeWallet(ensureWalletKey("DRYRUN_ASKER_PRIVATE_KEY"));
  const agentCtx = { wallet: agent, publicClient };
  const askerCtx = { wallet: asker, publicClient };

  // --- Edge 3 (onchain): can the CLIENT also call setBudget? (fresh job)
  await pause(2000);
  const { jobId } = await createJob(askerCtx, {
    provider: agent.account.address,
    evaluator: agent.account.address,
    expiredAt: BigInt(Math.floor(Date.now() / 1000) + 600),
    description: "edgecase",
  });
  await pause(2000);
  try {
    const h = await setBudget(askerCtx, jobId, 100_000n);
    record("setBudget from client (asker)", true, `ALSO ALLOWED - tx=${arcscanTxUrl(h)}`);
  } catch (err) {
    record(
      "setBudget from client (asker)",
      true,
      `REVERTED (provider/admin-only): ${err instanceof Error ? err.message.split("\n")[0] : err}`,
    );
  }

  // --- Edge 4 (onchain): fund a job with a REAL budget but no approve must
  // revert on allowance. (A zero-budget job funds fine without approve -
  // transferFrom(0) - separate finding recorded by the first run.)
  await pause(2000);
  const { jobId: jobId2 } = await createJob(askerCtx, {
    provider: agent.account.address,
    evaluator: agent.account.address,
    expiredAt: BigInt(Math.floor(Date.now() / 1000) + 600),
    description: "edgecase-fund",
  });
  await pause(2000);
  await setBudget(agentCtx, jobId2, 100_000n);
  await pause(2000);
  try {
    await askerCtx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "fund",
      args: [jobId2, "0x"],
    });
    record("fund without approve (budget>0)", false, "unexpectedly succeeded");
  } catch (err) {
    record(
      "fund without approve (budget>0)",
      true,
      `reverted as expected: ${err instanceof Error ? err.message.split("\n")[0] : err}`,
    );
  }

  // --- Edge 5 (onchain): double-complete on an already Completed job
  await pause(2000);
  try {
    await completeJob(agentCtx, completedJobId, "double complete");
    record("double complete", false, `unexpectedly succeeded on job ${completedJobId}`);
  } catch (err) {
    record(
      "double complete",
      true,
      `reverted as expected: ${err instanceof Error ? err.message.split("\n")[0] : err}`,
    );
  }

  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n===== EDGE CASES: ${results.length - failed}/${results.length} PASS =====`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("EDGE-CASE RUN FAILED:", err);
  process.exitCode = 1;
});
