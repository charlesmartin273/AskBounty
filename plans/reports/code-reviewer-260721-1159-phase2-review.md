# Code Review — Phase 2 (Ask Flow + Question Page)

Reviewer: code-reviewer | Date: 2026-07-21
Scope: 6 API routes, 4 lib modules, 4 components, 5 pages/config, 1 migration (~1100 LOC). Context files read, not reviewed. Accepted trade-offs from the task brief are excluded.

## Overall Assessment

Architecture is sound: chain-as-referee finalize guard, CAS updates, fee snapshot at create, DB+chain-derived resume, XSS-safe rendering (all user content goes through JSX text nodes, no `dangerouslySetInnerHTML`; draft pages don't even render title/body). Two real problems: an onchain verification gap that undermines the "no rug-pulls" guarantee, and a broken resume path after a failed finalize.

---

## Critical

### C1. `/job` bind route never verifies `expiredAt` or `hook` — asker-side rug vector

`app/api/questions/[id]/job/route.ts` verifies description, provider, evaluator, client, status — but NOT `job.expiredAt` and NOT `job.hook`, both of which `getJob` returns (`lib/chain/abi-agentic-commerce.ts:89-105`).

The honest wizard passes `deadlineUnix` derived from the DB deadline and hook = zero address, but `createJob` is signed by the **asker's wallet** — a modified client controls both args freely. Exploits:

1. **Early expiry rug**: asker creates the job with `expiredAt = now + 15min` while the DB row shows a 7-day deadline. Bind passes, budget set, funded, finalized → question is `open`, page shows a 7-day countdown. Answerers write answers; escrow expires in 15 min; Phase 3 `complete()` reverts on the expired job; asker `claimRefund()`s. Free answers. This is exactly the rug the landing page promises can't happen.
2. **Malicious hook**: asker passes a hook contract instead of `0x0`. Depending on contract semantics a hook that reverts inside `complete()` blocks payout permanently → funds ride to expiry → refund to asker. Same outcome.

**Fix** (in `/job` POST, after the existing checks):

```ts
const expectedExpiry = BigInt(Math.floor(Date.parse(row.deadline) / 1000));
if (job.expiredAt !== expectedExpiry) return jsonError(400, "job expiry does not match question deadline");
if (job.hook !== "0x0000000000000000000000000000000000000000") return jsonError(400, "job must have no hook");
```

Both sides floor to whole seconds (`toISOString` ms are dropped by `Math.floor` in the wizard), so exact equality is deterministic. Belt-and-braces: also assert `job.expiredAt > now` in `/finalize` so a question can never flip to `open` with an already-expired (or seconds-from-expired) escrow — this also covers the stale-draft resume case where a user resumes funding after the deadline passed.

Phase 3 payout correctness depends on this; fix before building answers.

---

## High

### H1. Funded-but-finalize-failed state is a dead end (broken resume path)

If the `fund` tx confirms but `POST /finalize` fails (network blip, server restart, 502):

- **Same session**: local `step` is still 3, so "Retry step 3" re-runs the whole step-3 branch (`use-funding-wizard.ts:93-114`): allowance is now consumed → it prompts **another approve**, then calls `fund` again, which **reverts** (job already Funded). User pays a pointless approve tx and sees a revert error. Finalize is never retried.
- **After reload**: `GET /api/questions/[id]` correctly derives `step = 4` with `finalized: false` (route comment even says "client should call finalize") — but nothing does. `FundingWizard` only renders the action button when `w.step < 4` (`funding-wizard.tsx:85`), `runStep` has no step-4 branch, and the redirect effect only fires on `finalized`. The user is stuck forever on "Escrow funded — verifying…" and the question stays `draft` despite locked funds.

**Fix** (small):
1. In `runStep`, add a branch: `if (step === 4 && !finalized) { await post(finalize) ; await refresh(); }` — or auto-fire it from an effect when `step === 4 && !finalized`.
2. In the step-3 branch, read job status first (or catch the fund revert) and skip straight to finalize when the job is already Funded.
3. Render the button when `step === 4 && !finalized` ("Verify funding").

This is the one resume path the E2E happy runs would never hit, and it strands real money in a draft.

---

## Medium

### M1. `/job` CAS ignores affected-row count — silent false success

`update(...).eq("id", id).is("job_id", null)` correctly refuses to overwrite, but Supabase returns **no error when 0 rows match**. On a concurrent double-bind (two tabs / double createJob), the loser gets `{ ok: true }` while its jobId was never stored — a lie; that wallet just paid gas for an orphaned job it believes is bound. Client refresh does recover via DB truth, but the response contract is wrong. Fix: append `.select("job_id")` and if the returned array is empty, re-read the row and return the idempotent/409 result accordingly. Same pattern applies to the finalize CAS, though there the silent no-op is genuinely idempotent (both writers wanted `open`) and only risks a lost `fund_tx` (see L1).

### M2. Schema default `status 'open'` contradicts the live guard

`lib/supabase/schema.sql:14`: `status TEXT DEFAULT 'open'`, and the comment enumerates `open | answered | expired` — `draft` isn't even mentioned. The Phase 2 POST sets `'draft'` explicitly so nothing is broken today, but the schema default means any future insert path (Phase 3/4 scripts, seed data, manual SQL) that forgets `status` creates an **instantly-live unfunded question** — the exact state the finalize guard exists to prevent. Fix in a Phase 3 migration: `ALTER TABLE questions ALTER COLUMN status SET DEFAULT 'draft';` plus `CHECK (status IN ('draft','open','answered','expired'))`, and update the schema comment.

### M3. GET resume route throws raw 500s on RPC/DB failure

`app/api/questions/[id]/route.ts` — `getQuestionRow` and `getJob` throws are uncaught → generic 500. The wizard then renders a terminal error paragraph with no retry (`funding-wizard.tsx:29`); mid-funding users on a flaky Arc RPC see "Question not found"-adjacent UX and must know to hard-refresh. Wrap the chain read in try/catch → return `jsonError(502, ...)`, and give the wizard error state a Retry button that calls `refresh()`. Low effort, protects the flow you most need to be resilient.

---

## Low

- **L1. Third-party finalize can plant a bogus `fund_tx`.** Finalize is intentionally caller-agnostic (chain is the referee — fine), but `fundTx` is stored unverified: anyone who races the asker can write an arbitrary 32-byte hash (or null) that the question page then presents as the "Verify escrow on Arcscan" link. Integrity-of-display only, no funds at risk. Cheap hardening: `getTransactionReceipt(fundTx)` and check `to === AGENTIC_COMMERCE && status === success`, or just ignore body and look up the fund tx later.
- **L2. NUMERIC → JS float round-trip on `row.budget`.** `usdcToRaw(row.budget)` goes NUMERIC → JSON number → double → `String()` → `parseUnits`. Exact up to ~15 significant digits; a budget like `123456789.123456` may not round-trip, producing a permanent `budget !== expected` mismatch that bricks set-budget/finalize. Unreachable with realistic testnet budgets; for Phase 3+ prefer selecting `budget::text` or storing `budget_raw TEXT`.
- **L3. Client never checks `receipt.status` on createJob/approve/fund** (`use-funding-wizard.ts:85,104,112`). Reverted createJob is caught indirectly ("JobCreated event missing"); a reverted fund surfaces as a confusing finalize 409 instead of "fund tx reverted". Server verification makes this safe, just poor error attribution.
- **L4. DB/RPC error messages passed to clients** (`db insert failed: ${error.message}` etc.). Supabase/viem internals mildly leak (table names, constraint names). Acceptable for MVP; sanitize before mainnet.
- **L5. `Number(jobId)` before insert** (`job/route.ts:62`) loses precision past 2^53 despite BIGINT column; realistic jobIds are tiny. Use the string form if it ever matters.
- **L6. `Countdown` initial render hydration mismatch** — server-rendered remaining time differs from client hydrate by a tick; React logs a hydration warning. Cosmetic; init text in a `useEffect` if it becomes noisy.

## Edge Cases Checked (no issue found)

- Forged jobId binding another user's question: blocked — attacker can set `description` to victim's id but `job.client` is `msg.sender`, which must equal `asker_address`.
- XSS via title/body/criteria/topics: all rendered as JSX text; drafts render no user content at all.
- Double-click on wizard button: `busy` disables before a second dispatch; multi-tab set-budget double-fire converges (same amount, idempotent check).
- Finalize with wrong onchain budget / non-Funded status / bigint-vs-decimal compares: correct (`usdcToRaw` both sides, bigint equality, POST stores the normalized `rawToUsdc(budgetRaw)` so DB always round-trips the parsed value).
- `BigInt(body.jobId)` on garbage: throws → 400; `true` coerces to 1n but chain verification rejects it.
- Net-payout snapshot: computed once at POST create with contract-mirroring bigint floor math, never recomputed (ask-page preview is float but explicitly display-only).

## Positive Observations

- Finalize live-guard design is exactly right: chain state is the only authority for draft→open, and both CAS clauses prevent status regression.
- `/job` verification (description/provider/evaluator/client/status) with idempotent re-bind is well thought out — it just needs the two missing fields (C1).
- `toBytes32Reason` byte-level truncation note shows real care around multibyte edge cases.
- Fee reads sequential on purpose for the rate-limited RPC, with the reason documented inline.

## Recommended Actions (priority order)

1. **C1**: add `expiredAt` + `hook` checks to `/job`; add `expiredAt > now` to `/finalize`. (~10 lines, do before Phase 3.)
2. **H1**: step-4 finalize retry path in the wizard hook + button; make step-3 retry funded-aware.
3. **M1/M2**: `.select()` on the `/job` CAS; schema default `'draft'` + CHECK constraint (fold into Phase 3 migration).
4. **M3**: try/catch chain reads in GET + retry button in wizard error state.
5. L1-L6 as time allows; none block Phase 3.

## Metrics

- Type coverage: full (strict TS, no `any` observed in reviewed files; one justified `as unknown as Criteria` cast on the page).
- Tests: none in reviewed scope (E2E 12/12 per brief — happy path only; H1 is precisely the off-happy path E2E missed).
- Lint/compile: not run (review-only session).

## Unresolved Questions

1. Does the contract's `createJob` enforce `expiredAt > block.timestamp`? If not, a stale-draft resume could fund an already-expired job (funds recoverable via `claimRefund`, but bad UX) — the C1 finalize check covers this regardless.
2. Hook semantics on this ERC-8183 implementation are unverified (which callbacks fire, whether a hook can block `complete`). The zero-address check in C1 is correct either way; worth a one-off Arcscan source read before Phase 3.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Phase 2 core design (live guard, CAS, fee snapshot, XSS-safe rendering) is solid, but two issues need fixing before Phase 3: the `/job` route never verifies onchain `expiredAt`/`hook` (asker-side early-expiry rug that defeats the no-rug guarantee), and a funded-but-finalize-failed question dead-ends at step 4 with no retry path, stranding locked funds in `draft`.
