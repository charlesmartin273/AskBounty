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

## E5: Evaluation LLM = Gemini free tier, not Claude API — 2026-07-21

- **PRD says (§3, §7):** evaluation via `callClaude` / Claude API.
- **Reality (user decision):** demo runs on **Google Gemini free tier** (`gemini-2.5-flash`) — reason: cost. Not an onchain/external-fact conflict; recorded here per user instruction for transparency with judges.
- **Correction (user-approved):** `lib/eval/llm-client.ts` replaces the Claude client with the SAME interface (`callLlm({system,user,schema?}) → parsed JSON`) and the SAME verdict schema (`topics[]`, `overall`, `reasoning`) enforced via Gemini structured output. Env `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`. Switching providers back = edit that one file only (`@anthropic-ai/sdk` kept in deps for easy revert). Eval failures (429/401/timeout) must surface as "evaluation pending, retrying" + manual retry button — never a silent hang (Phase 3 requirement).

## E6: `claimRefund` is permissionless (caller ≠ payee) — 2026-07-23

- **PRD/E3 said:** `claimRefund(jobId)` requires `msg.sender == jobs[jobId].client` ("Only client") — the basis for Phase 4 constraint C2's "non-asker call must revert".
- **Reality (live testnet, job 159263):** a NON-asker wallet (`0x072c…28f3`) called `claimRefund` successfully — tx `0xd328ecfc8edb0733a20ff30d02cf56d981c1875079e493a258fb707e0755954b` — and the contract transferred the full 1.000000 USDC escrow **to the job's client (asker `0x8cBd…310F`)**, not to the caller. Job status → 5 (Expired). The asker's own claimRefund afterwards reverted `0x8e78f0cb` (already refunded).
- **Money-safety implication:** anyone can TRIGGER an expired refund, but funds can only ever land with the client. No theft vector; E3's caller restriction simply does not exist on the deployed implementation (proxy may have been upgraded since the 07-20 source read, or the quoted require was misread).
- **App impact found by the same run:** the refund-record API's "job no longer Funded" check is insufficient once third parties can trigger refunds — a forged `createJob` tx (from asker, to contract, success) was accepted as `refund_tx`. Fix required: decode the submitted tx's INPUT and require `claimRefund(jobId)` selector+argument match; drop the `from == asker` requirement (any caller is legitimate).
- **Correction (user-approved 2026-07-23):** UI button stays ASKER-GATED (UX clarity; the contract needs no gate). Record API verifies by DECODING the tx calldata — must be `claimRefund(jobId)` for exactly this question's job, `to` == contract, receipt success; the `from == asker` check is dropped (any trigger is legitimate, funds always land with the asker). E2E asserts the stronger property: non-asker trigger succeeds AND the asker's balance delta == full budget to the unit. The wrongly recorded refund_tx on qa58gidet2qy was corrected to the real trigger tx `0xd328ecfc…`.

## E7: Gemini Search grounding requires billing, not available on free-tier key — 2026-08-06

- **Context:** Found that questions about topics outside the LLM's training data (e.g. "What is the gas token on ARC" - Arc testnet is too new/niche for `gemini-3.5-flash`) get every correct answer rejected as "factually incorrect" (evidence: qq35g31asm8d, 3 correct answers all failed). Proposed fix: add `tools: [{google_search: {}}]` to the Gemini call (`lib/eval/llm-client.ts`) so the model checks live facts instead of guessing from training data.
- **PRD-ERRATA E5 says:** demo runs on Google Gemini **free tier** specifically to avoid cost.
- **Reality:** live test against the real `GEMINI_API_KEY` shows a plain `generateContent` call succeeds instantly, but the SAME call with `tools: [{google_search: {}}]` added returns `429 RESOURCE_EXHAUSTED` every time, including on a fresh untouched quota window. Google's Search grounding free monthly allotment (5,000 prompts/mo for Gemini 3.x) is gated behind a billing-enabled GCP project - a true no-billing free-tier key gets 0 grounding quota, not a large-but-finite one.
- **Money-safety implication:** shipping the grounding tool unconditionally would make **every** evaluation call 429 (retryable error), not just the niche-topic ones - a total pipeline regression, worse than the bug it fixes. Reverted immediately after the live test confirmed this (see `lib/eval/llm-client.ts` history).
- **Correction (user-approved 2026-08-06):** grounding abandoned; askers may instead attach optional PRIVATE **reference notes** at question creation (`reference_notes` column, `migration-005-reference-notes.sql`) - asker-authored ground truth the reviewer judges facts against, outranking its training knowledge. Deliberately a sibling column, NOT inside `criteria` JSONB, because `toPublicQuestion()` returns `criteria` verbatim to the public API; the notes are never in any public projection. Injected into the prompt as a delimiter-neutralized trusted-FACTS block (never trusted as instructions), and the existing NEVER REVEAL THE ANSWER rule keeps them out of verdict strings.
- **Evidence (live run 2026-08-06, real `evaluateAnswer` + real Gemini call):** the verbatim answer that qq35g31asm8d rejected ("ARC use USDC as gas token, can get testnet fund for ARC through https://faucet.circle.com/") now returns `outcome: pass`, `✓ gas token · ✓ faucet`, with zero reference-note terms echoed in the feedback. Control run: an answer contradicting the notes ("native ARC coin for gas", wrong faucet) still returns `outcome: fail` - the notes inform the verdict without rubber-stamping. Public API check on the test question `qvqhwv5vl96g` returns no trace of `reference_notes`.

## New finding: zero-budget `fund` succeeds — 2026-07-20

- `fund(jobId)` on a job whose budget was never set succeeds without any approve (`transferFrom(0)`), moving the job to Funded with 0 escrowed. App guard needed in Phase 2: a question is "live" only when `getJob(jobId).budget > 0` AND status = Funded — never trust status alone.
