// Phase 3 dedicated E2E - M1 double-accept guard: two concurrent PASSING
// submissions to the SAME question must yield exactly ONE accepted answer and
// exactly ONE onchain payout; the loser fails deterministically via the CAS.
// Also probes the one_accepted_per_question unique index (DB backstop).
// Run: npx tsx scripts/e2e-phase3-double-accept.ts
import {
  createOpenQuestion, db, GOOD_ANSWER, makeSigner, preflightAskerBalance,
  record, resolvePendingEval, submitAnswer, summarize, api, BASE,
} from "./phase3-test-helpers";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  await preflightAskerBalance(asker, 2_000_000n);
  const { questionId } = await createOpenQuestion(asker, "1", "E2E double-accept race");

  // Two different wallets (cooldown is per wallet), same instant.
  console.log("[race] submitting two passing answers concurrently…");
  const [r1, r2] = await Promise.all([
    submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", questionId, GOOD_ANSWER),
    submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", questionId, GOOD_ANSWER + "\n\n(second submitter)"),
  ]);
  record("both submissions reached the API", r1.status === 200 && r2.status === 200,
    `statuses ${r1.status}/${r2.status}`);

  // Gemini free tier may 429 one of the concurrent evals - resolve via retry.
  const a1 = await resolvePendingEval(r1.data.answer.id, 8);
  const a2 = await resolvePendingEval(r2.data.answer.id, 8);
  const accepted = [a1, a2].filter((a) => a.status === "accepted");
  const failed = [a1, a2].filter((a) => a.status === "failed");
  record(
    "M1 exactly ONE accepted, one failed",
    accepted.length === 1 && failed.length === 1,
    `a1=${a1.status} a2=${a2.status} loserReason="${failed[0]?.eval_results?.failReason ?? failed[0]?.eval_results?.results?.map((r) => `${r.check}:${r.pass}`).join(",")}"`,
  );
  const withCompleteTx = [a1, a2].filter((a) => a.complete_tx);
  record("exactly ONE payout tx pair onchain",
    withCompleteTx.length === 1 && !!withCompleteTx[0].forward_tx,
    `complete=${withCompleteTx[0]?.complete_tx} forward=${withCompleteTx[0]?.forward_tx}`);

  const q = await api("GET", `/api/questions/${questionId}`);
  record("question flipped to answered exactly once",
    q.data.question?.status === "answered", `status=${q.data.question?.status}`);

  // DB backstop: a second 'accepted' row must be impossible (unique index).
  const winnerRow = accepted[0];
  const { error: dupErr, data: dupRow } = await db().from("answers").insert({
    question_id: questionId,
    answerer_address: "0x000000000000000000000000000000000000dEaD",
    body: "index probe - must be rejected",
    status: "accepted",
    content_hash: "0x0", signature: "0x0",
  }).select("id");
  if (!dupErr && dupRow?.[0]?.id) {
    await db().from("answers").delete().eq("id", dupRow[0].id); // clean up
  }
  record(
    "unique index one_accepted_per_question blocks a 2nd accepted row",
    !!dupErr,
    dupErr ? `insert rejected: ${dupErr.message}` : "INSERT UNEXPECTEDLY SUCCEEDED - migration-003 not applied?",
  );

  console.log(`\nquestion: ${BASE}/q/${questionId} - winner answer ${winnerRow.id}`);
  summarize("PHASE 3 DOUBLE-ACCEPT (M1)");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
