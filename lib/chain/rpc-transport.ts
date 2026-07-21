import { fallback, http } from "viem";
import { RPC_URL, RPC_URL_FALLBACK } from "./config";

// The public Arc Testnet RPC rate-limits bursts ("request limit reached",
// code -32011). Retry with backoff and fall back to the Blockscout proxy RPC
// when the primary rejects. Callers should also avoid parallel read bursts.
export function arcTransport() {
  return fallback([
    http(RPC_URL, { retryCount: 4, retryDelay: 1500 }),
    http(RPC_URL_FALLBACK, { retryCount: 3, retryDelay: 1500 }),
  ]);
}
