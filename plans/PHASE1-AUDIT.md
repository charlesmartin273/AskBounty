# PHASE 1 AUDIT — Foundations + Onchain Dry-Run Gate

Date: 2026-07-20 · Status: **PASS (onchain gate)** — 2 env items pending user input (see §6)

## 1. Deviations vs PRD/plan (audit step 1)

| # | Deviation | Resolution |
|---|-----------|------------|
| 1 | PRD/plan pseudo-ABI wrong: `complete(reason)` is **bytes32** not string; `setBudget/fund/submit/complete` take trailing `bytes optParams` | ABI hand-written from live Arcscan ABI; `toBytes32Reason()` truncates to 31 bytes. Recorded as PRD-ERRATA **E4** |
| 2 | PRD §1/§5 "20 USDC released to B" | True today (BPs = 0/0) but app computes net from live fee reads per E2 — never hardcoded |
| 3 | Plan file `tailwind.config.ts` | Not created — Tailwind v4 uses CSS-based config, no config file needed |
| 4 | Plan file `escrow-service.ts` | Split into `escrow-reads.ts` + `escrow-writes.ts` (plan explicitly allowed split) |
| 5 | Plan ABI item `jobs(uint256)` | Used `getJob(uint256)` (named tuple, cleaner decode) |
| 6 | Plan `agentWalletClient` const export | Lazy `getAgentWalletClient()` — avoids throw at build time when env missing |
| 7 | Plan "fund asker manually beforehand" | Improved: single faucet drip to asker; script auto-tops-up agent gas (2 USDC) |
| 8 | Plan risk "Testnet RPC flaky" materialized | Public RPC rate-limits bursts (`-32011 request limit reached`). Added `lib/chain/rpc-transport.ts`: fallback (primary → Blockscout `api/eth-rpc`) + retry + sequential reads + 2s step pacing |

## 2. Real run evidence (audit steps 2 & 5)

`npx tsx scripts/dry-run-lifecycle.ts` — full lifecycle executed **twice** on Arc Testnet (jobs **158901**, **158903**), second run after RPC fixes, exit=0:

```
[fees] platformFeeBP  = 0
[fees] evaluatorFeeBP = 0
[fees] 20 USDC bounty -> winner receives 20.000000 USDC (20000000 raw)
[createJob] jobId=158903 tx=…/0x0235511027593cd11be5d20bf0aed27a9ed421313d78fbdb89b65767c6096799
[setBudget] SUCCEEDED from AGENT tx=…/0x0ee9e2dbb3fd0dfef49280098c2a4e85acdbb4a4c6c572892948aa92acdffde9
[approve] tx=…/0xba4336e71cbf4f6cec6b5880a056e6c37ed71ccaa6c2e46161fccb9987581f2e
[fund] tx=…/0xf52da61be7cc0b826ca9e93b97e19509af0ee9730329fe1128631c011a81138d
[fund] job status=1 (Funded)
[submit] tx=…/0x19dc21cb5188f35370a8f0b29ff916f25bc4296dc1ca8c781a809def40a184e2
[complete] tx=…/0xa57d4d861bba757d7a8dbd1cf837977ab04aea352dde5388d32e89a5f617acca
[complete] job status=3 (Completed)
[forward] tx=…/0xe5f39d4b55a4b1dba7db6c5f0c75cef4dff90cc187fd30d7ddab38025429bf9a
[forward] winner delta=1.000000 USDC expected=1.000000 USDC
===== DRY-RUN PASS =====
```

(tx prefix: `https://testnet.arcscan.app/tx/`) Winner throwaway balance increased by **exactly** the computed net payout on both runs (2.000000 USDC total). Wallets: agent `0x8065E80AE2155412d896A5FF761933F8D129c200`, asker `0x8cBd222c2BF71D4d18D421ec05AFFb752892310F`, winner `0x072c3677dDF18fFF5D974b9d6A6D198C16d928f3` (throwaway, keys in gitignored `.env.local`). Bonus finding: native balance = ERC-20 balance ×10¹² → USDC at `0x3600…0000` mirrors native gas balance (native 18-dec, ERC-20 view 6-dec); gas spend reduces the same balance.

### The three gate answers

1. **Who can call `setBudget`:** the **provider = agent backend wallet** only. Client/asker call reverts (custom error). Phase 2 wizard order confirmed: asker `createJob` → backend `setBudget` → asker `approve`+`fund`.
2. **Live fees:** `platformFeeBP = 0`, `evaluatorFeeBP = 0` (admin-mutable; app must keep reading live).
3. **20 USDC bounty → winner receives exactly `20.000000 USDC`** today. Question-page copy: "Bounty 20 USDC · winner receives 20.00 USDC after protocol fees" (number computed at creation from live reads, re-checked at payout).

## 3. Edge cases (audit step 3)

`npx tsx scripts/dry-run-edge-cases.ts 158903` — **5/5 PASS**:

| Edge case | Result |
|-----------|--------|
| `computeNetPayout` rounding (2.5%+2.5% on 333333, and 0) | PASS — floor math, net 316667, no drift |
| `toBytes32Reason` long unicode input | PASS — no throw, 32-byte value |
| `setBudget` from client (asker) | PASS — reverts (provider-only), resolves open verification |
| `fund` with budget>0, no approve | PASS — reverts on allowance |
| double `complete` on Completed job | PASS — reverts on status |

## 4. Bugs found & fixes (audit step 4)

1. **RPC burst rate-limit** crashed first run → fixed (fallback transport, sequential reads, pacing). Re-run green.
2. **Edge-test design flaw:** first "fund without approve" test used a zero-budget job and *succeeded* — revealed real contract behavior: **`fund` on a zero-budget job succeeds without approve** (transferFrom(0)), job goes Funded with 0 escrowed. Test fixed (budget>0 → reverts as expected). **Phase 2 guard recorded:** question is "live" only if `getJob().budget > 0` AND status=Funded — never trust status alone.
3. `tsconfig` target ES2017 → ES2020 (BigInt literals).
4. Findings 1–2 + E4 recorded in `plans/PRD-ERRATA.md`.

## 5. Verification (audit step 5) + code review

- Second full lifecycle run after fixes: PASS (job 158903, above).
- Edge-case suite after fix: 5/5 PASS.
- `npx tsc --noEmit`: clean (exit 0).
- `code-reviewer` agent pass (`plans/reports/code-reviewer-260720-1609-phase1-review.md`), status DONE_WITH_CONCERNS:
  - **H1 (verified bug, FIXED):** `toBytes32Reason` threw when byte-31 truncation split a multibyte UTF-8 char (Vietnamese reasons at the wrong boundary → payout stuck client-side). Fixed with byte-level truncate + right-pad, no string round-trip. Verified against `'a'*30+'é'`, `'a'*31+'✓'`, long Vietnamese strings — all produce valid 32-byte values; repro cases added to `scripts/dry-run-edge-cases.ts`.
  - **H2/M1/M2/M3 (Phase 3 requirements, recorded):** nonce serialization for the shared agent wallet, double-accept unique index + CAS, forward amount parsed from `PaymentReleased` event, fail-closed schema validation of Claude verdicts. Written into `phase-03-answer-flow-and-evaluation-agent.md` → Requirements.
  - **M4 (user decision needed):** pending answer bodies are publicly readable (RLS public SELECT) → answer-sniping possible. See unresolved question 4.

## 6. Phase 1 todo status

| Item | Status |
|------|--------|
| Next.js scaffold + deps + shadcn init | ✅ |
| `.env.example` + `.env.local` | ✅ (throwaway keys auto-generated) |
| Chain config + ABIs + viem clients | ✅ |
| Escrow service (reads/writes/net/forward) | ✅ |
| `lib/supabase/schema.sql` + server client | ✅ applied 2026-07-21 (project `lazafevtjtzhutogvxej`) — verified: both tables + extended cols exist, anon INSERT → 401 `42501` RLS violation, service-role INSERT → 201, anon SELECT → 200 |
| Claude eval client | ✅ written · ⚠️ not exercised — **no `ANTHROPIC_API_KEY` in env** (not needed until Phase 3) |
| Dry-run full lifecycle PASS | ✅ |
| Fee BPs + setBudget caller in errata | ✅ |
| README limitation section | ✅ |
| `tsc --noEmit` clean | ✅ |

## Unresolved questions (need user input)

1. ~~Supabase credentials~~ — RESOLVED 2026-07-21: env filled, schema applied + RLS verified.
2. ~~`ANTHROPIC_API_KEY`~~ → replaced by `GEMINI_API_KEY` (PRD-ERRATA E5), filled 2026-07-21. ~~`CRON_SECRET`~~ — filled 2026-07-21.
3. ~~Agent wallet~~ — RESOLVED 2026-07-21 (user): KEEP throwaway `0x8065E80AE2155412d896A5FF761933F8D129c200` as the official agent wallet for the whole hackathon (testnet only, clean dry-run history on Arcscan for judges). Key stays in gitignored `.env.local`.
4. ~~Review M4~~ — RESOLVED 2026-07-21 (user): ACCEPTED for MVP. First-pass-wins by `created_at` means a copied answer always evaluates after the original, so sniping cannot outrank it. Limitation line added to README; private submissions = v2.
