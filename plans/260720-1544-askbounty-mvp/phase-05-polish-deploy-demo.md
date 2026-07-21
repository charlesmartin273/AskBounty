# Phase 5 — Polish + Deploy + Demo

## Context Links
- PRD: `AskBounty-PRD-EN.md` §8 (Day 5), §10 (success criteria, wow demo)
- Architecture: brainstorm report (Success metrics; README limitation at init)
- Errata: E1/E2/E3 (limitation + fees to surface in README/demo)
- Depends on: Phase 4 (full flow deployable).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Deploy to Vercel with env + cron configured, seed demo data (one answered question with one failed + one passed answer), finalize README (limitation section, low-gas warning, faucet/setup, manual test guide), add agent-wallet low-gas warning UI, and polish the happy path for the live demo.

## Key Insights
- Wow demo (PRD §10): post live → lazy answer rejected w/ reasons → good answer passes → USDC hits winner within a cron cycle (here: instant via trigger-on-submit) → all onchain links shown. Net payout shown upfront must match received amount exactly.
- README limitation section (agent = provider+evaluator, E1) was written at init (Phase 1) — finalize + verify accuracy here.
- Gas on Arc = USDC (PRD §6): surface a low-balance warning when agent wallet USDC drops below a threshold; a broke agent wallet silently breaks payouts.
- Demo data must be reproducible via a seed script, not hand-clicked, so the demo is repeatable.

## Requirements
**Functional:** app live on Vercel; cron scheduled + auth working; demo question reproducible; README complete.
**Non-functional:** no secrets in client bundle; happy path smooth; low-gas warning visible.

## Architecture
Deploy: Vercel project, all env vars set in dashboard (server vars NOT `NEXT_PUBLIC_`), `vercel.json` cron from Phase 4. Demo seed: a script that funds + answers a question end-to-end against the deployed app (or directly via helpers) producing 1 failed + 1 passed answer. Low-gas warning: server reads agent USDC balance, banner if below threshold.

## Related Code Files
**Create:**
- `scripts/seed-demo-data.ts` — creates 1 funded question, submits 1 lazy (fail) + 1 good (pass) answer
- `components/system/agent-gas-warning.tsx` — low agent USDC balance banner
- `app/api/system/agent-balance/route.ts` — returns agent wallet USDC balance (read-only)
- `docs/manual-test-guide.md` — consolidated click-and-look guide for judges
**Modify:**
- `README.md` — finalize: overview, setup (env, faucet, Supabase, agent wallet funding), architecture, **known limitations** (agent centralization, fees reduce payout, client-only refund), run/deploy steps, demo script usage
- `app/layout.tsx` or a shell — mount `agent-gas-warning`
- `vercel.json` — confirm cron
- `.env.example` — ensure current + documented

## Implementation Steps
1. Pre-deploy audit: run `tsc --noEmit`; click the full flow locally once (ask→fund→answer fail→answer pass→receipt→refund on a second expired question).
2. `app/api/system/agent-balance/route.ts`: read agent wallet USDC `balanceOf` via publicClient; return `{balance, low: balance < THRESHOLD}`. `components/system/agent-gas-warning.tsx`: fetch + show banner if low. Mount in app shell.
3. `scripts/seed-demo-data.ts`: using throwaway/asker wallet + helpers, create a funded question (budget e.g. 5 USDC, criteria min 150 words + code + topics), submit a lazy answer (expect fail), submit a strong answer (expect pass + payout). Log the resulting `/q/[id]` URL + tx links. Idempotent-ish (skip if demo question exists).
4. Deploy to Vercel: connect repo, set ALL env vars in dashboard (RPC/chain/contract/USDC public; EVALUATOR_PRIVATE_KEY, ANTHROPIC_API_KEY, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY server-only). Confirm build passes.
5. Verify cron: check Vercel dashboard shows the scheduled job; hit `/api/cron/sweep` with the secret to confirm 200 in prod.
6. Fund agent wallet with a few USDC on testnet; confirm low-gas banner clears.
7. Run `seed-demo-data.ts` against prod (or a clean Supabase); capture the demo `/q/[id]` link for the presentation.
8. Finalize `README.md`: sections — What/why, Live URL, Architecture (Option B two-hop diagram), **Known Limitations** (agent is provider+evaluator centralization; protocol fees reduce winner payout, shown net upfront; refund is client-only by contract), Setup (faucet link, Supabase schema apply, env, fund agent wallet), Run/Deploy, Demo script. No AI references in commit messages.
9. Write `docs/manual-test-guide.md`: numbered judge-facing steps mirroring the wow demo, expected results, failure symptoms.
10. Final smoke test on prod: run the wow demo end to end; confirm upfront net payout == received amount.

## Todo List
- [ ] pre-deploy local full-flow pass + `tsc --noEmit`
- [ ] agent-balance API + low-gas banner
- [ ] seed-demo-data script (1 fail + 1 pass)
- [ ] Vercel deploy w/ all env vars
- [ ] cron scheduled + verified in prod
- [ ] agent wallet funded + banner clears
- [ ] README finalized (limitations, setup, demo)
- [ ] docs/manual-test-guide.md
- [ ] prod wow-demo smoke test (net matches received)

## Success Criteria
- App reachable at a public Vercel URL; full ask→answer→payout works in prod.
- Demo question reproducible via seed script; shows 1 failed (with reasons) + 1 passed answer with dual-tx receipt.
- Upfront net-payout number equals the USDC amount the winner actually receives.
- README documents the three errata limitations honestly; low-gas warning functional.
- Cron runs in prod with auth.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Secret leaked into client bundle | Low×High | Audit: server vars never `NEXT_PUBLIC_`; grep bundle |
| Agent wallet out of gas during demo | Med×High | Low-gas banner + fund before demo; check balance route |
| Prod env var missing → runtime 500 | Med×High | Checklist all 9 vars in Vercel; smoke test each path |
| Cron not firing on Hobby | Med×Low | Trigger-on-submit is primary demo path; cron is sweeper |
| Demo not reproducible | Med×Med | Seed script, not manual clicking |

## Security Considerations
- Verify no server secret in client bundle (search built output for key fragments / `EVALUATOR_PRIVATE_KEY`).
- CRON_SECRET set in prod; cron route rejects unauthenticated.
- RLS confirmed active on prod Supabase (client writes denied).

## Next Steps
Post-hackathon (out of scope): private-answer v2 mode, browse filters, my-activity completion, provider-updatable escrow if a contract we control is deployed.

---

## MANUAL TEST GUIDE
1. Open the live Vercel URL.
   - **Expect:** home/browse loads; if agent wallet is low on USDC, a low-gas banner shows.
   - **Likely failure:** 500 → a prod env var missing; check Vercel logs.
2. Open the seeded demo `/q/[id]`.
   - **Expect:** a funded question with net-payout badge, one failed answer (with per-check reasons) and one accepted answer with a dual-tx receipt (two Arcscan links).
   - **Likely failure:** answers missing → seed script didn't run against this Supabase.
3. Compare the upfront "winner receives X.XX USDC" to the accepted answer's receipt amount and the winner's on-chain balance.
   - **Expect:** all three match exactly.
   - **Likely failure:** mismatch → fee re-read at payout differs from creation snapshot; investigate BP drift.
4. Run the live wow demo: post a new question, connect a second wallet, submit a lazy answer (rejected with reasons), then a strong answer (passes, paid instantly).
   - **Expect:** winner USDC arrives within seconds; both txs linked on the receipt.
   - **Likely failure:** payout pending stuck → agent gas empty (fund it) or forward error (check payout_status).
5. Trigger cron in prod with the secret.
   - **Expect:** 200; expiry + retries processed.
   - **Likely failure:** 401 → CRON_SECRET not set in Vercel.
