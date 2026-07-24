# PHASE 5 AUDIT — Polish + Deploy + Demo Data

Date: 2026-07-24 · Production: **https://askbounty.vercel.app** · Vercel project `askbounty`, cron registered (`/api/cron/sweep` daily 00:00 UTC).

## Step 1 — PRD deviations (Day 5 scope: "Polish, deploy, demo data")

| # | PRD says | What we did | Status |
|---|---|---|---|
| 1 | Demo data: "1 answered question with a failed and a passed answer" | Superset per user directive: 3 questions — paid (fail+pass), open 7-day, expired+refunded | User-approved extension |
| 2 | Claude API for eval | Gemini free tier | Standing errata E5, disclosed in README |
| 3 | Old phase-05 plan file included agent-balance API + low-gas banner | Dropped (user's A–E scope, YAGNI); manual balance check pre-demo instead | User-approved in plan review |
| 4 | README said `ANTHROPIC_API_KEY` | Fixed to `GEMINI_API_KEY` (was drift vs E5) | Fixed |

No new external-fact conflicts → no new errata.

## Step 2 — Real prod run evidence

**Full money flow ON PRODUCTION URL** (`E2E_BASE_URL=https://askbounty.vercel.app npx tsx scripts/e2e-phase3-answer-flow.ts`): **14/14 PASS**, question `q10v9ojyy3cn`, winner delta exactly 1.000000 USDC == net_payout snapshot.
- complete: `0xd1d827bd24a2a924ecab013eb37cd1b13f1e038c1d07a1cca88600559a67712a`
- forward: `0x16e5ff9ef8e6d4728d567d2feee4246481aa69f59b2487c82dd53065db44403c`

**Cron auth on prod**: no header → 401; `Authorization: Bearer $CRON_SECRET` → 200 (`{"expired":1,...}` on first call — swept a stale test question).

**Demo data seeded on prod** (`scripts/seed-demo-data.ts`, staged runs):
- Paid + dual-tx receipt: https://askbounty.vercel.app/q/q66yq8uodfp9 (complete `0x0c83632b…6bd5`, forward `0x35822284…6d5c`)
- Open, 7-day deadline: https://askbounty.vercel.app/q/qriraz09r94x
- Expired + refunded (real 10.5-min deadline waited out, swept, claimed): https://askbounty.vercel.app/q/q3g982tmydva (refund `0x42dc32d0…b32e`)

**DB hygiene**: 3 stale expired test questions refunded to their askers (permissionless-caller, funds always to asker — E6): `q8syqf38jpcp` (`0xb34d6585…0430`), `qovq6n95ijx2` (`0xd07d8389…97ba`), `ql0fb6rnhal2` 10 USDC back to the manual-test wallet (`0x6bd365cf…576a`). Drafts are publicly invisible ("not live" notice) — left as-is.

## Step 3 — Edge cases tested

| # | Case | Result |
|---|---|---|
| 1 | Fresh browser profile, NO wallet extension, prod URL | No crash; browse/question/activity render; connect button disabled with "No injected wallet found" (Puppeteer sweep, all pages 200) |
| 2 | Invalid question id `/q/doesnotexist` | Friendly "Page not found" UI renders. **Minor known issue:** HTTP status is 200, not 404 — `loading.tsx` enables streaming so the status is sent before `notFound()` resolves. Cosmetic (UI correct), accepted for demo |
| 3 | Cron sweep without auth header | 401 fail-closed (with wrong secret: also 401) |
| 4 | Mobile 375px width (browse, question, ask) | Horizontal overflow 0px on all three after CriteriaBuilder/ask-row wrap fixes |
| 5 | Console errors on question page (fresh load) | Found React #418 hydration mismatch ×2 → fixed (see Step 4) → re-verified **0 console errors** |
| 6 | Seed script mid-run failure | Failed run left a live funded question; staged CLI (`--stage paid/open/refund-create/refund-finish`) made recovery possible without re-funding; documented in script header |

## Step 4 — Fixes applied

1. `scripts/seed-demo-data.ts`: `data.answerId` → `data.answer.id` (API shape); split into resumable stages.
2. `components/question/countdown.tsx`: `suppressHydrationWarning` (server/client compute remaining seconds apart).
3. `components/answer/answer-list.tsx`: `toLocaleString()` → deterministic UTC format (server UTC vs client TZ = hydration mismatch, the actual #418 source).
4. `README.md`: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`; full judge-facing rewrite (live URL, 3 demo links, screenshots, 2-hop diagram).
5. Polish set: `loading.tsx` ×2, `app/error.tsx`, `app/not-found.tsx`, `app/icon.svg` favicon, title template + per-page titles + OG metadata, friendly error mapping (`lib/ui/friendly-error.ts` + `ErrorNote`) across 7 components/pages, responsive wraps, activity loading skeleton, deleted 5 boilerplate SVGs.

## Step 5 — Re-run after fixes

- Rebuild + redeploy → `npm run build` clean, deploy READY, alias https://askbounty.vercel.app.
- Console re-check on `/q/q66yq8uodfp9`: **0 errors/pageerrors** (was 2× React #418).
- All README links return 200 (3 demo questions, faucet, Arcscan, refund tx).
- Secret scan: `git ls-files` → only `.env.example` tracked; grep for real key fragments in tracked files → clean; prod HTML → 0 fragments. All server secrets sit behind `import "server-only"` / API routes (audited).
- `npx tsc --noEmit` clean.

## Step 6 — Outstanding notes (non-blocking)

- **Agent wallet gas**: `0x8065E80A…c200` holds ~1.86 USDC (each payout cycle costs ~0.01). Recommend faucet top-up before demo day: https://faucet.circle.com → agent address.
- Leftover legit test question `qpe04gt1kkor` ("What year are we in right now?", 1 USDC, open until 2026-07-26) stays visible in browse — it is genuinely funded, so leaving it is honest; it will expire + be refundable on the 26th. Delete-from-browse was rejected as state manipulation.
- `/q/<garbage>` returns not-found UI with HTTP 200 (streaming trade-off of `loading.tsx`) — invisible to judges.
- GitHub repo not connected to Vercel (the Vercel account lacks repo admin) — deploys go through `vercel deploy --prod` CLI, documented here.

---

## MANUAL TEST GUIDE (judges — click and look, ~5 minutes)

1. Open **https://askbounty.vercel.app** on desktop or phone.
   - **Expect:** landing page with the AskBounty "?" favicon in the tab; nav to Browse/Ask/Activity.
   - **Likely failure:** 500 → a Vercel env var was removed; check Vercel logs.
2. Open the paid demo: **https://askbounty.vercel.app/q/q66yq8uodfp9**.
   - **Expect:** "Bounty 2 USDC" with net payout shown; a FAILED answer with red per-check reasons (11/50 words, no code block); an ACCEPTED answer with green checks incl. AI topic evidence; a green receipt "Bounty paid: 2 USDC" with **two** Arcscan links (escrow→agent, agent→winner).
   - **Verify the core claim:** click both links — the forward tx pays the winner the exact amount shown; the agent kept nothing.
3. Open the refunded demo: **https://askbounty.vercel.app/q/q3g982tmydva**.
   - **Expect:** "Bounty refunded to the asker" with the refund tx linked on Arcscan.
4. Open the live one: **https://askbounty.vercel.app/q/qriraz09r94x** and submit an answer with any wallet holding a little Arc Testnet USDC (faucet.circle.com → "Arc Testnet"; submitting is gas-free, you only sign).
   - **Expect:** a short lazy answer FAILS with reasons within ~15s; a genuine ~40+ word answer covering the gas token + faucet PASSES and USDC arrives in your wallet seconds later, receipt on the page.
   - **Likely failure:** "evaluation pending, retrying" badge → Gemini free-tier rate limit; it auto-retries, or press retry on the answer.
5. Try a broken link, e.g. **/q/nope**.
   - **Expect:** friendly "Page not found" with a link back to Browse.
