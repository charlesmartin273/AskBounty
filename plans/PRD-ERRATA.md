# PRD Errata

Findings where `AskBounty-PRD-EN.md` contradicts observable onchain/external reality. Per PRD Conflict Protocol.

## E1: Option A (updatable provider) not viable — 2026-07-20

- **PRD says (§2):** "Option A (preferred): provider is updatable before completion. Create the job with the agent wallet as placeholder provider; when an answer passes, update the provider to the winner, then complete."
- **Reality:** Implementation `0xA316fd02827242D537F84730F8a37D0BA5fd351a` (behind proxy `0x0747EEf0706327138c69792bF28Cd525089e4583`, verified on Blockscout) has `setProvider(uint256 jobId, address provider_)` gated by `onlyRole(ADMIN_ROLE)` AND `require(status == JobStatus.Open)`. We hold no ADMIN_ROLE on the shared pre-deployed contract, and winner is unknown until after funding (status `Funded`), so even admin could not reassign at that point.
- **Evidence:** Blockscout getsourcecode API for `0xA316…351a` on testnet.arcscan.app; access-control quotes: `onlyRole(ADMIN_ROLE)`, `require(jobs[jobId].status == JobStatus.Open, "Job not open")`.
- **Correction (user-approved):** Use PRD Option B — agent wallet as fixed provider + evaluator; on acceptance `complete()` pays agent wallet, agent forwards provider remainder to winner in a second tx. Both txs shown on receipt with Arcscan links. Agent-as-provider+evaluator centralization documented in README as known trade-off.

## E2: Protocol fees reduce winner payout — 2026-07-20

- **PRD says (§1, §5):** "20 USDC released to B instantly" / "agent wallet releases 20 USDC to answerer" — implies winner receives full budget.
- **Reality:** `complete()` splits budget: `platformFeeBP`→platform treasury, `evaluatorFeeBP`→evaluator, remainder→provider. Winner receives budget minus both fees. BP values are onchain state (`platformFeeBP()`, `evaluatorFeeBP()` views), admin-mutable; exact values to be read Day 1.
- **Evidence:** Verified source payout logic: `amount * platformFeeBP / 10000`, `amount * evaluatorFeeBP / 10000`, provider gets remainder.
- **Correction (user-approved):** Question page must display exact net amount BEFORE answers ("Bounty 20 USDC · winner receives X.XX USDC after protocol fees"), computed from live fee reads. Forward-hop gas absorbed by agent wallet, never deducted from winner.

## E3: Auto-refund impossible — 2026-07-20

- **PRD says (§5):** "asker claims refund (or auto-refund flow)".
- **Reality:** `claimRefund(jobId)` requires `msg.sender == jobs[jobId].client`. Agent cannot refund on asker's behalf.
- **Evidence:** Verified source: `require(msg.sender == jobs[jobId].client, "Only client")`, plus `block.timestamp > expiredAt` and status `Funded`.
- **Correction (user-approved):** "Claim refund" button on question page, called from asker wallet. Cron only marks DB status expired and surfaces button.

## Open verifications (Day 1 gate) — RESOLVED 2026-07-20 via live testnet dry-run

- **`setBudget` caller = provider (agent) only.** Live evidence: setBudget from agent wallet succeeded (tx `0x0ee9e2db…` job 158903); setBudget from client/asker wallet **reverted** (edge-case run, job fresh, custom error). Wizard order confirmed: (1) asker `createJob` → (2) backend `setBudget` → (3) asker `approve`+`fund`.
- **`platformFeeBP` = 0, `evaluatorFeeBP` = 0** (live reads 2026-07-20). Winner net for a 20 USDC bounty = **exactly 20.000000 USDC** today. BPs are admin-mutable — the app still reads them live at question creation and computes net payout; never hardcode 0.
- **Full lifecycle PASS** (jobs 158901 & 158903): createJob → setBudget(agent) → approve+fund → submit → complete → forward. Winner throwaway received exactly the computed net (1.000000 USDC per run), verified by balance delta. Evidence txs (job 158903): complete `0xa57d4d861bba757d7a8dbd1cf837977ab04aea352dde5388d32e89a5f617acca`, forward `0xe5f39d4b55a4b1dba7db6c5f0c75cef4dff90cc187fd30d7ddab38025429bf9a` (testnet.arcscan.app).
- `description` string "dryrun"/"edgecase" accepted without issue (short questionId-style strings are fine).

## E4: Signature drift from PRD pseudo-ABI — 2026-07-20

- **PRD/plan implied:** `complete(jobId, string reason)`, `setBudget(jobId, amount)`, `fund(jobId)`, `submit(jobId, deliverable)`.
- **Reality (verified ABI):** `complete(uint256, bytes32 reason, bytes optParams)` — reason is **bytes32**, not string; `setBudget`/`fund`/`submit` all take a trailing `bytes optParams` (pass `0x`).
- **Correction (implemented):** `lib/chain/abi-agentic-commerce.ts` hand-written from the live Arcscan ABI; `toBytes32Reason()` truncates reasons to 31 bytes.

## New finding: zero-budget `fund` succeeds — 2026-07-20

- `fund(jobId)` on a job whose budget was never set succeeds without any approve (`transferFrom(0)`), moving the job to Funded with 0 escrowed. App guard needed in Phase 2: a question is "live" only when `getJob(jobId).budget > 0` AND status = Funded — never trust status alone.
