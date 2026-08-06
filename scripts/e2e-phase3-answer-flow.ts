// Phase 3 main-flow E2E: R5 (server-side signature verification before any DB
// write), objective-gate, cooldown, accept + payout, R2 (winner balance delta
// == net_payout snapshot), R4 (both txs on the public page), post-accept 409.
// Needs: dev server on :3000, migration-003 applied, funded asker wallet.
// Run: npx tsx scripts/e2e-phase3-answer-flow.ts
import {
  api, BASE, createOpenQuestion, db, GOOD_ANSWER, getAnswer, LAZY_ANSWER,
  makeSigner, pause, preflightAskerBalance, publicClient, record,
  resolvePendingEval, submitAnswer, summarize,
} from "./phase3-test-helpers";
import { ensureWalletKey, usdcFmt } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildAnswerMessage, contentHashOf,
} from "../lib/auth/verify-submission-signature";
import { getUsdcBalance } from "../lib/escrow/escrow-reads";
import { usdcToRaw } from "../lib/format-usdc";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY"));
  const { questionId } = await createOpenQuestion(asker, "1", "E2E flow: paginate getLogs on Arc");

  // ---- R5: signature verified server-side BEFORE any DB write ----
  // (a) garbage signature
  const bad1 = await api("POST", "/api/answers", {
    questionId, body: GOOD_ANSWER, address: winner.address, signature: "0x1234deadbeef",
  });
  record("R5a garbage signature -> 401", bad1.status === 401, `${bad1.status} ${bad1.data.error ?? ""}`);
  // (b) valid signature over a DIFFERENT body (tampered content)
  const sigOther = await winner.signMessage({
    message: buildAnswerMessage(questionId, contentHashOf("some other body")),
  });
  const bad2 = await api("POST", "/api/answers", {
    questionId, body: GOOD_ANSWER, address: winner.address, signature: sigOther,
  });
  record("R5b tampered body -> 401", bad2.status === 401, `${bad2.status} ${bad2.data.error ?? ""}`);
  // (c) signature by another wallet claiming winner's address
  const stranger = privateKeyToAccount(ensureWalletKey("DRYRUN_ANSWERER2_PRIVATE_KEY"));
  const sigStranger = await stranger.signMessage({
    message: buildAnswerMessage(questionId, contentHashOf(GOOD_ANSWER)),
  });
  const bad3 = await api("POST", "/api/answers", {
    questionId, body: GOOD_ANSWER, address: winner.address, signature: sigStranger,
  });
  record("R5c address spoof -> 401", bad3.status === 401, `${bad3.status} ${bad3.data.error ?? ""}`);
  // No DB rows may exist after the three rejections
  const { count } = await db().from("answers")
    .select("id", { count: "exact", head: true }).eq("question_id", questionId);
  record("R5 no DB rows written on rejection", count === 0, `answers rows = ${count}`);

  // ---- Objective gate: lazy answer fails WITHOUT an LLM call ----
  const lazy = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, LAZY_ANSWER);
  const lazyChecks = lazy.data.answer?.evalResults?.results ?? [];
  record(
    "lazy answer -> failed with per-check reasons",
    lazy.status === 200 && lazy.data.answer?.status === "failed" &&
      lazyChecks.some((r: { check: string; pass: boolean }) => r.check === "min_words" && !r.pass) &&
      lazyChecks.some((r: { check: string; pass: boolean }) => r.check === "has_code_block" && !r.pass),
    JSON.stringify(lazyChecks),
  );
  record(
    "LLM NOT called on objective fail (no topics_covered entry)",
    !lazyChecks.some((r: { check: string }) => r.check === "topics_covered"),
    `checks ran: ${lazyChecks.map((r: { check: string }) => r.check).join(",")}`,
  );
  const qAfterLazy = await api("GET", `/api/questions/${questionId}`);
  record("question still open after failed answer",
    qAfterLazy.data.question?.status === "open", `status=${qAfterLazy.data.question?.status}`);

  // ---- Cooldown: immediate resubmission from the same wallet -> 429 ----
  const rapid = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER);
  record("cooldown blocks rapid resubmit -> 429", rapid.status === 429,
    `${rapid.status} ${rapid.data.error ?? ""}`);

  console.log("[cooldown] waiting 61s for the window to pass…");
  await pause(61_000);

  // ---- R2: accept + payout; winner receives EXACTLY the net_payout snapshot ----
  const netPayoutRaw = usdcToRaw(qAfterLazy.data.question.netPayout);
  const balBefore = await getUsdcBalance(publicClient, winner.address);
  const good = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER);
  let answerRow = good.status === 200 && good.data.answer
    ? await resolvePendingEval(good.data.answer.id)
    : null;
  if (!answerRow) throw new Error(`good submit failed: ${JSON.stringify(good.data)}`);
  record("good answer -> accepted", answerRow.status === "accepted",
    `status=${answerRow.status} results=${JSON.stringify(answerRow.eval_results?.results?.map((r) => `${r.check}:${r.pass}`))}`);
  // payout may need a beat if it was resumed via retry
  if (answerRow.payout_status !== "paid") {
    await pause(5000);
    await api("POST", `/api/answers/${answerRow.id}/retry`);
    answerRow = await getAnswer(answerRow.id);
  }
  record("payout paid with both txs recorded",
    answerRow.payout_status === "paid" && !!answerRow.complete_tx && !!answerRow.forward_tx,
    `complete=${answerRow.complete_tx} forward=${answerRow.forward_tx}`);
  await pause(2000);
  const balAfter = await getUsdcBalance(publicClient, winner.address);
  const delta = balAfter - balBefore;
  record(
    "R2 winner balance delta == net_payout snapshot",
    delta === netPayoutRaw,
    `before=${usdcFmt(balBefore)} after=${usdcFmt(balAfter)} delta=${usdcFmt(delta)} snapshot=${usdcFmt(netPayoutRaw)}`,
  );

  // ---- R4: public page shows BOTH txs with Arcscan links ----
  const html = await fetch(`${BASE}/q/${questionId}`).then((r) => r.text());
  record(
    "R4 receipt shows both txs + Arcscan links",
    html.includes(answerRow.complete_tx!) && html.includes(answerRow.forward_tx!) &&
      html.includes(`testnet.arcscan.app/tx/${answerRow.complete_tx}`) &&
      html.includes(`testnet.arcscan.app/tx/${answerRow.forward_tx}`),
    `/q/${questionId}`,
  );

  // ---- post-accept: question closed to new submissions ----
  const late = await submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, GOOD_ANSWER);
  record("post-accept submit -> 409", late.status === 409, `${late.status} ${late.data.error ?? ""}`);
  const qFinal = await api("GET", `/api/questions/${questionId}`);
  record("question flipped to answered", qFinal.data.question?.status === "answered",
    `status=${qFinal.data.question?.status}`);

  console.log(`\nquestion: ${BASE}/q/${questionId}`);
  console.log(`complete tx: https://testnet.arcscan.app/tx/${answerRow.complete_tx}`);
  console.log(`forward  tx: https://testnet.arcscan.app/tx/${answerRow.forward_tx}`);
  summarize("PHASE 3 ANSWER FLOW");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
