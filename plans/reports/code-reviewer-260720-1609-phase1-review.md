# Code Review — Phase 1 Foundation (AskBounty)

Date: 2026-07-20 | Reviewer: code-reviewer agent
Scope: lib/chain/*, lib/escrow/*, lib/supabase/*, lib/eval/claude-client.ts, scripts/dry-run-*.ts (13 files, ~700 LOC)
Focus: correctness (bigint/ABI/errors), security (keys/RLS/injection), bugs that would break Phase 2-4.

## Overall Assessment

Solid foundation. Secret handling is correct (`server-only` on all three key-touching modules, scripts isolated, `.env*` gitignored, lazy env reads so builds don't explode). Fee math is exact bigint mirroring validated on-chain. RLS posture is deny-by-default for writes. Found 1 verified High bug on the payout path, 1 High forward-looking concurrency gap, and 4 Medium items Phase 2-4 must address.

## High

### H1. `toBytes32Reason` throws when truncation splits a multibyte char — VERIFIED
`lib/escrow/escrow-writes.ts:27-30`

The byte-slice → `TextDecoder` round-trip replaces a dangling partial UTF-8 sequence with U+FFFD (3 bytes when re-encoded), so the re-encoded string can exceed 31 bytes and `stringToHex(..., {size: 32})` throws.

Reproduced locally:
```
toBytes32Reason('a'.repeat(30) + 'é')
// SizeOverflowError: Size cannot exceed 32 bytes. Given size: 33 bytes.
```

Failure scenario: Phase 3 calls `completeJob(ctx, jobId, reason)` with a reason containing non-ASCII (Vietnamese criteria text, `—`, `✓`) whose 31st byte lands mid-character. Evaluation passed, but `complete()` throws client-side before any tx is sent → payout stuck in Submitted state. The edge-case test (`dry-run-edge-cases.ts:52`) passed by coincidence — its slice boundary falls on ASCII `y`.

Fix — pad the truncated bytes directly, no string round-trip:
```ts
import { bytesToHex, pad } from "viem";
export function toBytes32Reason(reason: string): `0x${string}` {
  const truncated = new TextEncoder().encode(reason).slice(0, 32);
  return pad(bytesToHex(truncated), { size: 32, dir: "right" });
}
```
(Also allows the full 32 bytes instead of 31.)

### H2. No nonce serialization for the shared agent wallet (Phase 3 blocker)
`lib/chain/clients.ts:33-36`, `lib/escrow/escrow-writes.ts:32-39`

One `EVALUATOR_PRIVATE_KEY` signs submit/complete/forward. Each `writeContract` lets viem fetch the nonce independently. Two concurrent serverless invocations (two answers passing evaluation near-simultaneously on different questions) fetch the same nonce → "nonce too low" / replacement-underpriced → one payout tx fails mid-sequence. Invisible in the dry run because it is strictly sequential.

Fix before Phase 3: serialize all agent-wallet writes — simplest is a single evaluation queue (process answers one at a time via DB claim/lock), or viem's `nonceManager` on the account plus single-instance deployment. Document the choice in the Phase 3 plan.

## Medium

### M1. No DB guard against double-accept / double-payout
`lib/supabase/schema.sql:24-40`

Nothing enforces "at most one accepted answer per question". Two concurrent evaluations of answers to the SAME question (see H2) can both mark `accepted` and both trigger `forwardToWinner`. Escrow only pays once, but the agent wallet forwards twice — direct fund loss.

Fix: `CREATE UNIQUE INDEX one_accepted_per_question ON answers (question_id) WHERE status = 'accepted';` plus compare-and-set on `questions.status` (`UPDATE ... WHERE status = 'open'`, check affected rows) before paying.

### M2. Forward amount should come from the `PaymentReleased` event, not recomputation
`lib/escrow/escrow-writes.ts:128-138` (completeJob discards receipt), `scripts/dry-run-lifecycle.ts:155`

`forwardToWinner(agentCtx, winner, netBudget)` uses `computeNetPayout` with fee BPs read earlier. If admin changes `platformFeeBP`/`evaluatorFeeBP` between question creation (snapshot) and completion, the forwarded amount diverges from what the escrow actually paid the agent — agent wallet drains or winner is shortchanged, silently. The ABI already includes `PaymentReleased(jobId, provider, amount)`.

Fix: have `completeJob` return the receipt; parse `PaymentReleased.amount` from it and forward exactly that value in Phase 3.

### M3. `callClaude` returns unvalidated JSON cast to `T`
`lib/eval/claude-client.ts:54,60`

`JSON.parse(...) as T` — no shape validation on output that decides money movement. A prompt-injected answer body can steer the model to emit structurally-valid JSON with attacker-favorable fields, or malformed shape that crashes the caller. Also: if the second attempt still isn't JSON, a raw `SyntaxError` propagates.

Requirement for Phase 3 (record in plan): schema-validate the verdict (zod or manual field checks, clamp scores, whitelist status values) and map ALL callClaude failures to "evaluation failed" (fail-closed), never to "accepted".

### M4. Pending answer bodies are publicly readable — answer sniping
`lib/supabase/schema.sql:54-55`

`answers_public_read USING (true)` exposes `body` of pending answers while the question is open. Anyone can read a good pending answer via anon key, improve it slightly, resubmit. First-pass-wins ordering (idx on `question_id, created_at`) mostly mitigates — the original is evaluated first — but if the original fails one criterion the copycat fixed, the copycat wins. Product decision: acceptable for MVP demo, or restrict SELECT on pending answers (`USING (status <> 'pending')`). Flagging for user decision, not unilateral change.

## Low

- **L1** `config.ts:11` — `Number(garbage env)` → `NaN` chain id; fails later with confusing signature errors. Add a fallback-on-NaN if bored.
- **L2** `schema.sql:13` — `job_id BIGINT` vs on-chain `uint256`. Fine at current IDs (~158k); theoretical overflow only.
- **L3** `escrow-writes.ts:88-106` — if `fund` reverts after `approve`, an exact-amount allowance dangles. Negligible exposure.
- **L4** `dry-run-wallet-setup.ts:23-24` — `Number(v)` loses precision above ~9e9 USDC raw; script-only, fine.
- **L5** `rpc-transport.ts:10` — Blockscout eth-rpc proxy fallback may behave differently on write-path methods (estimateGas/sendRawTransaction); if primary rate-limits mid-write, errors can be confusing. Note only.
- **L6** `dry-run-wallet-setup.ts:13` — `ensureWalletKey` accepts any `0x`-prefixed string, no 66-char check; malformed key surfaces later as an opaque viem error.

## Positive Observations

- `import "server-only"` correctly guards clients.ts, server-client.ts, claude-client.ts; scripts build their own wallets and never import the guarded modules.
- Lazy env reads (`getAgentWalletClient`, `getSupabaseServerClient`, `getClient`) prevent build-time crashes without weakening runtime checks.
- RLS is deny-by-default for writes; service-role writer isolation is the right pattern.
- Bigint-only fee math with floor semantics matched on-chain behavior to the unit in the real testnet run.
- `writeAndWait` correctly checks `receipt.status` — a silently-reverted tx cannot be mistaken for success.
- Sequential RPC calls + fallback transport is a pragmatic answer to the rate-limited public RPC.

## Recommended Actions (priority order)

1. Fix H1 now (3-line change, verified repro above) and rerun the edge-case script with a boundary-splitting input.
2. Record H2 + M1 + M2 + M3 as explicit requirements in the Phase 3 plan (evaluation queue, partial unique index, PaymentReleased-derived forward amount, fail-closed schema validation).
3. Ask user to decide M4 (pending-answer visibility) before Phase 2 UI exposes it.

## Checklist Coverage

Concurrency: H2, M1. Error boundaries: H1, M3. API contracts: M2. Input validation: M3. Auth: on-chain auth enforced by contract roles; RLS write-deny correct. Data leaks: M4; no secret leaks found. N+1: n/a (no query loops yet). Backward compat: n/a (greenfield).

## Unresolved Questions

1. M4: is public readability of pending answer bodies accepted for the MVP demo?
2. Phase 3 deployment shape (single instance vs parallel serverless) — determines whether H2 needs a nonce manager or a queue.
