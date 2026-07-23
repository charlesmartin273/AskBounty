# Code Review — Phase 4 (cron sweep + claim refund + browse + activity)

Reviewer: code-reviewer | Date: 2026-07-23 | Scope: static review + `npx tsc --noEmit` (clean, exit 0)

## Scope

- New: `app/api/cron/sweep/route.ts`, `app/api/questions/[id]/refund/route.ts`, `components/refund/claim-refund-button.tsx`, `app/api/activity/route.ts`, `app/activity/page.tsx`, `app/browse/page.tsx`, `components/browse/question-card.tsx`, `components/site-nav.tsx`, `lib/supabase/migration-004-phase4-refund.sql`, `vercel.json`, 4 phase-4 scripts
- Modified: `app/q/[id]/page.tsx`, `app/page.tsx`, `app/ask/page.tsx`, `lib/questions/question-api-helpers.ts`, `lib/supabase/schema.sql`, `scripts/phase3-test-helpers.ts`
- Cross-read for races: `lib/answers/process-answer-evaluation.ts`, `lib/payout/accept-answer.ts`, `app/api/answers/route.ts`, `app/api/answers/[id]/retry/route.ts`, finalize + job routes, schema RLS, PRD-ERRATA
- LOC (new phase files): ~1000. All files < 200 lines. tsc: 0 errors.

## Overall Assessment

Strong phase. The state machine is CAS-guarded end to end, the refund record API is layered correctly for real money paths, browse/activity can't leak non-live or mislabeled rows, and the E2E refund script tests the negatives that matter (pre-expiry revert, non-asker revert, forged hash, double record, balance delta to the unit). No critical issues. Findings below are recovery-path robustness and cosmetic-forgery hardening.

## Critical Issues

None found.

## High Priority

### H1. Retry route ignores `ensureQuestionAnswered` result → uncaught throw → HTTP 500
`app/api/answers/[id]/retry/route.ts:47-49`: for an accepted-but-unpaid answer it calls `ensureQuestionAnswered(...)` and discards the boolean, then unconditionally calls `acceptAnswer(...)`.
Path: accept succeeds but process crashes before the question flip (documented H2 window) → question stays `open` → daily cron flips it `expired` → user clicks Retry. `ensureQuestionAnswered` CAS fails (status `expired`), reverts the answer accepted→failed, returns `false`. Retry proceeds anyway; `runPayout` re-reads the row, hits `a.status !== "accepted"` and **throws outside its own try/catch** (`lib/payout/accept-answer.ts:47-49`) → route has no handler → 500 with a stack-trace-shaped error to the client.
Money is safe and state actually heals (answer failed, refund now claimable), but the endpoint errors instead of explaining.
Fix (small):
```ts
const flipped = await ensureQuestionAnswered(db, answer.question_id, answer.id);
if (!flipped) return jsonError(409, "question expired before acceptance — answer reverted; asker can claim refund");
```

## Medium Priority

### M1. Refund record layer 4 proves "not Funded", not "THIS tx refunded THIS job" — cosmetic forgery possible
`app/api/questions/[id]/refund/route.ts:72-75` accepts any successful asker→contract tx once the job has left Funded. If the asker claims refund out-of-band (Arcscan) and then POSTs a *different* qualifying hash (e.g. their `create_tx` for another question — same from, same to, success), all 5 layers pass and the wrong hash is persisted as `refund_tx`, which the UI then presents as the verifiable receipt link (`/q/[id]`, activity tab). Status/money outcome is still correct; only the public proof link is forgeable — but C2 asks for "unforgeable record".
Fix: decode `receipt.logs` for the contract's `RefundClaimed`-equivalent event and require `jobId === question.job_id` (mirrors `parsePaymentReleasedAmount` already used in payout). Then layers 3-4 become redundant belt-and-braces instead of the primary proof.

### M2. Answered-then-refunded dead end (pre-sweep window, asker bypasses UI)
Sequence: answer submitted before deadline; LLM eval completes *after* deadline while the question is still `open` (cron is daily); question flips `answered`; payout pipeline races the asker's direct onchain `claimRefund` (valid: `now > expiredAt`, still Funded). Contract serializes — if refund lands first, `submitDeliverable` reverts → `payout_failed`. Final state: DB `answered` + `accepted` answer + `payout_failed`, escrow refunded onchain. The refund route can never record it (status ≠ expired AND accepted answer exists — correct per C2), and activity shows "Accepted — payout pending (retry on the question page)" forever with a retry that always fails. Money safe (no double-spend possible); public state permanently contradicts the chain. This is the Phase-3 audit open question #2 landing in Phase 4's state machine.
Suggested minimal hardening: in `runPayout`'s catch (or the pre-check at accept-answer.ts:89-99), when the job's onchain status shows the escrow was refunded, revert the accept (accepted→failed with reason) and CAS the question `answered`→`refunded`(+tx from chain if recoverable) — or at minimum record a distinct `payout_status` so the UI can say "escrow was refunded by the asker" instead of "pending".

### M3. Float math on USDC in activity earnings
`app/activity/page.tsx:41`: `reduce((s, a) => s + Number(a.paidAmount ?? 0), 0)` + `toFixed(6)`. Display-only, but violates the binding "no float math on USDC" rule and can drift at 6 decimals (classic 0.1+0.2). Sum in raw units: `usdcToRaw(a.paidAmount)` accumulate as bigint, render via `rawToUsdc`/`usdcDisplay`.

## Low Priority

- L1. Cron auth compares the bearer token with `!==` (`sweep/route.ts:15`) — not constant-time. Negligible in practice; `crypto.timingSafeEqual` if you want it airtight.
- L2. `app/activity/page.tsx` useEffect has no abort/stale guard: fast wallet switch can render the previous wallet's rows; also no loading state (blank until fetch resolves).
- L3. `app/q/[id]/page.tsx:126` `row.job_id!` — unreachable-null in practice (expired ⇒ was open ⇒ finalize required job_id), but a null would surface as `BigInt(null)` TypeError at click. A guard rendering "missing job" is 2 lines.
- L4. `AnswerLabel` renders `Paid {a.paidAmount ?? "?"}` without `usdcDisplay` — formatting inconsistency with the rest of the app.
- L5. `toPublicQuestion` (question-api-helpers.ts) omits `refundTx` while the page/activity read it from the row — API consumers of GET /api/questions/[id] can't see the refund receipt. Add `refundTx: row.refund_tx` for consistency.
- L6. Retry on a pending-errored answer of an expired/refunded question still burns an LLM eval before `ensureQuestionAnswered` safely reverts a pass — an early `question.status !== "open"` 409 would save the call.
- L7. No composite index on `questions(status, deadline)` for sweep/browse predicates — fine at hackathon scale, note for growth.

## Constraint Verification (binding)

- **C1 PASS** — sweep is a single CAS UPDATE (`status='open' AND deadline<now → 'expired'`); no chain reads/writes, no eval/payout, no agent wallet. Fail-closed: unset `CRON_SECRET` ⇒ every request 401s (`!secret ||` short-circuit). Vercel cron GET + Bearer matches `vercel.json`.
- **C2 PASS (with M1 cosmetic caveat)** — asker-only enforced twice (contract `msg.sender == client`; route `receipt.from == asker_address`); expired-only via status gate; accepted-answer guard present; receipt checks success + `to` (null-safe for contract-creation txs) + `from`; job-no-longer-Funded; CAS `expired→refunded` makes double-record a deterministic 409 (verified in e2e). TOCTOU on the accepted-count check is benign: an accept landing mid-request is reverted by `ensureQuestionAnswered` (question not `open`), so no *final* state pairs `refunded` with an accepted answer.
- **C3 PASS** — browse: `eq('status','open') + gt('deadline', now)`, `force-dynamic`. `open` is granted only by finalize after onchain Funded + budget-match + expiry-future checks; RLS has SELECT-only policies (no anon writes), so status can't be forged client-side. Expired-but-unswept rows hidden by the deadline predicate; q/[id] shows "closed pending sweep" for that window.
- **C4 PASS** — `AnswerLabel` derives from `payout_status`: `accepted+paid` ⇒ "Paid X USDC" + forward-tx verify link; any other accepted ⇒ "Accepted — payout pending"; never bare "accepted". `paid` written only after both onchain receipts (accept-answer.ts).
- **Money safety PASS** — no final state records a refund alongside an accepted answer (race analysis below); escrow math is bigint throughout (`computeNetPayout`, `usdcToRaw`); M3 is display-only float. All files < 200 lines.

## Edge Cases / Race Analysis (scouted beyond the diff)

1. **Cron vs accept**: both CAS on `status='open'` — Postgres row lock serializes; loser no-ops or reverts via `ensureQuestionAnswered`. Safe.
2. **Refund vs late-passing eval (question already `expired`)**: eval pass → answer accept CAS succeeds transiently → `ensureQuestionAnswered` CAS fails (not `open`) → accept reverted to failed with reason. Refund record's accepted-count check either sees 0 (transient) or 409s; final state consistent. Safe.
3. **Asker claims refund onchain pre-sweep while eval in flight** → M2 above (money safe, state dead end).
4. **Forged tx hashes**: nonexistent hash → 400 (receipt throw); other-wallet tx → `from` mismatch; asker tx while job Funded → layer 4; asker tx after out-of-band refund → M1 (wrong hash recorded, status still correct).
5. **Answer submission to expired/refunded** → 409 (`status !== 'open'`), plus deadline check for the unswept window; verified in e2e.
6. **`/job` route pins `expiredAt === deadline` exactly** (Phase 2 C1 fix) — DB clock and chain clock can't be rugged apart; the refund button appearing before onchain expiry is impossible beyond block-time skew.
7. XSS: all user strings (title, body, error messages) render as JSX text nodes; no `dangerouslySetInnerHTML`; tx-hash hrefs are regex-validated at their only write sites; `ilike` input locked to `^0x[hex]{40}$` (no `%`/`_` injection).
8. `/api/activity` leak check: returns only RLS-public columns; answer bodies not included; drafts appear in the owner's asked tab (public by design).

## Positive Observations

- Refund route comment block documents the 5 layers and each one is actually implemented in order.
- `ensureQuestionAnswered` revert-on-expiry is the correct arbitration: bounty is never stranded between an un-payable accept and a blocked refund.
- E2E refund script asserts the balance delta **to the unit** including Arc's USDC-denominated gas — rare rigor.
- Fail-closed cron auth; sweep result returns affected ids (auditable).
- Migration 004 is idempotent (`IF EXISTS`/`IF NOT EXISTS`) and `schema.sql` status CHECK kept in sync.

## Recommended Actions

1. H1: handle `ensureQuestionAnswered === false` in retry route (409, not 500). ~3 lines.
2. M1: verify RefundClaimed event + jobId from receipt logs in the refund route. ~15 lines.
3. M3: bigint earnings sum in activity page. ~5 lines.
4. M2: decide + document (or implement `answered`→refunded healing on refund-caused payout failure). Discuss with user first — touches Phase 3 code (rule 8).
5. Low items opportunistically.

## Metrics

- `npx tsc --noEmit`: PASS (0 errors)
- Files > 200 lines: 0 (largest new file: activity page, 135)
- Lint: not run (per task constraints); no syntax issues observed
- Test coverage: 3 phase-4 E2E scripts + migration verifier present; unit tests n/a for this phase

## Unresolved Questions

1. Contract behavior of `complete()` on a job past `expiredAt` but still Funded (Phase-3 audit open Q) — determines whether the M2 window can also strand a Submitted job (refund needs Funded). Worth one live probe before demo.
2. Which onchain status does `claimRefund` set (Expired=5?) — layer 4 only needs "not Funded", but the M1 event-parse fix needs the exact event name/signature from the verified source.
3. Is the drafts-visible-in-activity behavior (any address queryable, no auth) intended as public by design? RLS says yes; confirming intent.
