// Phase 3 AUDIT GATE step 3 - edge cases beyond the dedicated E2E scripts:
// empty/oversized/invalid payloads, submit to a draft question, retry-route
// guards, and a concurrent duplicate submit from the SAME wallet.
// Run: npx tsx scripts/e2e-phase3-edge-cases.ts
import {
  api, GOOD_ANSWER, makeSigner, record, submitAnswer, summarize,
} from "./phase3-test-helpers";
import { ensureWalletKey } from "./dry-run-wallet-setup";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildAnswerMessage, contentHashOf,
} from "../lib/auth/verify-submission-signature";

async function main() {
  const asker = makeSigner("DRYRUN_ASKER_PRIVATE_KEY");
  const winner = privateKeyToAccount(ensureWalletKey("DRYRUN_WINNER_PRIVATE_KEY"));

  // A draft (never funded) question - cheap, no onchain txs needed.
  const draft = await api("POST", "/api/questions", {
    askerAddress: asker.account.address,
    title: "E2E edge: draft target",
    body: "draft question for edge cases",
    budget: "1",
    deadline: new Date(Date.now() + 3600_000).toISOString(),
    criteria: { minWords: 10, mustIncludeCode: false, topics: [] },
  });
  const draftId = draft.data.questionId as string;

  // EDGE 1: empty / whitespace-only body -> 400
  const sigEmpty = await winner.signMessage({
    message: buildAnswerMessage(draftId, contentHashOf("   ")),
  });
  const empty = await api("POST", "/api/answers", {
    questionId: draftId, body: "   ", address: winner.address, signature: sigEmpty,
  });
  record("EDGE empty body -> 400", empty.status === 400, `${empty.status} ${empty.data.error ?? ""}`);

  // EDGE 2: oversized body (> 20k chars) -> 400 (rejected before signing cost matters)
  const huge = "spam ".repeat(4001); // 20,005 chars
  const sigHuge = await winner.signMessage({
    message: buildAnswerMessage(draftId, contentHashOf(huge)),
  });
  const over = await api("POST", "/api/answers", {
    questionId: draftId, body: huge, address: winner.address, signature: sigHuge,
  });
  record("EDGE oversized body -> 400", over.status === 400, `${over.status} ${over.data.error ?? ""}`);

  // EDGE 3: submitting to a DRAFT (unfunded) question -> 409, no eval
  const toDraft = await submitAnswer("DRYRUN_WINNER_PRIVATE_KEY", draftId, GOOD_ANSWER);
  record("EDGE submit to draft question -> 409", toDraft.status === 409,
    `${toDraft.status} ${toDraft.data.error ?? ""}`);

  // EDGE 4: retry-route guards - malformed id and unknown id
  const badId = await api("POST", "/api/answers/not-a-uuid/retry");
  const ghost = await api("POST", "/api/answers/00000000-0000-4000-8000-000000000000/retry");
  record("EDGE retry with malformed/unknown id -> 400/404",
    badId.status === 400 && ghost.status === 404,
    `malformed=${badId.status} unknown=${ghost.status}`);

  // EDGE 5: invalid question id + missing fields
  const badQ = await api("POST", "/api/answers", {
    questionId: "not-a-question", body: "x", address: winner.address, signature: "0x00",
  });
  const noSig = await api("POST", "/api/answers", {
    questionId: draftId, body: "x", address: winner.address,
  });
  record("EDGE invalid questionId / missing signature -> 400",
    badQ.status === 400 && noSig.status === 400,
    `badQ=${badQ.status} noSig=${noSig.status}`);

  // EDGE 6: concurrent DUPLICATE submit, same wallet + same question (double
  // click past the UI guard). Cooldown check is read-before-insert, so both
  // may slip in - record the honest outcome; safety net is the accept CAS.
  const [d1, d2] = await Promise.all([
    submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", draftId, GOOD_ANSWER),
    submitAnswer("DRYRUN_ANSWERER2_PRIVATE_KEY", draftId, GOOD_ANSWER),
  ]);
  // Draft target -> both must be 409 regardless (status guard runs first).
  record("EDGE concurrent duplicate submit both rejected by status guard",
    d1.status === 409 && d2.status === 409, `statuses ${d1.status}/${d2.status}`);

  summarize("PHASE 3 EDGE CASES");
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
});
