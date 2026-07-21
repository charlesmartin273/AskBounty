# Brainstorm & Planning: AskBounty MVP Architecture Resolved

**Date:** 2026-07-20 15:44
**Severity:** Medium
**Component:** AskBounty MVP / Arc Testnet Integration
**Status:** Resolved

## What Happened

Completed Day-0 brainstorm and planning cycle. Identified PRD, researched Arc Testnet ERC-8183 AgenticCommerce contract, discovered three critical architectural constraints, made scoping decisions with user, hydrated Phase 1–5 plan + task queue. No code written; all findings recorded in PRD-ERRATA.md and plan artifacts.

## The Brutal Truth

We almost shipped the obvious architecture. PRD's Option A (updatable provider via setProvider) looks clean on paper—contract owner updates the provider, everything flows. Then we actually read the ABI. setProvider is ADMIN_ROLE-only + restricted to Open status. That's a hard blocker: our agent wallet cannot be set mid-question-life. We're forced into Option B: agent acts as provider AND evaluator simultaneously, receives funds, forwards payout to winner. Two hops instead of one. Two tx receipts instead of one. This is not wrong, but it's constraint we have to design around.

Fee structures compound the pain. platformFeeBP + evaluatorFeeBP are baked into payout math. Winner doesn't get full budget—they get (budget - fees). We have to show EXACT net payout before answering, not estimate it. PRD assumed full budget flows through. It doesn't. That's a UX redesign we didn't plan for initially.

Refund model is client-only (claimRefund callable by questioner only). No auto-refund. Button required. Scope cut: auto-refund infrastructure won't happen in 5 days.

## Technical Details

- **Contract addresses (testnet.arcscan.app verified)**
  - Proxy: 0x0747EEf0706327138c69792bF28Cd525089e4583
  - Implementation: 0xA316fd02827242D537F84730F8a37D0BA5fd351a
  - ABI fetched Day 0; resolved PRD's Day-1 research question on time.

- **setProvider access control:** ADMIN_ROLE check + Open-status guard. Agent wallet cannot be set as mid-life provider. Forces dual-role model (provider + evaluator).

- **Payout math:** winnerPayout = budget - (budget * platformFeeBP / 10000) - (budget * evaluatorFeeBP / 10000). Must display to user BEFORE submission. Retroactive payout surprise = bad UX.

- **Refund flow:** Only questioner (original caller) can claimRefund. No delegation. No sweep.

## What We Tried

1. **Option A (updatable provider):** Rejected. Access control prevents it.
2. **Option B (dual-role agent):** Accepted. Dual-tx model documented in architecture.
3. **Auto-refund on timeout:** Rejected. Contract design doesn't support it. Marked as cuttable scope.
4. **Broadcast eval + retry:** Rejected (Vercel Hobby cron limit). Per-submission wallet signatures + trigger-on-submit eval + daily cron sweeper adopted instead.

## Root Cause Analysis

PRD was written against AgenticCommerce specification, not against actual contract source + access control model. Specification promises flexibility; implementation enforces constraints. ADMIN_ROLE setProvider restriction is intentional (probably), not a bug. This is a mismatch between spec and implementation that happens in real contracts.

We caught it before writing test harness or backend logic. That's the win.

## Lessons Learned

1. **Verify ABIs + access control on Day 0, not Day 3.** A one-hour fetch saves 6+ hours of rework if assumptions break on implementation.

2. **Fee structures have UX teeth.** Never assume "full budget flows to winner." Always read the payout formula. Display net payout upfront or lose trust.

3. **Actual contract code ≠ spec document.** Specs describe intent; code enforces reality. Read both.

4. **Scope cuts must be explicit.** User approved: browse filters, my-activity page, auto-refund infrastructure cuttable. Record it. Reference it. Prevents scope creep mid-sprint.

5. **Constraint-driven design is faster than wishful thinking.** Once we accepted Option B (agent as provider+evaluator), architecture became clearer. Stopped fighting the contract, started building with it.

## Next Steps

1. **Phase 1 (Blocking Gate):** Dry-run on-chain lifecycle. Execute createQuestion → submitAnswer → evaluate. Record actual fee values (setBudget caller restriction + actual platformFeeBP, evaluatorFeeBP still open). Must pass before Phase 2 backend code.

2. **Resolve open questions:**
   - Who can call setBudget? (QUESTION_MANAGER_ROLE? ADMIN_ROLE? caller?)
   - Actual fee BP values from testnet instance?

3. **Document in README:** Dual-tx payout model, net-payout calculation, claimRefund manual flow, cuttable scope list.

4. **Phase 2–5:** Backend, frontend, tests sequenced. Phase 1 result unblocks all others.

---

**Status:** DONE

**Summary:** Discovered three critical architectural constraints (setProvider blocked, fee math impacts UX, refund is manual) on Day 0; forced pragmatic design changes; plan + task queue hydrated; Phase 1 dry-run gates all downstream work.
