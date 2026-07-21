import { defineChain } from "viem";

// Arc Testnet — gas is paid in USDC (native). Public constants fall back to
// PRD Appendix values so read-only paths work even without a .env file.
export const RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// Blockscout's proxy RPC — fallback when the primary rate-limits bursts.
export const RPC_URL_FALLBACK = "https://testnet.arcscan.app/api/eth-rpc";

export const ARC_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 5042002,
);

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// ERC-8183 AgenticCommerce proxy (shared pre-deployed contract, no admin held).
export const AGENTIC_COMMERCE = (process.env.NEXT_PUBLIC_AGENTIC_COMMERCE ??
  "0x0747EEf0706327138c69792bF28Cd525089e4583") as `0x${string}`;

// USDC ERC-20 (6 decimals) — also the escrow payment token.
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;

export const USDC_DECIMALS = 6;

export const arcscanTxUrl = (hash: string) =>
  `https://testnet.arcscan.app/tx/${hash}`;
