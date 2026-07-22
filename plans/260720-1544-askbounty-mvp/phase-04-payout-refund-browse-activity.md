# Phase 4 — Payout + Refund + Browse/Activity

> **SCOPE CHANGE (2026-07-21, user-approved):** payout pipeline + dual-tx
> receipt pulled INTO Phase 3 ("submit + evaluate + pay" is one heart).
> Built there: `lib/payout/accept-answer.ts` (submit→complete→forward,
> idempotent, claim-gated, forward amount = `PaymentReleased.amount` per M2),
> `components/receipt/payout-receipt.tsx` (both txs + Arcscan links +
> discrepancy line), manual retry route `POST /api/answers/[id]/retry`.
> `payout-state.ts` dropped (YAGNI — transitions live in accept-answer).
> Remaining Phase 4 scope: cron sweep, claim-refund, browse, activity,
> vercel.json.

## Context Links
- PRD: `AskBounty-PRD-EN.md` §4.4, §4.5, §5 (Answer/get paid, Expiry)
- Architecture: brainstorm report (Accept flow; Payout transparency #2 dual-tx receipt, #3 state machine + retry; Expiry claimRefund)
- Errata: E2 (fees, re-read at payout), E3 (claimRefund client-only)
- Depends on: Phase 3 (accept path calls `acceptAnswer`), Phase 1 (escrow submit/complete/forward, fee reads).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Complete the onchain accept→payout pipeline (`submit` → `complete` → forward to winner), a payout state machine with retry cron, the client-only claim-refund button, the dual-tx receipt UI, a simple browse list, and (only if time) my-activity. Browse filters + my-activity are the cuttable scope.

## Key Insights
- **Two-hop payout (E1/Option B):** `submit(jobId, contentHash)` → `complete(jobId, reason)` lands budget-minus-fees on agent wallet → agent ERC-20 `transfer` of exact provider remainder to winner. Forward gas (USDC) absorbed by agent, never deducted from winner.
- **State machine on answers:** `accepted → payout_pending → paid`, plus internal `payout_failed`. `complete_tx` and `forward_tx` recorded separately. If forward fails, status `payout_failed`; cron retries; winner sees "Payout pending, retrying" — never silent.
- **Re-read fee BPs at payout** (E2) to compute exact forward amount from the actual completed remainder (read agent balance delta or compute from budget+live BPs). Prefer computing remainder from the `complete` accounting, cross-check with balance delta.
- **claimRefund is client-only (E3):** cron only marks DB `expired` + surfaces button; asker wallet calls `claimRefund(jobId)` (requires `block.timestamp > expiredAt`, status Funded).
- Cron does: (a) mark expired questions, (b) retry `payout_failed` forwards, (c) re-evaluate stuck `pending` answers (Phase 3 sweeper). Secured by `CRON_SECRET`.

## Requirements
**Functional:** accepted answer results in winner receiving net USDC; receipt shows both txs w/ Arcscan links; failed forward retried automatically + visible; asker can claim refund after expiry; browse lists open questions.
**Non-functional:** payout idempotent (no double-forward); cron auth-gated; files <200 lines.

## Architecture
Data flow (accept): Phase 3 CAS winner → `acceptAnswer(answerId)` → set answer `payout_pending`, complete_tx null → escrow `submit(jobId, content_hash)` → `complete(jobId, reason)` store `complete_tx` → compute remainder (live fee re-read + budget) → `forwardToWinner(answerer_address, remainder)` → on success store `forward_tx`, status `paid`; on failure status `payout_failed` (complete_tx kept so retry only re-forwards, never re-completes).
Data flow (refund): cron marks question `expired` → question page shows Claim Refund button for asker wallet → wallet `claimRefund(jobId)` → on receipt, store refund tx, mark question `refunded`.
Cron: `GET /api/cron/sweep` (auth `Authorization: Bearer CRON_SECRET`) → expiry marking + failed-forward retry + stuck-eval retry.

## Related Code Files
**Create:**
- `lib/payout/accept-answer.ts` — pipeline: submit → complete → forward, state transitions, idempotent
- `lib/payout/payout-state.ts` — status constants + safe transition helpers
- `app/api/cron/sweep/route.ts` — cron: expiry + retry forwards + retry stuck evals
- `components/receipt/payout-receipt.tsx` — dual-tx receipt (complete_tx + forward_tx) w/ Arcscan links + status
- `components/refund/claim-refund-button.tsx` — asker-wallet claimRefund
- `app/browse/page.tsx` — simple open-questions list (server component)
- `components/browse/question-card.tsx` — title, budget, net payout, deadline
- `app/activity/page.tsx` — (CUTTABLE) Asked/Answered tabs
- `vercel.json` — cron schedule (daily)
**Modify:**
- `app/api/answers/route.ts` — call `acceptAnswer` on CAS win (wire real pipeline)
- `app/q/[id]/page.tsx` — mount receipt (accepted) + claim-refund (expired) + payout status
- `lib/escrow/escrow-service.ts` — confirm submit/complete/forward wrappers used

## Implementation Steps
1. `lib/payout/payout-state.ts`: statuses `accepted|payout_pending|paid|payout_failed`; helper `canTransition(from,to)`; ensure forward-only retry (if `complete_tx` set, skip submit+complete).
2. `lib/payout/accept-answer.ts` `acceptAnswer(answerId)`:
   - Load answer+question+job_id. Guard: if answer already `paid` → return (idempotent). If `complete_tx` already set → skip to forward step.
   - `submit(jobId, content_hash)` (agent). `complete(jobId, reason)` (agent, evaluator-only) → store `complete_tx`, status `payout_pending`.
   - Compute remainder: re-read fee BPs, `remainder = budget - budget*platformBP/10000 - budget*evalBP/10000` (bigint 6-dec). Optionally verify against agent USDC balance delta.
   - `forwardToWinner(answerer_address, remainder)` → store `forward_tx`, status `paid`. On throw → status `payout_failed`, log; do NOT rethrow to caller in a way that reverts accept (answer stays accepted, payout retriable).
3. Wire `app/api/answers/route.ts` CAS-win branch to `await acceptAnswer(answerId)` (catch internally so a forward failure doesn't 500 the submit; return accepted + payout_pending).
4. `app/api/cron/sweep/route.ts`:
   - Auth: reject if `Authorization !== 'Bearer '+CRON_SECRET`.
   - Expiry: `update questions set status='expired' where status='open' and deadline < now()`.
   - Retry forwards: for answers `payout_failed`, call `acceptAnswer` (forward-only path).
   - Retry stuck evals: `pending` answers on still-open questions, re-run `evaluate-answer` in created_at order (reuse Phase 3).
5. `vercel.json`: cron `path:/api/cron/sweep` schedule daily (e.g. `0 0 * * *`). Note Hobby-plan cron frequency limits in README; trigger-on-submit covers instant demo.
6. `components/receipt/payout-receipt.tsx`: given answer, show "Paid X.XX USDC to 0x…", complete tx link + forward tx link (`testnet.arcscan.app/tx/…`), and if `payout_failed`/`payout_pending` show "Payout pending, retrying" banner.
7. `components/refund/claim-refund-button.tsx`: shown on `/q/[id]` when status `expired` and connected wallet == asker. Wallet `claimRefund(jobId)`; on receipt store refund tx, mark `refunded`. Handle revert (deadline not passed / already refunded) with readable message.
8. `app/browse/page.tsx` + `question-card.tsx`: list `open` questions ordered by budget desc (or deadline). Card links to `/q/[id]`. (Filters = cuttable; skip if tight.)
9. `app/activity/page.tsx` (CUTTABLE, only if ahead of schedule): Asked (by asker_address) + Answered (by answerer_address, earnings, pass rate). Skip cleanly if time-constrained.
10. Compile check + full live flow: accept → both txs → winner receives; force a forward failure (e.g. temporarily wrong winner) to see payout_failed → cron retry.

## Todo List
- [x] ~~payout-state transitions~~ (done in Phase 3 inside accept-answer; forward-only retry via complete_tx gate)
- [x] accept-answer pipeline (DONE in Phase 3 — submit→complete→forward, idempotent)
- [x] wire /api/answers CAS win → acceptAnswer (DONE in Phase 3)
- [ ] cron sweep route (auth + expiry + retry forwards + retry evals)
- [ ] vercel.json cron schedule
- [x] dual-tx receipt component (DONE in Phase 3)
- [ ] claim-refund button (asker wallet)
- [ ] browse list + question card
- [ ] my-activity (only if time)
- [ ] `tsc --noEmit` clean + live refund + cron sweep test

## Success Criteria
- Accepted answer: winner wallet USDC increases by exactly the displayed net payout; receipt shows both txs with valid Arcscan links.
- Forced forward failure → status `payout_failed`; winner sees "Payout pending, retrying"; cron retry forwards successfully → `paid` (no double complete).
- After expiry, asker (and only asker) sees Claim Refund; calling it refunds budget onchain; question → refunded.
- Browse lists open questions.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Forward hop fails, winner unpaid silently | Med×High | State machine + visible status + cron retry |
| Double payout on retry/re-run | Low×High | Idempotent guards; complete_tx gate skips re-complete |
| Fee BP drift → wrong forward amount | Low×Med | Re-read BPs at payout; cross-check balance delta |
| Cron unauthenticated / abused | Low×High | CRON_SECRET bearer check |
| claimRefund reverts (timing/status) | Med×Med | Readable error; button only when expired + asker |
| Hobby cron frequency limit | Med×Low | Trigger-on-submit is primary; cron is sweeper only; documented |

## Security Considerations
- Cron gated by `CRON_SECRET`; agent wallet key server-only.
- Payout pipeline idempotent to prevent double-spend on retries.
- claimRefund enforced onchain (client-only) — UI cannot bypass; button is convenience only.
- Winner address = recovered signer from Phase 3 (trusted), used as forward recipient.

## Next Steps
Feeds Phase 5: deploy cron config, demo data exercising accepted (pass) + failed answer + receipt, README limitation + low-gas warning.

---

## MANUAL TEST GUIDE
1. Cause an answer to pass on a funded question (Phase 3 flow).
   - **Expect:** question page shows a receipt: "Paid X.XX USDC to 0x…", two Arcscan tx links (complete + forward), winner wallet balance up by exactly the net payout shown pre-answer.
   - **Likely failure:** winner unpaid but status accepted → forward step failed; check payout_status (should be payout_failed, not silent).
2. Force a forward failure (temporarily point forward at an invalid recipient or drain agent gas), pass an answer.
   - **Expect:** status `payout_failed`; winner-visible banner "Payout pending, retrying".
   - **Likely failure:** submit 500s / accept reverts → forward error not caught internally.
3. Trigger the cron: `curl -H "Authorization: Bearer <CRON_SECRET>" <url>/api/cron/sweep`.
   - **Expect:** the failed forward retries and (once fixable) flips to `paid` with a forward_tx; no second complete tx created.
   - **Likely failure:** 401 → secret mismatch; double complete tx → complete_tx gate missing.
4. Create a question with a near-past deadline (or wait), run cron.
   - **Expect:** question → expired; on `/q/[id]` the asker wallet sees Claim Refund; clicking it refunds and marks refunded. A non-asker wallet does NOT see the button.
   - **Likely failure:** refund reverts "Only client" → called from wrong wallet; button shown to non-asker → gating bug.
5. Open `/browse`.
   - **Expect:** open questions listed with budget + net payout + deadline, each links to its page.
   - **Likely failure:** expired/answered questions still listed → status filter missing.
