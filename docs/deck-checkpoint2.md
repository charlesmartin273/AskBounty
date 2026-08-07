# AskBounty - Mid-Submission Deck (Checkpoint 2)

7 slides. Numbers below are sourced from `plans/PHASE1..5-AUDIT.md` (real runs, real txs).

---

## Slide 1 - AskBounty

- **Ask a question, lock USDC in onchain escrow - an AI agent evaluates answers and pays the first one that passes, instantly.**
- Live: **https://askbounty.vercel.app**
- Repo: https://github.com/charlesmartin273/AskBounty
- Build on Arc hackathon · Agentic Economy track

> 📷 Image: hero shot of the landing/browse page (desktop, light theme) with the AskBounty favicon visible in the tab.

---

## Slide 2 - Problem

- Good technical answers are unpaid work - experts have no reason to write them for strangers.
- Askers can't say "good enough" upfront, so paid Q&A collapses into disputes.
- Payment rails add friction: invoices, trust, days of settlement.
- Both sides need the same thing: **criteria fixed before writing, money locked before answering.**

> 📷 Image: none (text slide) - optionally the criteria builder from /ask as a teaser.

---

## Slide 3 - How it works

- Asker writes acceptance criteria (min words, code required, topics) → budget locked in **ERC-8183 escrow** at post time.
- Answerers submit with a wallet signature - free, no gas.
- Agent evaluates → **pass = instant payout**; no pass by deadline = **refund to asker**. Funds can never be stranded.

```
Asker ──fund──► Escrow (ERC-8183)          Answerer
                   │            ◄──signed answer──┘
                   │   agent: code checks → LLM verdict
                   ├──pass──► agent wallet ──full amount──► winner
                   └──deadline, no pass──► refund to asker
```

> 📷 Image: the funding wizard mid-flow (3-step card) OR keep the ASCII diagram as the visual.

---

## Slide 4 - What is LIVE today

- **Full money flow runs on production** against Arc Testnet: post → fund → evaluate → payout, verified end-to-end (14/14 assertions on the deployed URL).
- **3 seeded demo questions** judges can click right now: paid-with-receipt · open (submit yourself) · expired-and-refunded.
- Every payout shows a **dual-transaction receipt** on Arcscan: escrow→agent and agent→winner - anyone can verify **the agent kept nothing**.
- 5 phases, each gated by a written audit: **16 E2E suites, 130+ assertions - all against live testnet, zero mocks.**

> 📷 Image: /q/qmtplkbb783o - the green "Bounty paid: 2 USDC" receipt with both Arcscan links.

---

## Slide 5 - The agent

- **Objective code checks run first** (word count, fenced code block) - free, deterministic, spam never reaches the LLM.
- **LLM review second**: judges the asker's written topics against the answer, returns a structured verdict with quoted evidence; server date injected, answer body delimiter-neutralized against prompt injection.
- **Fails closed when unsure** - bounty stays in escrow and refunds at expiry; funds are never misdirected.
- Battle-tested: ~18 audit/review findings fixed (incl. a prompt-injection vector and a payout race), 2 found by human manual testing - every money-path fix is locked by a permanent regression test.

> 📷 Image: /q/qmtplkbb783o - failed answer with red per-check reasons next to the accepted answer's green checks.

---

## Slide 6 - Built on Arc

- **USDC is the gas token** - one token for bounty, payout AND fees; users touch a faucet once.
- **Sub-second finality** - "answer accepted" and "USDC in your wallet" happen in the same breath; payouts feel instant.
- **ERC-8183 (AgenticCommerce) escrow** - budget provably locked at post time; refund path enforced by the contract, not by us.
- Trade-off disclosed openly: shared contract fixes the provider at creation → agent forwards the full release in a second tx, proven on every receipt.

> 📷 Image: Arcscan token-transfer view of a forward tx showing exact USDC amount to the winner.

---

## Slide 7 - Next

- Polish the live-demo script: post → lazy answer rejected → strong answer paid, in under 3 minutes.
- Demo video (screen capture of the wow flow, receipts on Arcscan).
- Demo Day: live run on stage + judges submitting against the open bounty themselves.
- v2 parked honestly in README: private submissions, early cancel, faster expiry sweep.

> 📷 Image: none (text slide) - optionally the open demo question /q/qriraz09r94x as the "try it" invitation.
