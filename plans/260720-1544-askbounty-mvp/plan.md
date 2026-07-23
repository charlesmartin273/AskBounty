---
title: "AskBounty MVP — 5-Day Hackathon Build"
description: "Q&A bounty dApp on Arc Testnet: escrow USDC via ERC-8183, agent evaluates answers, instant payout on pass, refund on expiry."
status: pending
priority: P1
effort: 5d
branch: main
tags: [hackathon, arc, erc-8183, escrow, nextjs, viem, supabase, claude]
blockedBy: []
blocks: []
created: 2026-07-20
---

# AskBounty MVP

## Overview

Post a question, lock USDC budget in ERC-8183 escrow (AgenticCommerce on Arc Testnet). Providers submit answers; an evaluation agent (code checks + Claude) scores them against asker-written criteria; first passing answer wins and is paid instantly from escrow; unaccepted budget refunds on expiry.

**Escrow is Option B (forced by ABI, see PRD-ERRATA E1):** agent backend wallet is fixed provider AND evaluator. On acceptance, `complete()` pays the agent wallet (minus protocol fees), then the agent forwards the provider remainder to the winner in a second ERC-20 tx. Both txs shown on receipt. Winner receives the exact net amount displayed upfront; forward-hop gas absorbed by agent.

**Sources of truth:** `AskBounty-PRD-EN.md` (WHAT) · `plans/reports/brainstorm-260720-1544-askbounty-architecture.md` (HOW) · `plans/PRD-ERRATA.md` (onchain reality — overrides PRD on conflict).

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · viem/wagmi · Supabase (writes only via API routes w/ service-role key; RLS denies client writes) · Gemini API free tier (eval LLM — PRD-ERRATA E5, provider-swappable via `lib/eval/llm-client.ts`) · Vercel + Vercel Cron.

## Phases

| # | Phase | File | Status | Blocks |
|---|-------|------|--------|--------|
| 1 | Foundations + Onchain Dry-Run Gate | [phase-01-foundations-and-onchain-dry-run-gate.md](phase-01-foundations-and-onchain-dry-run-gate.md) | audit-pass (awaiting approval, see ../PHASE1-AUDIT.md) | 2,3,4 |
| 2 | Ask Flow + Question Page | [phase-02-ask-flow-and-question-page.md](phase-02-ask-flow-and-question-page.md) | audit-pass (awaiting approval, see ../PHASE2-AUDIT.md) | 3,4 |
| 3 | Answer Flow + Evaluation Agent + Payout (expanded) | [phase-03-answer-flow-and-evaluation-agent.md](phase-03-answer-flow-and-evaluation-agent.md) | audit-pass (awaiting approval, see ../PHASE3-AUDIT.md) | 4 |
| 4 | Cron Sweep + Refund + Browse/Activity (payout+receipt moved to 3) | [phase-04-payout-refund-browse-activity.md](phase-04-payout-refund-browse-activity.md) | audit-pass (awaiting approval, see ../PHASE4-AUDIT.md) | 5 |
| 5 | Polish + Deploy + Demo | [phase-05-polish-deploy-demo.md](phase-05-polish-deploy-demo.md) | pending | — |

## Dependencies

- **Phase 1 dry-run is a BLOCKING GATE.** No ask-flow UI (Phase 2) or payout code (Phase 4) starts until the full lifecycle `createJob→setBudget→fund→submit→complete` runs on testnet with throwaway wallets, fee BPs are read, and `setBudget` caller restriction is confirmed. Findings → `plans/PRD-ERRATA.md` open-verifications.
- Phase 2 needs escrow helper + chain config (Phase 1).
- Phase 3 needs question page (Phase 2) + eval/Claude helper (Phase 1).
- Phase 4 needs answer accept path + eval (Phase 3).
- Phase 5 needs full flow deployable (Phase 4).

## Known trade-off (document at init, README)

Agent wallet is both provider and evaluator (centralization). Justified: shared pre-deployed contract grants us no ADMIN_ROLE, winner unknown until post-fund, so Option A is impossible (E1). Escrow lock invariant still holds; dual-tx receipt keeps the two-hop payout transparent.
