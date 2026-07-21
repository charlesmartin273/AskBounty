# Phase 1 — Foundations + Onchain Dry-Run Gate

## Context Links
- PRD: `AskBounty-PRD-EN.md` §7, §8 (Day 1), Appendix (env vars)
- Architecture: `plans/reports/brainstorm-260720-1544-askbounty-architecture.md` (Research findings, Onchain flow)
- Errata: `plans/PRD-ERRATA.md` (E1, E2, E3 + open verifications)

## Overview
- **Priority:** P1 (blocking gate for all onchain work)
- **Status:** audit-pass — awaiting user approval (evidence: `plans/PHASE1-AUDIT.md`)
- **Description:** Scaffold Next.js app, wire env + chain/contract config + minimal ABI, build viem clients (public + agent wallet), stand up Supabase schema with RLS, build escrow + Claude eval helper modules, and run a full-lifecycle testnet dry-run with throwaway wallets. Record fee BPs and `setBudget` caller restriction in errata. **No ask-flow UI begins until this dry-run passes.**

## Key Insights
- Option A dead (E1): agent wallet is fixed provider+evaluator. Design everything around the two-hop payout.
- Protocol fees exist (E2): winner net = budget − platformFeeBP − evaluatorFeeBP. Must read BPs live, never hardcode.
- `claimRefund` is client-only (E3): no agent refund path; UI button only.
- **Unknown to resolve:** `setBudget(jobId, amount)` caller. Docs imply provider-only (agent). If it turns out client-only, the 3-step wizard order changes (asker would call setBudget, not backend). This is why the dry-run gates the wizard.
- Gas on Arc = USDC. Agent wallet must hold USDC for setBudget/submit/complete/forward.

## Requirements
**Functional:** Reproducible testnet lifecycle run; readable fee BPs; helper modules callable from API routes.
**Non-functional:** All secrets server-side only; helpers <200 lines each; config single-source (no magic addresses in code).

## Architecture
Data flow: `.env` → `lib/chain/config.ts` → viem `publicClient` (reads) + `agentWallet` (writes, signs with `EVALUATOR_PRIVATE_KEY`). Escrow helper wraps AgenticCommerce calls. Supabase server client (service-role) is the only writer; RLS blocks anon writes. Claude helper wraps Anthropic Messages API returning strict JSON.

Minimal ABI (only what we use): `createJob`, `setBudget`, `fund`, `submit`, `complete`, `claimRefund`, `platformFeeBP`, `evaluatorFeeBP`, plus the job-created event and `jobs(uint256)` view. USDC ABI: `approve`, `allowance`, `balanceOf`, `transfer`, `decimals`.

## Related Code Files
**Create:**
- `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`, `.env.local` (gitignored)
- `lib/chain/config.ts` — chain def (Arc Testnet 5042002), contract + USDC addresses from env
- `lib/chain/abi-agentic-commerce.ts` — minimal ABI array
- `lib/chain/abi-usdc.ts` — minimal ERC-20 ABI
- `lib/chain/clients.ts` — `publicClient`, `agentWalletClient` (server-only)
- `lib/escrow/escrow-service.ts` — `createJob`, `setBudget`, `fund`, `submit`, `complete`, `claimRefund`, `readFeeBps`, `forwardToWinner`, `computeNetPayout`
- `lib/supabase/server-client.ts` — service-role client (server-only)
- `lib/supabase/schema.sql` — questions + answers tables (extended, see below)
- `lib/eval/claude-client.ts` — `callClaude({system,user}) → parsed JSON`
- `scripts/dry-run-lifecycle.ts` — throwaway-wallet lifecycle runner
- `README.md` — project intro + **limitation section** (agent centralization) written NOW, not at polish
- `.gitignore`

**Modify:** none (greenfield).

## Implementation Steps
1. Scaffold: `npx create-next-app@latest . --ts --tailwind --app --eslint` (accept src-less `app/` at root or `src/app` — pick one, be consistent). Install: `npm i viem wagmi @tanstack/react-query @supabase/supabase-js @anthropic-ai/sdk`. Init shadcn/ui: `npx shadcn@latest init` then add `button card input textarea badge` as needed later.
2. Create `.env.example` mirroring PRD appendix (all 9 vars). Copy to `.env.local`, fill RPC/chain/contract/USDC (known), plus `EVALUATOR_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, Supabase trio.
3. `lib/chain/config.ts`: define `arcTestnet` via viem `defineChain` (id 5042002, rpc from `NEXT_PUBLIC_ARC_RPC_URL`, native currency USDC 6 decimals, block explorer `https://testnet.arcscan.app`). Export `AGENTIC_COMMERCE`, `USDC_ADDRESS` from env with `0x`-cast.
4. `lib/chain/abi-*.ts`: hand-write minimal ABIs (see Architecture). Keep as `const [...] as const` for viem type inference.
5. `lib/chain/clients.ts`: `publicClient = createPublicClient({chain, transport: http()})`. `agentWalletClient = createWalletClient({account: privateKeyToAccount(process.env.EVALUATOR_PRIVATE_KEY), chain, transport: http()})`. Guard: throw if key missing; never import this into a client component.
6. `lib/escrow/escrow-service.ts` (split into 2 files if >200 lines — e.g. `escrow-reads.ts` + `escrow-writes.ts`):
   - `readFeeBps()` → `{platformFeeBP, evaluatorFeeBP}` via publicClient `readContract`.
   - `computeNetPayout(budget, bps)` → `budget - budget*platformBP/10000 - budget*evaluatorBP/10000` in 6-dec integer math (use bigint, no float).
   - Write wrappers each return tx hash; `createJob` also parses receipt logs for jobId (decode job-created event).
   - `forwardToWinner(winner, amount)` → USDC `transfer` from agent wallet.
7. `lib/supabase/schema.sql`: PRD §6b base **extended** — questions: add `job_id BIGINT` (already in §6b), `net_payout NUMERIC`, `platform_fee_bp INT`, `evaluator_fee_bp INT`. answers: add `complete_tx TEXT`, `forward_tx TEXT`, `payout_status TEXT DEFAULT NULL` (`payout_pending|paid|payout_failed`), `content_hash TEXT`, `signature TEXT`. Add RLS: `ENABLE ROW LEVEL SECURITY` on both, **no** insert/update policy for anon/authenticated (service-role bypasses RLS). Add index on `answers(question_id, created_at)`.
8. Run schema in Supabase SQL editor. `lib/supabase/server-client.ts`: `createClient(url, SERVICE_ROLE_KEY, {auth:{persistSession:false}})`.
9. `lib/eval/claude-client.ts`: wrap Anthropic SDK; system+user in, `response_format`-style strict-JSON parse (Claude returns text — `JSON.parse` with try/catch, retry once on parse failure). Model: a current Claude model. Keep <200 lines.
10. `scripts/dry-run-lifecycle.ts` (run with `tsx`): generate throwaway asker wallet (`generatePrivateKey`), fund it manually with testnet USDC beforehand (document faucet step in README). Then: (a) read fee BPs, log them; (b) asker `createJob(agent, agent, deadline, "dryrun", 0x0)` → capture jobId; (c) attempt `setBudget(jobId, 1_000000)` **from agent wallet**; if it reverts, retry **from asker wallet** — log which succeeded (this resolves the open verification); (d) asker `approve` USDC to contract + `fund(jobId)`; (e) agent `submit(jobId, keccak256("test answer"))`; (f) agent `complete(jobId, "dryrun pass")`; (g) read agent USDC balance delta = provider remainder; (h) agent `forwardToWinner` to a throwaway winner; log both tx hashes + Arcscan links.
11. Record in `plans/PRD-ERRATA.md` open-verifications: actual `platformFeeBP`/`evaluatorFeeBP` values, `setBudget` caller answer, and any `description` size surprise.
12. Compile check: `npx tsc --noEmit`. Fix errors.

## Todo List
- [ ] Scaffold Next.js + install deps + shadcn init
- [ ] `.env.example` + `.env.local` filled
- [ ] chain config + both ABIs
- [ ] viem clients (public + agent)
- [ ] escrow service (reads/writes, net payout, forward)
- [ ] Supabase schema.sql (extended + RLS) applied
- [ ] supabase server client
- [ ] claude eval client
- [ ] dry-run script runs full lifecycle on testnet
- [ ] fee BPs + setBudget caller recorded in errata
- [ ] README limitation section written
- [ ] `tsc --noEmit` clean

## Success Criteria
- Dry-run script prints jobId, both fee BPs, both payout tx hashes with valid Arcscan links, and the resolved `setBudget` caller.
- Winner throwaway wallet USDC balance increases by exactly the computed net payout.
- `plans/PRD-ERRATA.md` open-verifications section updated with concrete values.
- `tsc --noEmit` passes.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| `setBudget` caller ≠ assumption | Med×High | Dry-run tries both callers; wizard order (Phase 2) decided by result |
| Fee BPs surprisingly high (e.g. winner gets ~0) | Low×High | Read + log; if pathological, flag to user in errata, not silently proceed |
| Agent wallet lacks USDC gas | Med×High | Fund at setup; script checks balance first, aborts with clear message |
| Testnet RPC flaky | Med×Med | Retry transport; document alt RPC |
| `description` field rejects long strings | Low×Med | Store only questionId (short), verify in dry-run |

## Security Considerations
- `EVALUATOR_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` server-only; never in `NEXT_PUBLIC_*`, never imported by client components.
- RLS enabled with no client write policy — signature auth (later phases) is meaningless without this.
- `.env.local` gitignored; verify before any commit.

## Next Steps
Unblocks Phase 2 (ask flow needs escrow helper + confirmed wizard order) and Phase 4 (payout needs forward + fee reads). Do not start either until dry-run green.

---

## MANUAL TEST GUIDE
1. In terminal, run `npx tsx scripts/dry-run-lifecycle.ts`.
   - **Expect:** logs showing `platformFeeBP=…`, `evaluatorFeeBP=…`, a jobId, "setBudget succeeded from <agent|asker>", a fund tx, a complete tx, a forward tx, and two `https://testnet.arcscan.app/tx/…` links.
   - **Likely failure:** revert on `fund` → asker throwaway wallet not funded with testnet USDC (top up via faucet). Revert on `complete` → called from non-evaluator wallet (must be agent). Hang → RPC down, switch `NEXT_PUBLIC_ARC_RPC_URL`.
2. Open the two Arcscan links in a browser.
   - **Expect:** both txs show `Success`, the forward tx shows USDC transfer to the winner throwaway address.
   - **Likely failure:** "not found" → wrong explorer host or tx not yet mined; refresh after ~10s.
3. Open Supabase dashboard → Table editor.
   - **Expect:** `questions` and `answers` tables exist with the extended columns; RLS shows enabled with no anon write policy.
   - **Likely failure:** columns missing → re-run `schema.sql`.
4. Run `npx tsc --noEmit`.
   - **Expect:** no output (clean).
   - **Likely failure:** ABI `as const` missing → viem type errors on `readContract`.
