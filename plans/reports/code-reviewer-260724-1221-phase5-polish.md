# Code Review — Phase 5 (polish + deploy + demo), uncommitted diff

## Scope
- Files: 14 modified + 11 new (lib/ui/friendly-error.ts, components/ui/error-note.tsx, app/error.tsx, app/not-found.tsx, 2 loading.tsx, 2 segment layouts, app/icon.svg, scripts/seed-demo-data.ts, docs/screenshots), 5 boilerplate SVGs deleted
- LOC: ~+440 / -62
- Focus: FriendlyError refactor correctness, funding-wizard retry paths, seed staging logic, compile/runtime breaks
- Verified: `tsc --noEmit` exit 0; `eslint app components lib scripts` → 2 errors, 2 warnings (below)
- Note: working tree changed mid-review — a duplicated `.vercel`/`.env*` append to `.gitignore` (which would have re-ignored `.env.example` by overriding the earlier `!.env.example`) was removed concurrently; current `git diff -- .gitignore` is empty. Plan files `plans/PHASE5-AUDIT.md` etc. appeared during review.

## Overall Assessment
Refactor is complete and type-safe. Every consumer of the new `FriendlyError | null` state was migrated: ask page, activity page, answer-editor, claim-refund-button, funding-wizard/use-funding-wizard, wallet-connect all render via `ErrorNote` or `.message`; `funding-wizard.tsx:105` uses object truthiness (valid), `:34` uses `w.error?.message`. `payout-receipt.tsx` intentionally untouched — still string-typed and internally consistent, no break. Wizard retry semantics preserved: `error` cleared in `busy()` (use-funding-wizard.ts:83) and on refresh success (:56); step-4 finalize-only retry and step-3 already-funded skip untouched. No confirmed runtime regressions.

## Critical Issues
None.

## High Priority
None.

## Medium Priority
1. **New ESLint error** — `app/activity/page.tsx:38-39` (`setData(null); setError(null)` in effect body) trips `react-hooks/set-state-in-effect`; introduced by this diff. `app/ask/page.tsx:46` fails the same rule but is pre-existing. Repo pre-commit rule requires lint to pass. Pragmatic fix: `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment, or move reset into keyed state. `next build` doesn't run eslint, hence build passes.
2. **Seed script: sweep result unchecked before onchain claim** — `scripts/seed-demo-data.ts:149-156`: `seedRefundFinish` logs the sweep response but proceeds to `claimRefund` regardless. If the local `CRON_SECRET` doesn't match the prod deployment's (401) or sweep fails, the refund IS claimed onchain but `POST /refund` then 409s (`question is not expired`, refund/route.ts:40), leaving the demo question stuck at `open` with the escrow already emptied. Funds safe (contract always pays asker), but demo state inconsistent and needs a manual sweep + re-record. Fix: assert the sweep response marked this questionId expired (or re-GET the question and check `status === "expired"`) before claiming.

## Low Priority
3. `scripts/seed-demo-data.ts:15` — unused import `usdcFmt` (lint warning).
4. `lib/ui/friendly-error.ts:27` — rate-limit pattern `/rate limit|429|too many requests/i` matches a bare `429` anywhere; viem error dumps include addresses/hashes/gas values, so e.g. an address containing `429` gets the "network is rate-limiting" headline. Detail line still shows raw text, so impact is cosmetic. Suggest `\b429\b` or `status.{0,3}429`.
5. `app/q/[id]/page.tsx` — `generateMetadata` performs a second `getQuestionRow` DB read per request on top of the page body's own read (`force-dynamic`, helper not wrapped in React `cache()`). Two round trips per question view; wrap `getQuestionRow` in `cache()` if it matters.
6. `app/activity/page.tsx` — account-switch fetch race: prior in-flight fetch is not aborted/guarded, so a slow response for wallet A can land after the reset for wallet B and display A's rows. Pre-existing pattern; the new reset makes the window more visible. AbortController or `if (address !== current) return` guard.
7. Seed full run — lazy answer outcome is logged (`expect failed`) but not asserted (`scripts/seed-demo-data.ts:91`); if the LLM flakily accepts it, the paid-demo narrative breaks and the script only errors later at the strong answer ("question closed"). Informational.

## Edge Cases Checked (scout pass)
- `UserFacingError` `instanceof` across bundle: single module, ES2015+ target — safe.
- `toFriendlyError` on `HTTP \d+`-only messages → friendly generic (friendly-error.ts:38) — correct.
- `Countdown` `suppressHydrationWarning`: scoped to one span; 1s tick corrects text; className mismatch window ≤1s — acceptable.
- `answer-list.tsx:30` ISO-UTC timestamp: deterministic SSR/client — hydration-safe.
- `generateMetadata` invalid/missing id → "Question" fallback; DB throw swallowed by `.catch(() => null)` — no 500 from metadata.
- `app/error.tsx` leaks only `digest`, no message/stack — no data-leak.
- Seed cross-refs verified: all `phase3-test-helpers` exports exist; `claimRefund(ctx, jobId)` signature matches escrow-writes.ts:176; GET question returns `jobId`/`deadline` (toPublicQuestion). Refund deadline 10.5min clears the API 10-min floor at creation time.
- Refund record route (unchanged) still enforces expired-status + calldata decode + CAS — seed path compatible.

## Positive Observations
- Error taxonomy split (mapped wallet/RPC errors vs pass-through `UserFacingError` API copy) is clean and DRY; raw detail demoted, never lost.
- Step-3 "already funded → finalize only" and step-4 retry guards survived the refactor untouched.
- Refund revert message now states the escrow was not touched — good UX honesty.
- Loading skeletons + activity in-flight skeleton remove blank-page states without new deps.

## Recommended Actions
1. Silence/fix `react-hooks/set-state-in-effect` at activity:38 (and optionally ask:46) so the lint gate passes before commit.
2. Guard `seedRefundFinish`: verify question status is `expired` after sweep before `claimRefund`.
3. Drop unused `usdcFmt` import in seed script.
4. (Optional) tighten the `429` regex; `cache()` `getQuestionRow`.

## Metrics
- tsc: pass (exit 0)
- ESLint: 2 errors (1 new), 2 warnings (1 new)
- Tests: not run (out of scope per task; build + deploy verified by orchestrator)

## Unresolved Questions
- Was the concurrent `.gitignore` edit (duplicate removal) intentional by the main session? Current state is correct; just confirm nothing else was reverted.
