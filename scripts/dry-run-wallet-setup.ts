// Env + throwaway-wallet setup for the dry-run script. MUST be the first
// import in dry-run-lifecycle.ts so dotenv runs before lib/chain/config.ts.
import { config } from "dotenv";
import { appendFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

config({ path: ".env.local" });

// Returns the private key for `envVar`, generating + persisting a throwaway
// key into .env.local when missing (gitignored - dry-run only).
export function ensureWalletKey(envVar: string): `0x${string}` {
  const existing = process.env[envVar];
  if (existing && existing.startsWith("0x")) return existing as `0x${string}`;
  const key = generatePrivateKey();
  appendFileSync(".env.local", `\n${envVar}=${key}`);
  process.env[envVar] = key;
  console.log(
    `[setup] generated throwaway ${envVar} -> ${privateKeyToAccount(key).address} (saved to .env.local)`,
  );
  return key;
}

export const usdcFmt = (v: bigint) =>
  `${(Number(v) / 1e6).toFixed(6)} USDC (${v} raw)`;
