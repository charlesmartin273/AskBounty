// Phase 3 dedicated E2E — R3: a Gemini failure (forced with an INVALID API
// key) must leave the answer in "evaluation pending, retrying" with a manual
// retry path — never a silent hang, never accepted. Uses TWO dev servers
// against the same DB: E2E_BAD_BASE_URL runs with GEMINI_API_KEY=invalid
// (submission errors), then the retry goes through the healthy server.
// Run (see runner): npx tsx scripts/e2e-phase3-eval-error-retry.ts
import {
  api, BASE, createOpenQuestion, getAnswer, GOOD_ANSWER, makeSigner, pause,
  preflightAskerBalance, record, summarize,
} from "./phase3-test-helpers";
import { ensureWalletKey } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildAnswerMessage, contentHashOf,
} from "../lib/auth/verify-submission-signature";

const BAD_BASE = process.env.E2E_BAD_BASE_URL ?? "http://localhost:3005";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY"));
  const { questionId } = await createOpenQuestion(asker, "1", "E2E eval-error retry (R3)");

  // Submit through the BROKEN-KEY server -> Gemini 400/403 -> eval error.
  const body = GOOD_ANSWER;
  const signature = await winner.signMessage({
    message: buildAnswerMessage(questionId, contentHashOf(body)),
  });
  const res = await fetch(`${BAD_BASE}/api/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, body, address: winner.address, signature }),
  });
  const data = await res.json().catch(() => ({}));
  record("R3 submit with broken GEMINI_API_KEY returns (no hang)",
    res.status === 200, `${res.status} ${JSON.stringify(data?.answer?.status)}`);
  const answerId = data.answer?.id as string;
  const row1 = await getAnswer(answerId);
  record(
    "R3 answer stays PENDING with surfaced LLM error (never accepted/failed)",
    row1.status === "pending" && !!row1.eval_results?.error,
    `status=${row1.status} error=${JSON.stringify(row1.eval_results?.error)}`,
  );

  // The public page must show the retrying state (what the user sees).
  const html = await fetch(`${BASE}/q/${questionId}`).then((r) => r.text());
  record("R3 page shows 'evaluation pending, retrying' + Retry button",
    html.toLowerCase().includes("evaluation pending, retrying") && html.includes("Retry evaluation"),
    `/q/${questionId}`);

  // Manual retry through the HEALTHY server -> evaluation completes + payout.
  await pause(2000);
  const retry = await api("POST", `/api/answers/${answerId}/retry`);
  record("R3 manual retry on healthy server succeeds", retry.status === 200,
    `${retry.status} -> ${retry.data.answer?.status}`);
  let final = await getAnswer(answerId);
  if (final.status === "accepted" && final.payout_status !== "paid") {
    await pause(3000);
    await api("POST", `/api/answers/${answerId}/retry`);
    final = await getAnswer(answerId);
  }
  record("R3 after retry: accepted + paid",
    final.status === "accepted" && final.payout_status === "paid",
    `status=${final.status}/${final.payout_status} complete=${final.complete_tx?.slice(0, 18)} forward=${final.forward_tx?.slice(0, 18)}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`complete tx: https://testnet.arcscan.app/tx/${final.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${final.forward_tx}`);
  summarize("PHASE 3 EVAL-ERROR RETRY (R3)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
