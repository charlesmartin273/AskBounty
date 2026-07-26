import type { PublicClient } from "viem";
import { agenticCommerceAbi } from "../chain/abi-agentic-commerce";
import { usdcAbi } from "../chain/abi-usdc";
import { AGENTIC_COMMERCE, USDC_ADDRESS } from "../chain/config";

export interface FeeBps {
  platformFeeBP: bigint;
  evaluatorFeeBP: bigint;
}

// Fee BPs are admin-mutable onchain state - always read live, never hardcode
// (PRD-ERRATA E2).
export async function readFeeBps(client: PublicClient): Promise<FeeBps> {
  // Sequential on purpose - the public Arc RPC rate-limits parallel bursts.
  const platformFeeBP = await client.readContract({
    address: AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: "platformFeeBP",
  });
  const evaluatorFeeBP = await client.readContract({
    address: AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: "evaluatorFeeBP",
  });
  return { platformFeeBP, evaluatorFeeBP };
}

// Winner net = budget − platformFee − evaluatorFee, mirroring the contract's
// integer math exactly: each fee is floor(amount * bp / 10000), remainder to
// provider. bigint only - never float (6-decimal USDC units).
export function computeNetPayout(budget: bigint, bps: FeeBps): bigint {
  const platformFee = (budget * bps.platformFeeBP) / 10000n;
  const evaluatorFee = (budget * bps.evaluatorFeeBP) / 10000n;
  return budget - platformFee - evaluatorFee;
}

export async function getJob(client: PublicClient, jobId: bigint) {
  return client.readContract({
    address: AGENTIC_COMMERCE,
    abi: agenticCommerceAbi,
    functionName: "getJob",
    args: [jobId],
  });
}

export async function getUsdcBalance(
  client: PublicClient,
  account: `0x${string}`,
): Promise<bigint> {
  return client.readContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [account],
  });
}
