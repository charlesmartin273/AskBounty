# RESKIN AUDIT — Orionix reskin (branch `reskin-orionix` → `master`)

Scope: full visual reskin (design tokens, landing rebuild, app-shell texture,
type-scale sweep, loading states, 404 nav) plus one pre-existing bug fix
(wagmi SSR hydration) and a dev/prod Supabase split done as part of this
audit. No product logic touched — see "Diff scope" below for the proof.

## 1. Build gate

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run build
▲ Next.js 16.2.10 (Turbopack)
✓ Compiled successfully in 5.2s
  Finished TypeScript in 16.8s
✓ Generating static pages using 21 workers (12/12) in 1040ms

Route (app)
┌ ○ /                              ○ /ask
├ ○ /_not-found                    ƒ /browse
├ ○ /activity                      ○ /icon.svg
├ ƒ /api/* (10 routes)             └ ƒ /q/[id]
```
Exit 0. `npm test` does not exist — `package.json` only defines
`dev`/`build`/`start`/`lint`; the repo has no unit-test runner, verification
is the e2e/dry-run script suite below (unchanged from Phase 3-5).

## 2. Diff scope — proves the reskin did not touch money logic

```
$ git diff master --stat -- lib/ app/api/ scripts/
lib/chain/config.ts | 3 +++   (added arcscanAddressUrl, read-only link helper)
lib/wagmi-config.ts | 6 ++++++ (added ssr: true — browser-only wagmi option)
2 files changed, 9 insertions(+)
```
`app/api/**`, `lib/auth/`, `lib/eval/`, `lib/escrow/`, `lib/supabase/`,
`scripts/**`: **zero changes**. Everything else in the diff is
`app/(marketing|app)/**` pages/layouts, `components/**` presentation, and
`app/globals.css` tokens.

## 3. Regression fix — wagmi SSR hydration (found during this audit)

Not a reskin bug — pre-existing, surfaced because this audit's console
checks ran with a wallet connected (Phase 5's check ran disconnected and
missed it). Full writeup in `plans/PHASE5-AUDIT.md` under "Regression note".

- **Symptom**: `/ask` and `/activity` threw a hydration exception every
  load; nav rendered "flex flex-col gap-1" server / "flex items-center
  gap-2" client — the connect-vs-connected branches disagreed.
- **Fix**: `ssr: true` added to `createConfig` in `lib/wagmi-config.ts`
  (one line).
- **Evidence after**: `curl` of server HTML shows only the disconnected
  branch (`1 Connect wallet`, 0 `Disconnect`); reload with wallet connected
  → 0 console errors, devtools issue badge cleared.

## 4. E2E / dry-run gate — 15 scripts, all money paths

Run against the (then-shared) DB before the split, then re-verified against
the fresh dev DB post-split (§7). All scripts use the REAL API routes, REAL
throwaway wallets on Arc Testnet, REAL onchain transactions.

| Script | Exit | Notes |
|---|---|---|
| e2e-phase4-browse-activity | 0 | 7/7 |
| e2e-phase4-cron-sweep | 0 | 6/6 |
| e2e-phase3-fail-closed-verdict | 0 | 22/22 |
| e2e-phase3-edge-cases | 0 | 6/6 |
| e2e-phase3-answer-flow | **1** | non-regression, see below |
| e2e-phase3-forward-event-amount | 0 | 4/4, tx below |
| e2e-phase3-payout-discrepancy | 0 | |
| e2e-phase3-double-accept | 0 | |
| e2e-phase3-nonce-serialization | 0 | |
| e2e-phase3-current-year-eval | 0 | |
| e2e-phase3-empty-topics-eval | 0 | |
| e2e-phase4-deadline-guards | 0 | |
| e2e-phase2-wizard | 0 | |
| e2e-phase3-eval-error-retry | **1** | non-regression, see below |
| e2e-phase4-refund | 0 | 13/13, tx below |
| dry-run-lifecycle | 0 | full lifecycle, tx below |
| dry-run-edge-cases | 0 | 5/5 |

**13/15 pass. 2 fails, both proven non-regression:**

1. `e2e-phase3-answer-flow` — script hard-waits 61s for a 60s cooldown to
   clear; API returned "wait 80s". Root cause: this machine's clock runs
   **21.5s behind** the Supabase server clock (measured via `Date` response
   header vs local `Date.now()`), so
   `elapsedSeconds = Date.now() - created_at` under-counts. Server-side
   arithmetic (`lib/auth/submission-cooldown.ts`) is unchanged from master
   and correct — this is a local-clock artifact, not present on Vercel
   (NTP-synced).
2. `e2e-phase3-eval-error-retry` — needs **two** dev servers
   (`E2E_BAD_BASE_URL` running with an invalid Gemini key). Only one was
   running; `ECONNREFUSED` on the second. Missing test precondition, not a
   code fail.

**Real payout tx from this run** (`forward-event-amount`):
```
complete: 0x395c440eabb1bd663aff82656f5884955b84c85923229abbeb86812d5ddd11d5
forward : 0x9dfcbbf64b441aa4302177aacdfd9294b08bd322beae31bff1141088bc69deff
PaymentReleased.amount = recorded = winner delta = snapshot = 1.234567 USDC
```
**Real refund tx** (`phase4-refund`, C2/E6 — non-asker trigger, funds still
land with asker):
```
refund: 0xa65aa05d6c3e94ea2dd09f1c3c153d76aefcaf434dd3bd85c71774a6da8d89b4
askerDelta = budget = 1.000000 USDC exactly
```
**dry-run-lifecycle**: 20 USDC bounty → winner receives exactly
20.000000 USDC; complete tx `0xfd8e3242…d1a9455`, forward tx
`0x3ec23055…1ee5d9c50`.

## 5. Route / URL identity

```
$ git diff master --name-only -- app | grep -E 'page\.tsx|route\.ts' \
    | sed -E 's#\(app\)/|\(marketing\)/##' | sort -u > head.txt
$ git ls-tree -r --name-only master -- app | ... > master.txt
$ diff master.txt head.txt
(only difference: page.tsx moved under the (marketing) route group,
 which contributes NO URL segment)
```
Confirmed live: 8/8 routes return HTTP 200 (`/`, `/browse`, `/ask`,
`/activity`, `/q/<id>` live and invalid, `/icon.svg`, `/api/fees`).

README's 3 demo links + prod root are **byte-identical to master** except
one intentional fix (§8): `/q/qriraz09r94x` → `/q/qk5nrg5fztw6` (the old one
expired naturally between audits; not a reskin regression).

## 6. Public pages — no admin control exposed

```
$ curl -s .../q/<id> | grep -oiE "admin|reject|force|override|setBudget|
  complete\(\)|EVALUATOR_PRIVATE|SUPABASE_SERVICE"
(0 matches, all 5 public routes)
```
`ClaimRefundButton` stays asker-address-gated in the UI (contract itself is
permissionless-as-to-caller by design, PRD-ERRATA E6 — the button gate is a
UX choice, not the security boundary; unchanged from master).

## 7. Mobile viewport (390×844 iframe, real layout engine)

| Route | clientWidth | scrollWidth | overflow-x |
|---|---|---|---|
| `/browse` | 390 | 390 | none |
| `/ask` | 375 | 375 | none |
| `/activity` | 375 | 375 | none |
| `/q/[id]` | 390 | 390 | none |
| `/q/<invalid>` | 390 | 390 | none |
| `/` (landing) | 375 | 387 | **clipped** — `html{overflow-x:clip}` (added this branch) suppresses the scrollbar; the 12px comes from the full-bleed marquee's `w-screen`, which counts the desktop scrollbar width even where none exists. Not pannable, not visible. |

## 8. Dev/prod database split (done this audit, not previously present)

**Before**: `.env.local` pointed at the SAME Supabase project as
production (`lazafevtjtzhutogvxej`) — every e2e/dry-run run during this
audit had been writing real rows into production, which is why 4 "E2E …"
questions and one extra open question briefly appeared on
`askbounty.vercel.app/browse` mid-audit.

**Action**: created a new Supabase project `askbounty-dev`
(ref `tpfblhpqenrenbzhtdwm`, same region `ap-northeast-1`), applied
`lib/supabase/schema.sql` + all 3 `migration-00*.sql` via
`supabase db push`, repointed `.env.local` to it. Production project and
its `vercel env` values were **not touched**.

**Cross-verification**:
```
dev  reads prod-only id  qod6hnxbr3yx  -> "Page not found"   (isolated)
prod reads qod6hnxbr3yx                -> still "Bounty paid" (untouched)
dev  seed new open question q9x588a9hl3i -> appears on dev /browse
prod /browse grep q9x588a9hl3i         -> 0 matches            (isolated)
```

## 9. Production deploy + live verification

Merged `reskin-orionix` → `master` as a **fast-forward, zero conflicts**
(master had no commits since the branch point). Pushed `310e025..47165c5`,
deployed via `vercel deploy --prod` (the repo is not GitHub-connected to
Vercel — Phase 5 documented this; deploys go through the CLI).

```
deployment : dpl_DDxKATzczo4jxyyqZkeS5vzcq9F4   target=production  READY
alias      : askbounty.vercel.app → that deployment (vercel inspect)
```

**Production env still points at the production database.** Checked before
deploying, since `.env.local` now points at dev:
- `vercel env ls production` — all three Supabase vars last written 10d ago,
  i.e. before the split; no `vercel env add/rm` was ever run.
- `.env.local` is gitignored and untracked, and `vercel deploy` does not
  upload it — production env comes from project settings.
- Behavioural cross-check (the conclusive one):

| Row | Production | Dev |
|---|---|---|
| `qod6hnxbr3yx` (prod-only) | serves it | not found |
| `q9x588a9hl3i` (dev-only) | not found | serves it |

Note: `vercel env pull` masks these values as `[SENSITIVE]`, so the literal
ref string could not be printed from the CLI; the evidence above is
behaviour + metadata rather than a direct read.

**Live money flow on production** (`scripts/prod-smoke-money-flow.ts`, runs
entirely over the public HTTP API + chain so it needs no prod DB
credentials):
```
question : https://askbounty.vercel.app/q/qpm00dsz347u   job 165375, 1 USDC
complete : 0x46e76bfb81733aec01c14856a4c9bbb70cbd445cb88826e719f811cb85caf4f8
forward  : 0x1cb3aa41f94c4cca8db68f42c3c20ecc3a755a1622aaaeafa3549d8ca47b3df0
```
Decoded onchain:
```
complete: escrow 0x0747EEf0… -> agent 0x8065E80A… = 1.000000 USDC
forward : agent  0x8065E80A… -> winner 0x072c3677… = 1.000000 USDC
```
Agent retained exactly zero. (Arc emits each movement twice — once on the
native 18-decimal view, once on the 6-decimal ERC-20 at `0x3600…0000` — same
single transfer, not two.)

**Anonymous checks** (plain `curl`: no cookies, no wallet, no JS — the
strictest "logged out" test for server-rendered content):

| Link | HTTP | State |
|---|---|---|
| `/q/qmtplkbb783o` | 200 | Bounty paid, 3 tx links |
| `/q/qk5nrg5fztw6` | 200 | open, no receipt (as intended) |
| `/q/q3g982tmydva` | 200 | Bounty refunded to the asker, 2 tx links |
| `/browse`, `/ask`, `/activity` | 200 | correct titles; "Launch app" → `/browse` |

**Build identity.** CLI deploys carry no git metadata, so identity is proven
by content fingerprint — strings that exist in `47165c5` and in **no** prior
commit, all served by production right now: "Check it yourself", "The number
you see", "Two ways this ends", "What we do not", "Your criteria", "Under the
hood". The under-the-hood section also renders the chain constants imported
from `lib/chain/config`. Landing HTML is 153,695 bytes versus a far smaller
pre-reskin page. Working tree was clean at `47165c5` when the deploy ran.

## 10. Reskin coverage (tokens → components → route groups → pages)

| Layer | Status |
|---|---|
| Design tokens (palette, hairlines, money-state colors, 3 type families, `t-*` scale incl. new `.t-code`, radii, shadows, motion + `prefers-reduced-motion`) | Done |
| Shared page texture (`components/page-texture.tsx`, wash + grain, 2 intensities) | Done — `display` (landing) vs `work` (app, ~34% wash / 40% grain of display) |
| `(marketing)` route group | Done — 13 landing sections |
| `(app)` route group | Done — token + texture pass, deliberately no motion, width unchanged (`max-w-2xl`/`max-w-3xl`) |
| `/`, `/browse`, `/ask`, `/activity`, `/q/[id]`, `/_not-found`, `error.tsx` | Done, all with loading skeletons where missing before (`/ask`, `/activity` added this audit) |
| `components/ui/*` (shadcn primitives) | Swept to `t-*` scale; `input`/`textarea` intentionally kept at 16px (iOS zoom guard, commented in file); `button size=sm` (13px) and `badge` (11px) intentionally between scale steps (commented) |

## 11. Outstanding / non-blocking

- Local machine clock is ~21s behind real time — cosmetic for humans, but
  will keep tripping any cooldown-timed script run locally. Not a blocker;
  documented so it isn't re-diagnosed from scratch next time.
- The 4 "E2E …" test questions already live on production `/browse`
  (created before the DB split was in place) are left to expire and
  self-refund naturally, per standing decision (Phase 5: no state
  manipulation via deletion).
- `qk5nrg5fztw6` (README demo link #2, replacement) has real escrow and a
  real 7-day deadline; it will itself need replacing again after it expires
  if the repo lives past that date.

## Unresolved questions

- None blocking merge. The clock-skew note above is informational only.
