// Incident investigation (PRD CONFLICT PROTOCOL): a claimRefund from a
// NON-asker wallet SUCCEEDED on job 159263, contradicting PRD-ERRATA E3
// ("Only client"). Establish: who called it, and WHERE the refund went.
// Run: npx tsx scripts/investigate-refund-behavior.ts <jobId>
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import { getJob, getUsdcBalance } from "../lib/escrow/escrow-reads";
import { publicClient } from "./phase3-test-helpers";

async function main() {
  const jobId = BigInt(process.argv[2] ?? "159263");
  const asker = privateKeyToAccount(ensureWalletKey("DRYRUN_ASKER_PRIVATE_KEY")).address;
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY")).address;

  const job = await getJob(publicClient, jobId);
  console.log(`job ${jobId}: status=${job.status} budget=${job.budget} client=${job.client}`);
  console.log(`asker  = ${asker}`);
  console.log(`winner = ${winner} (the NON-asker that called claimRefund)`);
  console.log(`asker balance : ${usdcFmt(await getUsdcBalance(publicClient, asker))}`);
  console.log(`winner balance: ${usdcFmt(await getUsdcBalance(publicClient, winner))}`);

  // Winner's recent txs via Blockscout API - find the claimRefund call and
  // the USDC transfer destination inside it.
  const res = await fetch(
    `https://testnet.arcscan.app/api/v2/addresses/${winner}/transactions?filter=from`,
  );
  const data = (await res.json()) as {
    items?: {
      hash: string; method: string | null; to: { hash: string } | null;
      status: string; timestamp: string;
    }[];
  };
  for (const tx of (data.items ?? []).slice(0, 5)) {
    console.log(`tx ${tx.hash} method=${tx.method} to=${tx.to?.hash} status=${tx.status} at=${tx.timestamp}`);
    if (tx.method === "claimRefund") {
      const tr = await fetch(
        `https://testnet.arcscan.app/api/v2/transactions/${tx.hash}/token-transfers`,
      );
      const transfers = (await tr.json()) as {
        items?: { from: { hash: string }; to: { hash: string }; total: { value: string } }[];
      };
      for (const t of transfers.items ?? []) {
        console.log(`  -> USDC transfer ${t.from.hash} -> ${t.to.hash} value=${t.total.value}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
