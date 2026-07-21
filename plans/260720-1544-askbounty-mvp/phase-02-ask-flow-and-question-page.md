# Phase 2 — Ask Flow + Question Page

## Context Links
- PRD: `AskBounty-PRD-EN.md` §4.1, §4.2, §5 (Ask and fund), §6b
- Architecture: brainstorm report (Onchain flow → Ask 3-step wizard; Payout transparency #1)
- Errata: E2 (net payout display)
- Depends on: Phase 1 (escrow service, chain config, supabase client, confirmed `setBudget` caller).

## Overview
- **Priority:** P1
- **Status:** audit-pass — awaiting user approval (evidence: `plans/PHASE2-AUDIT.md`)
- **Description:** Build the criteria-builder ask form, the 3-step resumable funding wizard (createJob → setBudget → approve+fund), and the public question page with the upfront net-payout badge, criteria display, countdown, and Arcscan verify link.

## Key Insights
- Wizard step order depends on Phase 1 `setBudget` finding. **Default (setBudget = agent/backend):** (1) asker `createJob`, (2) backend `setBudget` via API route, (3) asker `approve`+`fund`. If Phase 1 found setBudget client-only, swap: asker does setBudget in step 2. Wizard must be resumable — persist `job_id` to the question row after step 1 so a mid-flow refresh recovers.
- Question is **not live** (status stays a pre-open state or row hidden) until `fund` confirms. Store question row at step 1 with status e.g. `draft`, flip to `open` after fund receipt.
- Net payout computed at creation from live fee reads (E2) and stored on the row (`net_payout`, `platform_fee_bp`, `evaluator_fee_bp`) so the page shows a stable number.
- Criteria JSON shape per PRD §3: `{minWords, mustIncludeCode, codeLanguage, topics[], deadline}`.

## Requirements
**Functional:** create+fund a question end-to-end from a browser wallet; question page renders all fields, live countdown, net payout, Arcscan link.
**Non-functional:** wizard resumable; all DB writes via API routes (service-role); components <200 lines.

## Architecture
Data flow: Ask form (client, wagmi) collects title/body/budget/deadline/criteria → **POST `/api/questions`** creates draft row (service-role), returns `questionId` → client wallet `createJob(agent, agent, deadline, questionId, 0x0)` → **POST `/api/questions/[id]/set-budget`** backend `setBudget` (default path) → client `approve`+`fund` → **PATCH `/api/questions/[id]`** flips status to `open`, stores `job_id`, tx hashes, net payout snapshot. Question page is a server component reading via service-role, with client sub-components for countdown + wallet actions.

## Related Code Files
**Create:**
- `app/ask/page.tsx` — ask route (wizard host)
- `components/ask/criteria-builder.tsx` — min-words toggle, code-required toggle+language, topics list
- `components/ask/funding-wizard.tsx` — 3-step stepper w/ per-step status, resumable
- `lib/questions/question-id.ts` — short id gen (e.g. nanoid) used as onchain `description`
- `lib/questions/criteria-schema.ts` — TS type + zod-lite validation for criteria JSON
- `app/api/questions/route.ts` — POST create draft
- `app/api/questions/[id]/route.ts` — GET one, PATCH finalize
- `app/api/questions/[id]/set-budget/route.ts` — POST backend setBudget (default path)
- `app/q/[id]/page.tsx` — public question page (server component)
- `components/question/net-payout-badge.tsx` — "Bounty 20 USDC · winner receives X.XX after fees"
- `components/question/countdown.tsx` — client countdown to deadline
- `components/question/criteria-display.tsx` — render criteria read-only
- `components/wallet/wallet-connect.tsx` + wagmi config `lib/wagmi-config.ts`
**Modify:**
- `app/layout.tsx` — wrap in wagmi + react-query providers

## Implementation Steps
1. `lib/wagmi-config.ts`: wagmi config with `arcTestnet` chain, injected connector. Wrap `app/layout.tsx` with `WagmiProvider` + `QueryClientProvider` (client boundary component).
2. `lib/questions/criteria-schema.ts`: type `Criteria = {minWords:number; mustIncludeCode:boolean; codeLanguage?:string; topics:string[]; deadline:string}`. Validate: minWords ≥ 0, topics non-empty if provided, deadline in future. **Impossible-criteria warning** (PRD risk): if minWords > e.g. 5000, return a soft warning to show in UI.
3. `components/ask/criteria-builder.tsx`: controlled inputs → emits `Criteria`. shadcn switch/input.
4. `app/api/questions/route.ts` POST: validate body, generate `questionId` (short), read fee BPs + compute net payout via escrow service, insert draft row (status `draft`, store net_payout + bps + criteria + deadline + asker_address). Return `{questionId, netPayout}`.
5. `components/ask/funding-wizard.tsx`:
   - Step 1: wallet `writeContract` `createJob(agent, agent, deadlineUnix, questionId, 0x0)`. On receipt, decode jobId; PATCH question row with `job_id` (still draft). Persist local step state keyed by questionId so refresh resumes.
   - Step 2: POST `/api/questions/[id]/set-budget` (backend setBudget). Show spinner + result. (If Phase 1 said client-only, do wallet setBudget here instead.)
   - Step 3: wallet `approve(USDC → contract, budget)` then `fund(jobId)`. On fund receipt, PATCH status→`open`, store fund tx. Redirect to `/q/[id]`.
   - Each step shows idle/pending/confirmed/error; a failed step is retryable without redoing prior steps (jobId persisted).
6. `app/q/[id]/page.tsx` (server): fetch row via service-role. Render title/body (markdown-rendered read-only), `net-payout-badge`, `criteria-display`, `countdown`, "Verify on Arcscan" link to `https://testnet.arcscan.app/address/<AGENTIC_COMMERCE>` (or job/tx link once known). Answer list placeholder (Phase 3 fills). Show "First passing answer wins" rule text (PRD §6).
7. `components/question/net-payout-badge.tsx`: format 6-dec bigint → `X.XX USDC`. Show "Bounty {budget} USDC · winner receives {net} USDC after protocol fees".
8. Compile check `tsc --noEmit`; manual wallet run on testnet.

## Todo List
- [ ] wagmi config + providers in layout
- [ ] criteria schema + validation + impossible-criteria warning
- [ ] criteria builder component
- [ ] POST /api/questions (draft + net payout snapshot)
- [ ] funding wizard 3 steps, resumable, per-step status
- [ ] set-budget API route (default backend path)
- [ ] PATCH finalize (status→open, job_id, tx)
- [ ] question page + net payout badge + criteria + countdown + Arcscan link
- [ ] `tsc --noEmit` clean + live wallet test

## Success Criteria
- From `/ask`, a connected wallet funds a question; after fund confirms, `/q/[id]` shows status open, correct net payout, live countdown, working Arcscan link.
- Refreshing mid-wizard (after step 1) resumes without re-creating the job.
- Question row in Supabase has job_id, net_payout, bps, tx hashes; status `open` only after fund.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Wizard drop-off / mid-flow refresh loses jobId | Med×High | Persist jobId to row + local step state; resumable steps |
| setBudget caller mismatch vs Phase 1 finding | Low×High | Step 2 branch decided by Phase 1 result, not assumed |
| Fee BP changes between snapshot and payout | Low×Med | Snapshot at creation for display; re-read at payout (Phase 4) |
| approve/fund two-tx confusion | Med×Med | Explicit sub-steps + status; check allowance before approve |
| Draft rows orphaned if user abandons | Med×Low | Acceptable for MVP; cron (Phase 4) can prune old drafts |

## Security Considerations
- All writes via API routes with service-role; client never writes Supabase directly (RLS enforces).
- `/api/questions` trusts `asker_address` from body — acceptable pre-answer (no funds at risk until asker's own wallet funds). No signature needed here since asker pays from their own wallet.
- Sanitize/escape question body when rendering markdown (no raw HTML injection).

## Next Steps
Unblocks Phase 3 (answer flow renders under question page) and Phase 4 (payout reads job_id + net payout snapshot). 

---

## MANUAL TEST GUIDE
1. Go to `/ask`, connect a testnet wallet with USDC. Fill title, body, budget 20, deadline +1 day, criteria (min 150 words, code required TypeScript, topics "pagination, retry").
   - **Expect:** a net-payout preview appears before funding, e.g. "winner receives 19.xx USDC after fees".
   - **Likely failure:** preview blank → fee read failed; check escrow service + RPC.
2. Click through wizard: confirm createJob in wallet, wait, then setBudget resolves, then approve + fund.
   - **Expect:** three steps go green in order; on fund confirm you land on `/q/[id]`.
   - **Likely failure:** step 3 revert → allowance not set (approve skipped) or budget mismatch with setBudget.
3. Mid-wizard, after step 1 confirms, refresh the page.
   - **Expect:** wizard resumes at step 2, does not create a second job.
   - **Likely failure:** restarts at step 1 → jobId/step state not persisted.
4. On `/q/[id]`, read the page.
   - **Expect:** status open, budget badge with net payout, full criteria, ticking countdown, working "Verify on Arcscan" link, "first passing answer wins" note.
   - **Likely failure:** status still draft → PATCH finalize not called after fund.
