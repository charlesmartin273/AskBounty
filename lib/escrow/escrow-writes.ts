import {
  bytesToHex,
  pad,
  parseEventLogs,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { agenticCommerceAbi } from "../chain/abi-agentic-commerce";
import { usdcAbi } from "../chain/abi-usdc";
import { AGENTIC_COMMERCE, USDC_ADDRESS } from "../chain/config";

// Wallet with account + chain baked in (agent wallet or a throwaway signer).
export type Signer = WalletClient<Transport, Chain, Account>;

interface Ctx {
  wallet: Signer;
  publicClient: PublicClient;
}

const NO_OPT_PARAMS = "0x" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// complete()/reject() reasons are bytes32 onchain (not string) — truncate at
// the BYTE level and right-pad. No string round-trip: decoding a dangling
// multibyte UTF-8 sequence would inject U+FFFD and overflow 32 bytes.
export function toBytes32Reason(reason: string): `0x${string}` {
  const truncated = new TextEncoder().encode(reason).slice(0, 32);
  return pad(bytesToHex(truncated), { size: 32, dir: "right" });
}

async function writeAndWait(ctx: Ctx, send: () => Promise<`0x${string}`>) {
  const hash = await send();
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Tx reverted: ${hash}`);
  }
  return { hash, receipt };
}

// createJob(provider, evaluator, expiredAt, description, hook).
// Returns jobId decoded from the JobCreated event in the receipt.
export async function createJob(
  ctx: Ctx,
  args: {
    provider: `0x${string}`;
    evaluator: `0x${string}`;
    expiredAt: bigint;
    description: string;
  },
): Promise<{ hash: `0x${string}`; jobId: bigint }> {
  const { hash, receipt } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "createJob",
      args: [
        args.provider,
        args.evaluator,
        args.expiredAt,
        args.description,
        ZERO_ADDRESS, // no hook
      ],
    }),
  );
  const [created] = parseEventLogs({
    abi: agenticCommerceAbi,
    eventName: "JobCreated",
    logs: receipt.logs,
  });
  if (!created) throw new Error(`JobCreated event missing in tx ${hash}`);
  return { hash, jobId: created.args.jobId };
}

export async function setBudget(ctx: Ctx, jobId: bigint, amount: bigint) {
  const { hash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "setBudget",
      args: [jobId, amount, NO_OPT_PARAMS],
    }),
  );
  return hash;
}

// Approves exactly `amount` USDC then fund(jobId) — pulls USDC from caller.
export async function approveAndFund(ctx: Ctx, jobId: bigint, amount: bigint) {
  const { hash: approveHash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "approve",
      args: [AGENTIC_COMMERCE, amount],
    }),
  );
  const { hash: fundHash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "fund",
      args: [jobId, NO_OPT_PARAMS],
    }),
  );
  return { approveHash, fundHash };
}

// submit(jobId, deliverable) — deliverable is keccak256(answerBody), anchoring
// the winning answer onchain.
export async function submitDeliverable(
  ctx: Ctx,
  jobId: bigint,
  deliverableHash: `0x${string}`,
) {
  const { hash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "submit",
      args: [jobId, deliverableHash, NO_OPT_PARAMS],
    }),
  );
  return hash;
}

// complete(jobId, reason) — evaluator-only; splits budget into platform fee,
// evaluator fee and provider remainder (PRD-ERRATA E2).
export async function completeJob(ctx: Ctx, jobId: bigint, reason: string) {
  const { hash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "complete",
      args: [jobId, toBytes32Reason(reason), NO_OPT_PARAMS],
    }),
  );
  return hash;
}

// claimRefund(jobId) — client-only (PRD-ERRATA E3); exposed for the asker
// wallet path in the UI, never callable by the agent.
export async function claimRefund(ctx: Ctx, jobId: bigint) {
  const { hash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: AGENTIC_COMMERCE,
      abi: agenticCommerceAbi,
      functionName: "claimRefund",
      args: [jobId],
    }),
  );
  return hash;
}

// Second hop of Option B: agent forwards the provider remainder to the winner
// as a plain USDC transfer. Gas absorbed by agent, never deducted from winner.
export async function forwardToWinner(
  ctx: Ctx,
  winner: `0x${string}`,
  amount: bigint,
) {
  const { hash } = await writeAndWait(ctx, () =>
    ctx.wallet.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "transfer",
      args: [winner, amount],
    }),
  );
  return hash;
}
