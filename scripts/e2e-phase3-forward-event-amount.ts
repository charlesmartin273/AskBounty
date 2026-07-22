// Phase 3 dedicated E2E — M2 forward-per-event: the amount forwarded to the
// winner must equal PaymentReleased.amount parsed from the complete() receipt
// (never recomputed from fee BPs). PASS = event amount == recorded paid
// amount == winner balance delta == net_payout snapshot (BPs unchanged).
// Run: npx tsx scripts/e2e-phase3-forward-event-amount.ts
import {
  api, createOpenQuestion, makeSigner, pause, preflightAskerBalance,
  publicClient, record, resolvePendingEval, submitAnswer, summarize,
  getAnswer, GOOD_ANSWER,
} from "./phase3-test-helpers";
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import { getUsdcBalance } from "../lib/escrow/escrow-reads";
import { parsePaymentReleasedAmount } from "../lib/escrow/escrow-writes";
import { usdcToRaw } from "../lib/format-usdc";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_500_000n);
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY"));
  // Distinctive budget so the assertion cannot pass by coincidence.
  const { questionId, jobId, agentAddress } = await createOpenQuestion(
    asker, "1.234567", "E2E forward-per-event amount",
  );

  const balBefore = await getUsdcBalance(publicClient, winner.address);
  const res = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER);
  if (res.status !== 200) throw new Error(`submit failed: ${JSON.stringify(res.data)}`);
  let a = await resolvePendingEval(res.data.answer.id, 8);
  if (a.status === "accepted" && a.payout_status !== "paid") {
    await pause(3000);
    await api("POST", `/api/answers/${a.id}/retry`);
    a = await getAnswer(a.id);
  }
  record("answer accepted + paid", a.status === "accepted" && a.payout_status === "paid",
    `status=${a.status}/${a.payout_status} err=${a.eval_results?.payoutError ?? "none"}`);

  // Parse PaymentReleased from the complete receipt INDEPENDENTLY of the app.
  await pause(2000);
  const receipt = await publicClient.getTransactionReceipt({
    hash: a.complete_tx as `0x${string}`,
  });
  const eventAmount = parsePaymentReleasedAmount(receipt, jobId, agentAddress);
  const recordedPaid = usdcToRaw(a.eval_results?.paid?.amount ?? "0");
  await pause(2000);
  const balAfter = await getUsdcBalance(publicClient, winner.address);
  const delta = balAfter - balBefore;
  const q = await api("GET", `/api/questions/${questionId}`);
  const snapshot = usdcToRaw(q.data.question.netPayout);

  console.log(`\nPaymentReleased.amount : ${usdcFmt(eventAmount)}`);
  console.log(`recorded paid.amount   : ${usdcFmt(recordedPaid)}`);
  console.log(`winner balance delta   : ${usdcFmt(delta)}`);
  console.log(`net_payout snapshot    : ${usdcFmt(snapshot)}`);
  record("M2 forwarded == PaymentReleased.amount", recordedPaid === eventAmount,
    `event=${eventAmount} recorded=${recordedPaid}`);
  record("winner delta == PaymentReleased.amount", delta === eventAmount,
    `event=${eventAmount} delta=${delta}`);
  record("event amount == snapshot (BPs unchanged today)", eventAmount === snapshot,
    `event=${eventAmount} snapshot=${snapshot}`);

  console.log(`\ncomplete tx: https://testnet.arcscan.app/tx/${a.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${a.forward_tx}`);
  summarize("PHASE 3 FORWARD-PER-EVENT (M2)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
