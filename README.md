# AskBounty

Post a question, lock a USDC budget in ERC-8183 escrow on Arc Testnet. Answer providers submit responses; an evaluation agent (objective code checks + Claude) scores them against the asker's written acceptance criteria. The first passing answer is paid instantly from escrow; if the deadline passes with no accepted answer, the asker claims a refund.

Built for the "Build on Arc" hackathon, Agentic Economy track.

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · viem/wagmi · Supabase (service-role writes only, RLS denies client writes) · **Google Gemini API (free tier)** for answer evaluation · Vercel.

> **LLM provider note:** the PRD specifies the Claude API for evaluation; the demo runs on Gemini free tier for cost reasons (PRD-ERRATA E5). The eval client is provider-swappable — switching back touches only `lib/eval/llm-client.ts` (same input/output interface, structured JSON verdict: `topics[]`, `overall`, `reasoning`).

| Item | Value |
|---|---|
| Network | Arc Testnet, chain ID `5042002` |
| AgenticCommerce (ERC-8183) | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| USDC (6 decimals, also gas token) | `0x3600000000000000000000000000000000000000` |
| Explorer | https://testnet.arcscan.app |

## Known limitation: agent is both provider and evaluator

The shared pre-deployed AgenticCommerce contract sets the provider at job creation and only allows `ADMIN_ROLE` to change it while the job is still `Open`. We hold no admin role, and the winning answerer is unknown until after funding — so assigning the winner as onchain provider is impossible ("Option A" in the PRD).

We therefore run **Option B**: the AskBounty agent wallet is the fixed provider **and** evaluator for every job. On acceptance, `complete()` pays the escrow out to the agent wallet, and the agent immediately forwards **the full amount the escrow released to it** to the winner in a second ERC-20 transfer — the agent never retains any part of the release, including any future evaluator fee ("what comes in goes out"). This is a centralization trade-off, disclosed openly:

- The budget is still provably locked in escrow from the moment the question is posted — the asker cannot rug-pull answerers.
- Every receipt shows **both** transactions (escrow→agent and agent→winner) with Arcscan links, so anyone can verify the agent kept nothing. If the released amount ever differs from the snapshot shown at question creation (admin fee change), the full released amount is still forwarded and the receipt displays both numbers; an ambiguous multi-leg release fails loud (`payout_failed`) rather than guessing.
- The winner receives **exactly** the net amount displayed on the question page before anyone wrote a word ("Bounty 20 USDC · winner receives X.XX USDC after protocol fees" — computed from live `platformFeeBP`/`evaluatorFeeBP` reads, never hardcoded). Forward-hop gas is absorbed by the agent wallet, never deducted from the winner.
- The trust assumption is: the agent wallet forwards the payout honestly. A payout state machine (`accepted → payout_pending → paid`) with cron retries and a visible "payout pending" status makes any failure loud, not silent.
- Pending answers are publicly readable; acceptance order follows submission order, so copying a pending answer cannot outrank the original. Private submissions are a v2 item.
- Askers reclaim funds via expiry refund; explicit early-cancel is a v2 convenience. The escrow always has a refund path once the deadline passes, so funds can never be stranded — cancel would only add convenience, not safety.
- The LLM evaluator has no real-time knowledge beyond the injected current date; questions requiring live external facts (prices, news) are out of scope for reliable auto-evaluation. When the evaluator cannot judge reliably, it fails closed: the bounty stays in escrow and refunds at expiry, so funds are never misdirected.
- Expiry is swept by a daily cron (`/api/cron/sweep`, Vercel Hobby limit), so a question can sit past its deadline for up to 24h before the refund button appears; browse already hides past-deadline questions, and the escrow itself is claimable the second `expiredAt` passes.
- `claimRefund` on the deployed contract is permissionless as to CALLER, but the funds always go to the asker (verified live, PRD-ERRATA E6) — the asker-only refund button is a UX choice, not the security boundary. The recorded receipt link is verified by decoding the tx calldata (`claimRefund(jobId)`), so it cannot be forged.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill secrets (see below)
npm run dev
```

### Environment

See `.env.example`. Public chain constants are prefilled. You must supply: `EVALUATOR_PRIVATE_KEY` (agent wallet), `ANTHROPIC_API_KEY`, `CRON_SECRET`, and the Supabase trio. Gas on Arc is USDC — the agent wallet must hold testnet USDC.

### Database

Run `lib/supabase/schema.sql` in the Supabase SQL editor. RLS is enabled with public read and **no** client write policies — all writes go through API routes using the service-role key.

### Onchain dry-run (Phase 1 gate)

```bash
npx tsx scripts/dry-run-lifecycle.ts
```

First run generates throwaway wallets into `.env.local` and prints funding instructions. Fund the asker + agent wallets with Arc Testnet USDC via https://faucet.circle.com (select "Arc Testnet"), then re-run. A passing run executes `createJob → setBudget → fund → submit → complete → forward` and prints the live fee BPs, the resolved `setBudget` caller, and both payout tx links.
