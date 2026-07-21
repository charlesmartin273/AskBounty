# Brainstorm Report: AskBounty Architecture

Date: 2026-07-20 | PRD: `AskBounty-PRD-EN.md` | Status: APPROVED by user

## Problem statement

Q&A bounty dApp on Arc Testnet: asker escrows USDC via ERC-8183 (AgenticCommerce `0x0747EEf0706327138c69792bF28Cd525089e4583`), eval agent (code checks + Claude) scores answers, instant payout on pass, refund on expiry. 5-day hackathon build.

## Research findings (Arcscan ABI + verified source, 2026-07-20)

Proxy `0x0747…4583` → implementation `0xA316fd02827242D537F84730F8a37D0BA5fd351a` (verified, Blockscout).

- **PRD Option A NOT viable.** `setProvider(jobId, provider)` exists but is `ADMIN_ROLE`-only AND only in `Open` status (pre-fund). We hold no admin on shared contract; winner unknown until post-fund. → **Option B mandatory** (agent wallet = fixed provider, forwards to winner).
- **Protocol fees exist, PRD silent.** `complete()` splits: `platformFeeBP`→treasury, `evaluatorFeeBP`→evaluator (our agent), remainder→provider. Winner gets budget minus fees. Fee BP values: read onchain Day 1 (`platformFeeBP()`, `evaluatorFeeBP()` views).
- **`claimRefund` client-only** (`msg.sender == client`, `block.timestamp > expiredAt`, status `Funded`). Auto-refund by agent impossible → "Claim refund" button, asker wallet.
- Lifecycle: `createJob(provider, evaluator, expiredAt, description, hook)` → `setBudget(jobId, amount)` → `fund(jobId)` (pulls USDC from msg.sender) → `submit(jobId, bytes32 deliverable)` → `complete(jobId, reason)` (evaluator-only). Enum: Open, Funded, Submitted, Completed, Rejected, Expired.
- Bonus: `submit()` anchors keccak256(answerBody) onchain — winning answer hash-provable.
- Unverified (source fetch truncated): `setBudget` caller restriction (docs imply provider-only). Verify Day 1 via live testnet call.

Sources: docs.arc.io ERC-8183 tutorial, arc.network blog, testnet.arcscan.app API.

## Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Escrow path | Option B forced by ABI (research resolved PRD's Day-1 question early) |
| Eval trigger | Trigger-on-submit (instant, demo-safe, Hobby-plan-safe) + daily cron sweeper for expiry/stuck evals |
| Auth | Per-submission wallet signature over `(questionId, contentHash)`, verified server-side w/ viem `verifyMessage`. No SIWE, no sessions |
| Cuttable if tight | Browse filters, My Activity page, auto-refund (moot — contract forbids it anyway) |
| Must-have | Ask+fund flow, question page, answer flow, eval agent, payout, claim-refund, simple browse list |

## Final architecture

Single Next.js (App Router) on Vercel. Supabase = app DB, **writes only via API routes with service-role key; RLS denies client writes** (prerequisite for signature auth to mean anything). viem/wagmi, Tailwind + shadcn/ui, Claude API.

### Onchain flow (Option B)
- **Ask (3-step wizard, asker wallet = client):** (1) `createJob(provider=agent, evaluator=agent, expiredAt=deadline, description=questionId, hook=0x0)` — jobId from receipt event; (2) backend `setBudget(jobId, budget)`; (3) asker `approve` + `fund(jobId)`. Question live only after fund confirms.
- **Accept:** backend `submit(jobId, keccak256(answerBody))` → `complete(jobId, reason)` → USDC lands on agent wallet → agent ERC-20 transfer of full provider remainder to winner.
- **Expiry:** cron marks DB status expired; asker sees Claim Refund button → `claimRefund(jobId)`.

### Payout transparency (user-mandated, non-negotiable)

1. **Exact net number upfront.** Question page shows BEFORE anyone answers: "Bounty 20 USDC · winner receives X.XX USDC after protocol fees." X computed from live onchain fee BP reads at question creation (re-read, don't hardcode — BPs mutable by admin). Second-hop gas paid by agent wallet in USDC, NOT deducted from winner — winner receives exactly the provider remainder. Answerer never discovers shortfall after work done.
2. **Dual-tx receipt.** Receipt shows BOTH transactions with Arcscan links: escrow→agent (`complete`) and agent→winner (forward). Anyone can verify agent kept nothing beyond protocol evaluator fee. Agent-as-provider+evaluator centralization trade-off documented openly in README as known limitation — not hidden.
3. **Second-hop failure handling.** Payout state machine on answers: `accepted → payout_pending → paid` (+ `payout_failed` internal). Forward tx recorded separately from complete tx. Cron retries failed forwards. Winner-visible status: "Payout pending, retrying" — never silent. Agent wallet low-gas warning surfaced (gas on Arc = USDC).

### Race safety
First-pass-wins under trigger-on-submit: payout gated by CAS on `questions.status` (`open→answered`); only CAS winner pays out. Eval endpoint idempotent; complete_tx + forward_tx recorded. Cron re-evaluates stuck `pending` answers in created_at order.

### Eval agent (per PRD §3)
Objective checks in code first (free, injection-immune), Claude one-signal for topics w/ delimited untrusted input, per-check results stored + shown. Per-wallet cooldown vs spam.

## Rejected alternatives

- **Queue/worker (Inngest/QStash) for eval:** over-engineered for 5 days; trigger-on-submit + cron sweeper suffices.
- **Chain-as-truth event indexing:** slow to build; Supabase-as-truth + tx links honest enough for hackathon.
- **Full SIWE sessions:** dependency + flow cost, no added value over per-submission signatures here.
- **Vercel Pro 5-min cron as sole trigger:** paid plan + up-to-5-min demo dead air.

## Risks

| Risk | Mitigation |
|---|---|
| `setBudget` caller unknown | Day-1 live testnet dry-run of full job lifecycle before building UI |
| Fee BPs change mid-flight | Read live at question creation; display net; re-check at payout |
| Forward hop fails | State machine + cron retry + visible status (above) |
| Two answers race | CAS + idempotent eval endpoint |
| 3-step ask wizard UX drop-off | Per-step status UI, resumable (jobId persisted after step 1) |
| Agent wallet out of USDC gas | Low-balance warning; fund at setup |

## Success metrics

Demo: post question live → lazy answer rejected w/ per-check reasons → good answer passes → both txs on Arcscan → USDC in winner wallet, all within seconds of submission. Net-payout number shown upfront matches received amount exactly.

## Next steps

1. `/ck:plan` from this report (user to confirm).
2. Day 1 gate: live testnet dry-run of createJob→setBudget→fund→submit→complete with throwaway wallets; read fee BPs; confirm setBudget caller. Blocks all UI work on ask flow.
3. Write README limitation section (agent centralization trade-off) at project init, not at polish time.

## Unresolved questions

- `setBudget` access control (provider-only vs client) — Day 1 dry-run.
- Actual `platformFeeBP` / `evaluatorFeeBP` values — Day 1 onchain read.
- `description` field size limit/cost for createJob (store questionId only, not full text) — assumed cheap, verify.
