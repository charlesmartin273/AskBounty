# PHASE 2 AUDIT — Ask Flow + Question Page

Date: 2026-07-21 · Status: **PASS** (E2E 13/13 on real testnet, review findings fixed) — awaiting user approval

## 1. Deviations vs PRD/plan (audit step 1)

| # | Deviation | Resolution |
|---|-----------|------------|
| 1 | PRD §3 puts `deadline` inside the criteria JSON | Stored as a first-class `deadline` column (query/countdown-friendly); criteria JSON holds only minWords/mustIncludeCode/codeLanguage/topics. Display unaffected |
| 2 | PRD §4.1 "question page goes live at /q/[id]" on submit | Tightened per yêu cầu 2: page exists after draft but renders a "not live yet" notice until the server verifies Funded + budget>0 onchain. Prevents effort on ghost questions |
| 3 | PRD §7 markdown editor for question body | Plain-text render (whitespace-pre) for Phase 2 — XSS-safe by construction; markdown polish deferred to Phase 5 |
| 4 | Plan file `PATCH /api/questions/[id]` finalize | Split into POST `[id]/job`, `[id]/set-budget`, `[id]/finalize` — clearer contracts, each with its own guard |
| 5 | Plan `lib/questions/question-service.ts` not created | Logic small enough to live in routes + `question-api-helpers.ts` (KISS) |
| 6 | Added `GET /api/fees` (not in plan) | Powers the pre-submit net-payout preview in the ask form |
| 7 | Schema needed 2 new columns | `migration-002-question-tx-columns.sql` (`create_tx`, `fund_tx`) — applied by user 2026-07-21 |

## 2. Real run evidence (audit steps 2 & 5)

`npx tsx scripts/e2e-phase2-wizard.ts` against dev server (:3002) + Arc Testnet, driving the REAL API routes with the asker throwaway wallet — **12/12 PASS** (second run, after fixes; first run 4/12, see §4):

```
[draft] q8syqf38jpcp netPayout=1
PASS | step1 record jobId | job 159054 tx=0x7a1356f75a8b2bf929c786da77e871fa0250153b4afa50f736fb0fb6568b6da9
PASS | resume after step 1 -> step 2 | wizard={"step":2,"onchain":{"status":0,"budget":"0"}}
PASS | EDGE finalize before fund rejected | 409 job not Funded onchain (status 0) — question stays draft
PASS | step2 setBudget | tx 0x330508610f5b5f5cd0a828c58fddd2c2b659de767ab03beda215ce822a892608
PASS | EDGE setBudget idempotent | {"ok":true,"already":true}
PASS | resume after step 2 -> step 3 | wizard={"step":3,"onchain":{"budget":"1000000"}}
PASS | step3 finalize after fund | fund tx=0x5aeab7da0d2f2453fcda81614d9eba1088d4f72eb4d071d2341ddc0133941364
PASS | question open with locked snapshot | status=open net=1 fees=0/0bp
PASS | public page shows locked net payout | /q/q8syqf38jpcp rendered
PASS | EDGE forged jobId rejected | 400 job description does not match question id
PASS | EDGE past deadline / zero budget rejected | past=400 zero=400
PASS | EDGE draft page shows not-live notice | /q/q60844tdvfdk is draft-guarded
```

### The 3 mandatory requirements — verified

1. **Fee snapshot locked at creation:** net payout computed from LIVE onchain fee reads in POST `/api/questions`, persisted (`net_payout`, `platform_fee_bp`, `evaluator_fee_bp`). Page + API render ONLY the stored numbers — admin fee changes after creation cannot alter the promise. Evidence: `net=1 fees=0/0bp` served from DB, "fees locked at creation" shown on page.
2. **Live guard:** `finalize` flips draft→open ONLY after server-side onchain check `status===Funded && budget>0 && budget===promised`. Draft pages render a "not live yet" notice with zero bounty copy. Evidence: finalize-before-fund → 409; draft page guard PASS; **real-world catch** in §4.
3. **Resumable wizard:** `job_id` + `create_tx` persisted immediately after step 1 (onchain-verified against forgery); wizard step derived from DB+chain on every load (GET), localStorage holds only the draft id. Evidence: resume checks after step 1 (→2) and step 2 (→3) PASS; the interrupted first E2E run resumed conceptually identically (§4).

## 3. Edge cases (audit step 3) — 5/5 PASS

| Edge case | Result |
|-----------|--------|
| finalize before fund (live guard) | 409, question stays draft |
| set-budget double-call | idempotent, no second tx |
| forged jobId from another question | 400 (onchain description mismatch) |
| past deadline / zero budget create | both 400 |
| draft question public page | "not live yet" notice, no bounty copy |

## 4. Bugs found & fixes (audit step 4)

1. **NUMERIC-as-number crash (found by E2E run 1, 4/12):** PostgREST returns Postgres `NUMERIC` as JSON number; `usdcToRaw(row.budget).trim()` threw in 3 routes. Fixed at the boundary: `usdcToRaw`/`usdcDisplay` accept `string | number`, `toPublicQuestion` normalizes to strings. Re-run: 12/12.
2. **Real-world validation of the live guard:** during the broken run 1, set-budget crashed BEFORE setting the budget, then `fund` succeeded with budget=0 (the Phase 1 zero-budget-fund contract quirk, live). Finalize correctly REJECTED it ("onchain budget 0 does not match promised 1000000") — question `q6xp26xtnejc` stays draft/hidden forever, no funds lost (0 USDC was pulled). The guard caught exactly the scenario it was built for.
3. shadcn `Button` has no `asChild` in this template — landing page uses `Link > Button`.
4. Dev port fell back to 3002 (3000 occupied on this machine) — E2E honors `E2E_BASE_URL`.

## 5. Verification (audit step 5) + code review

- Full E2E re-run after fixes: **13/13 PASS** (§2 + review-driven edge below).
- `npx tsc --noEmit` clean; `next build` clean (10 routes).
- `code-reviewer` agent pass (`plans/reports/code-reviewer-260721-1159-phase2-review.md`), DONE_WITH_CONCERNS — all correctness findings fixed same-day:
  - **C1 (critical, FIXED):** `/job` now verifies onchain `expiredAt === question deadline` and `hook === 0x0` (blocks the early-expiry rug + hostile hook); `/finalize` additionally rejects jobs already past expiry. New E2E edge: job created with expiry deadline+9999s → `/job` returns 400 ✓ (`EDGE mismatched expiry rejected`).
  - **H1 (high, FIXED):** funded-but-finalize-failed no longer dead-ends: wizard step 4 shows a "Finalize — verify escrow" button (finalize-only, no wallet), and step-3 retry first reads the job onchain — if already Funded it skips straight to finalize instead of re-running fund (which would revert).
  - **M1 (FIXED):** `/job` CAS now checks matched-row count; concurrent loser gets an honest 409 (or ok if same jobId), never silent false success.
  - **M3 (FIXED):** wizard load failure shows a "Retry loading" button instead of a dead screen.
  - **M2 + lows (deferred with note):** `status` column default `'open'` + missing CHECK → scheduled into the Phase 3 migration (recorded in phase-03 Requirements); `budget::text` precision note and fund_tx-is-informational note recorded there too.

## 6. Phase 2 todo status

| Item | Status |
|------|--------|
| wagmi config + providers | ✅ |
| criteria schema + impossible-criteria warning | ✅ |
| criteria builder component | ✅ |
| POST /api/questions (draft + fee snapshot) | ✅ |
| funding wizard 3 steps, resumable, per-step status | ✅ |
| set-budget API route (backend, idempotent) | ✅ |
| finalize (onchain-verified live guard) | ✅ |
| question page + badge + criteria + countdown + Arcscan link | ✅ |
| landing page | ✅ |
| tsc + build clean + real-chain E2E | ✅ |

---

## MANUAL TEST GUIDE (bấm thử bằng browser)

Chuẩn bị: `npm run dev` (port 3000 hoặc 3002 — xem console). Ví browser (MetaMask) cần USDC trên Arc Testnet — nhanh nhất: import private key `DRYRUN_ASKER_PRIVATE_KEY` trong `.env.local` (ví test, còn ~10 USDC), hoặc faucet https://faucet.circle.com → ví của anh/chị.

1. Mở `http://localhost:3002/` → bấm **Ask a question**.
   - **Thấy:** form title/details/budget/deadline + khối Acceptance criteria; dòng "Winner receives X.XX USDC after protocol fees (live onchain read…)" xuất hiện dưới budget.
   - **Nếu hỏng:** dòng preview không hiện → `/api/fees` lỗi (RPC down).
2. Connect wallet (nút góc phải). Nếu sai mạng sẽ có nút đỏ "Switch to Arc Testnet" — bấm nó.
3. Điền: title bất kỳ, details vài dòng, budget `1`, deadline mặc định (+48h), criteria: min words 10, bật code required + `typescript`, thêm topic `chunked ranges`. Bấm **Create question & start funding**.
   - **Thấy:** wizard 3 bước hiện ra, bước 1 xanh dương (current).
4. Bấm **Run step 1** → xác nhận createJob trong ví → đợi → bước 1 tick ✓.
5. **TEST ĐỨT GÁNH:** đóng tab hoàn toàn. Mở lại `/ask`.
   - **Thấy:** banner vàng "You have an unfinished question" → bấm **Resume funding** → wizard hiện đúng ở bước 2, KHÔNG tạo job mới.
   - **Nếu hỏng:** wizard quay về bước 1 → báo tôi (lỗi resume).
6. Bấm **Run step 2** (backend setBudget — không cần ví) → tick ✓.
7. Bấm **Run step 3** → ví hỏi approve USDC → xác nhận → ví hỏi fund → xác nhận → đợi.
   - **Thấy:** tự chuyển sang trang `/q/<id>`: badge xanh "Bounty 1.00 USDC locked", "winner receives 1.00 USDC after protocol fees (0% today)", dòng "fees locked at creation: platform 0 bp · evaluator 0 bp", countdown đang chạy, link "Verify escrow on Arcscan ↗" mở tx fund thật, khối criteria, ô Answers ghi Phase 3.
   - **Nếu hỏng:** vẫn ở wizard với lỗi finalize → escrow chưa Funded (fund tx revert) hoặc RPC lag, bấm Retry.
8. **TEST GUARD:** tạo thêm 1 question mới nhưng DỪNG sau bước 1 (không fund). Mở `/q/<id-mới>` bằng tab ẩn danh.
   - **Thấy:** hộp vàng "This question is not live yet… not accepting answers" — KHÔNG có badge bounty.
9. (Tuỳ chọn) Mở Supabase Table editor → bảng `questions`: row mới có `job_id`, `net_payout`, `platform_fee_bp`, `evaluator_fee_bp`, `create_tx`, `fund_tx`, `status='open'`.

## Manual test result (user, 2026-07-21)

User ran the browser flow with their OWN wallet (`0x3b4691…87b3`) — PASSED end-to-end after 3 real-world hiccups, each fixed same-day:

1. `fund` revert with truncated error → error display now shows full revert reason (`9f0dea9`). Root cause of that revert: MetaMask custom spending cap below budget.
2. Browser `allowance` read hit public-RPC rate limit → wagmi now uses the hardened retry+fallback transport (`aa96086`).
3. `fund` submission rate-limited at MetaMask's RPC (outside app control) → resolved by wait-and-retry; Blockscout proxy RPC (`https://testnet.arcscan.app/api/eth-rpc`) verified to accept `eth_sendRawTransaction` as a wallet-side fallback.

Wizard resilience proven live: mid-flow failures at step 3 resumed cleanly, no duplicate jobs, no funds lost. Final state verified in DB: `ql0fb6rnhal2` status=open, budget=10, net_payout=10 (snapshot), job 159058, fund_tx `0x919a014e…79b344`. Abandoned 20-USDC draft (`qv7m5g5m307r`, cap-capped approve) stays draft/hidden with zero escrowed — exactly the designed behavior.

## Unresolved questions

None blocking. Carry-over notes for Phase 3 unchanged (nonce serialization, double-accept guard, PaymentReleased-derived forward, fail-closed eval).
