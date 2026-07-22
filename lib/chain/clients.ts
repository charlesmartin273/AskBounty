import "server-only";
import { createPublicClient, createWalletClient, nonceManager } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./config";
import { arcTransport } from "./rpc-transport";

// Read-only client — safe anywhere on the server.
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: arcTransport(),
});

// Agent wallet (provider + evaluator per Option B, see PRD-ERRATA E1).
// Server-only: signs setBudget/submit/complete and the winner forward tx.
// Lazy so that merely importing this module never throws when the key is
// absent (e.g. during build).
let cachedAgentWallet: ReturnType<typeof buildAgentWallet> | null = null;

function buildAgentWallet() {
  const key = process.env.EVALUATOR_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "EVALUATOR_PRIVATE_KEY is not set — agent wallet unavailable",
    );
  }
  return createWalletClient({
    // nonceManager tracks pending nonces in-process (H2) — paired with the
    // withAgentWallet queue so concurrent requests never collide on nonces.
    account: privateKeyToAccount(key as `0x${string}`, { nonceManager }),
    chain: arcTestnet,
    transport: arcTransport(),
  });
}

export function getAgentWalletClient() {
  cachedAgentWallet ??= buildAgentWallet();
  return cachedAgentWallet;
}
