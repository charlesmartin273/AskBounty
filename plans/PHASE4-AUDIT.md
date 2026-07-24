# PHASE 4 AUDIT — Cron Sweep + Claim Refund + Browse + My Activity

2026-07-23 (updated 07-24) · Status: **PASS** (4 Phase-4 E2E scripts = 32 assertions + Phase-3 flow regression 14/14, all green on real Arc Testnet + Supabase) — awaiting user approval.

Live incident during the gate: `claimRefund` reality contradicted PRD-ERRATA E3 → protocol followed, recorded as **E6**, user decided, code hardened, re-tested (details §4).

## 1. Deviations vs PRD/plan

| # | Deviation | Resolution |
|---|---|---|
| 1 | PRD §4.4 browse filters (budget range, topic tags) → cut to a budget-desc list of open bounties | Plan marked filters cuttable; MVP scope |
| 2 | PRD §4.5 Asked tab "spend, refunds" → simplified to status + budget + refund link; Answered tab has earnings + pass rate | KISS; expandable in Phase 5 |
| 3 | PRD §5 "auto-refund flow" → claim-refund button (cron only marks expired) | PRD-ERRATA E3, user-approved Phase 1 |
| 4 | PRD §3 cron re-evaluation duties → cron does expiry marking ONLY | User constraint C1 (this phase); manual Retry buttons cover stuck evals/payouts |
| 5 | **E3's "claimRefund requires msg.sender == client" is FALSE on the live contract** | **E6** (new errata): caller is permissionless, funds ALWAYS go to the asker. User decision: UI stays asker-gated; record API verifies by decoding calldata |
| 6 | `payout-state.ts` from the original phase plan never created | YAGNI — transitions live inside accept-answer (recorded in phase file at Phase 3) |

## 2. Real-run evidence

Dev server :3002 · `E2E_BASE_URL=http://localhost:3002` · migration-004 applied by user, probed APPLIED (both checks) by `scripts/verify-phase4-migration.ts`.

### `e2e-phase4-refund.ts` — 13/13 PASS (C2 money path; ~11-minute run with REAL onchain expiry — question qnn336hav91k, job 159264)
```
PASS | refund BEFORE expiry reverts (contract) · refund API before expiry -> 409
PASS | cron marks the question expired | sweep={"expired":1,"ids":["qnn336hav91k"]}
PASS | submitting to an expired question -> 409
PASS | forged record (successful createJob tx) -> 400 (wrong calldata)
PASS | forged record (nonexistent tx) -> 400
PASS | C2/E6 non-asker trigger succeeds AND the FULL budget lands with the ASKER
       askerDelta=1.000000 USDC == budget (exact to the unit; gas paid by the trigger caller)
       tx=0x4531c5ea4deed00487400e3316a4163ba1009653c8b2a0383b05c0b818984582
PASS | job no longer Funded (onchain status=5) · refund recorded -> status refunded
PASS | page shows refunded banner + Arcscan link · refunded question absent from browse
PASS | C2 second onchain refund reverts (even from the asker) · second record -> 409
```

### `e2e-phase4-cron-sweep.ts` ✱ — 6/6 PASS (C1/C3)
No/wrong secret → 401 (fail-closed) · open+past-deadline → expired · answered/draft/open-future untouched · second run idempotent (`expired: 0`) · browse shows ONLY the live fixture.

### `e2e-phase4-browse-activity.ts` ✱ — 7/7 PASS (C3/C4)
Browse hides answered/draft rows · activity invalid address → 400 · **C4:** fixture accepted-but-UNPAID answer surfaces `payoutStatus != 'paid'` (UI label "Accepted — payout pending", never bare accepted); real paid answer carries exact `paidAmount` + forward tx (`0x90beaae7…`) · asked list correct (22 rows) · `/activity` route renders.

### `e2e-phase4-deadline-guards.ts` — 6/6 PASS (M2 fix, user-approved 2026-07-24; permanent regression)
Through the REAL retry route: **guard 1** (deadline already past) → failed in 727ms with NO check results (Gemini never called); **guard 2** (deadline passed DURING evaluation — fixture deadline +1.2s vs Gemini latency) → the evaluation ran and PASSED (`topics_covered=true`) yet the accept was blocked: question stayed `open`, no complete_tx, no payout. Both guards return the EXACT honest copy, distinct from a content failure: *"Submitted in time, but evaluation did not finish before the deadline. The bounty was refunded to the asker."* UX companion: `/q/[id]` shows "Deadline is near: evaluation may not finish in time" when <10 minutes remain (soft nudge, never blocks).

### Regression — `e2e-phase3-answer-flow.ts` ✱ — 14/14 PASS
Full Phase-3 flow unbroken after Phase-4 changes (payout qpxtevaodxja: complete `0xc3caca0d…`, forward `0x575f9f72…`, winner delta 1.000000 == snapshot).

## 3. Edge cases

| Edge case | Result |
|---|---|
| Cron double-run | idempotent, `expired: 0` |
| Refund before expiry (contract AND API) | revert / 409 |
| Forged refundTx: real-but-wrong-function tx; nonexistent hash | 400 / 400 (calldata decode) |
| Double refund (onchain AND record API) | revert / 409 |
| Submit answer to expired question | 409 |
| Activity with malformed address | 400 |
| Refund-vs-late-passing-answer race | analyzed (review M2): onchain serialization makes it money-safe (submit() moves job out of Funded → refund reverts, or refund lands first → payout fails LOUD as payout_failed); narrow display-only stale state possible — see Unresolved #1 |

## 4. Incident + review findings & fixes

**E6 incident (found live by this phase's own E2E):** a NON-asker `claimRefund` SUCCEEDED (E3 said it must revert) — but Arcscan token-transfer proof showed the full 1.000000 USDC went to the ASKER (tx `0xd328ecfc…`). PRD CONFLICT PROTOCOL followed: task stopped, E6 written with evidence, user decided (asker-gated UI kept; permissionless trigger accepted). The same run exposed that the record API's "job no longer Funded" check was forgeable once third parties can trigger refunds → **fix: decode tx calldata, require `claimRefund(jobId)` for exactly this question's job** (drops `from == asker`, which E6 invalidated). The one wrongly-recorded row (qa58gidet2qy) was corrected to the real trigger tx.

Code review (`plans/reports/code-reviewer-260723-1130-phase4-review.md`, DONE_WITH_CONCERNS — all 5 constraints PASS, zero criticals):
1. **H1 (FIXED):** retry-route crash-window heal discarded `ensureQuestionAnswered`'s boolean → could 500; now returns 409 with the reverted-accept state.
2. **M1 (FIXED):** = the E6 calldata-decode fix above; receipt link now unforgeable.
3. **M3 (FIXED):** activity earnings summed via float → now bigint raw units (`usdcToRaw`/`rawToUsdc`).
4. **M2 (FIXED 07-24, user-approved):** two deadline guards in `process-answer-evaluation` — #1 BEFORE the LLM call (zero API cost on dead questions), #2 immediately before accept/payout (evaluation may outlast the deadline). Honest, content-distinct failure copy; near-deadline nudge on `/q/[id]`; dedicated permanent regression script (6/6). Closes Unresolved #1.
5. Lows deferred (documented, no fund risk): non-constant-time cron token compare; stale fetch race on wallet switch; `(status,deadline)` index; retry burns one LLM eval on dead questions.

## 5. Verification

- `npx tsc --noEmit` + `npm run build` clean (routes `/browse`, `/activity`, `/api/cron/sweep`, `/api/questions/[id]/refund`, `/api/activity`); new-file eslint clean.
- Post-remediation reruns ✱ all green; refund suite fully re-run after the E6 hardening.
- Costs this phase: 2 refund questions (2 USDC out, 2 USDC returned to asker) + 1 regression question (1 USDC paid to winner throwaway).

## 6. Phase todo status

| Item | Status |
|---|---|
| Cron sweep route (auth fail-closed, expiry-only per C1) + vercel.json daily | ✅ |
| migration-004 ('refunded' status + refund_tx) — applied + probed | ✅ |
| Refund record API (calldata-decode verification, CAS, no-accepted-answer guard) | ✅ |
| Claim-refund button (asker-gated UI) on /q/[id] expired state; refunded banner + tx link | ✅ |
| /browse (open + future-deadline only) + question cards | ✅ |
| /activity (Asked/Answered tabs, C4 labels, bigint earnings) + /api/activity | ✅ |
| Site nav on all pages (R10) + landing Browse CTA | ✅ |
| 3 E2E scripts + migration verifier + incident investigation script | ✅ |
| Review fixes H1/M1/M3; E6 errata + user decision recorded | ✅ |
| tsc/build/lint clean + Phase-3 regression green | ✅ |

---

## MANUAL TEST GUIDE

Route map (rule 10): **/** (nav + CTA) · **/browse** · **/activity** · **/ask** · **/q/[id]** (refund flow sống ở đây). Server dev: `npm run dev`.

1. Mở **/** → thấy thanh nav "Browse · My activity · Ask a question" + nút "Browse bounties". Bấm **Browse**.
   - **Thấy:** `/browse` liệt kê CHỈ những question đang mở còn hạn (mỗi card: title, "winner receives X USDC", thời gian còn lại, badge budget). Question draft/hết hạn/đã trả lời không xuất hiện.
   - **Nếu hỏng:** thấy question draft/hết hạn → lỗi filter C3, báo ngay.
2. Bấm một card → về `/q/[id]` như Phase 3.
3. Mở **/activity**, bấm Connect wallet (ví đã từng thắng bounty — vd ví winner test).
   - **Thấy:** 2 tab. Tab Answered: answer thắng hiện **"Paid X USDC · verify ↗"** (link Arcscan tx forward) — KHÔNG BAO GIỜ hiện chữ "accepted" trần; nếu có answer accepted mà payout chưa xong sẽ hiện **"Accepted — payout pending"** màu vàng. Dòng "Earnings … · Pass rate …" phía trên.
   - **Nếu hỏng:** thấy "accepted" trần không kèm trạng thái tiền → vi phạm C4, báo ngay.
4. **Flow refund (tiền thật trên testnet, ~12 phút):** tạo question mới qua `/ask` với budget nhỏ (1 USDC) và **deadline = thời điểm hiện tại + 11 phút**, fund đủ 3 bước wizard. Đợi qua deadline (~11 phút).
   - Trong lúc chờ, mở `/q/[id]`: vẫn hiện OPEN vì cron ngày chạy 1 lần — đây là hành vi đúng ("submissions are closed pending the daily expiry sweep" nếu quá hạn). Khi còn dưới 10 phút, cạnh khung "Your answer" có dòng nhắc vàng **"Deadline is near: evaluation may not finish in time."** (chỉ nhắc, không chặn).
5. Kích cron thủ công (thay `<CRON_SECRET>` bằng giá trị trong `.env.local`):
   `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3002/api/cron/sweep`
   - **Thấy:** JSON `{"expired":1,...}`; refresh `/q/[id]` → banner vàng "Question expired — no accepted answer" + nút **Claim refund**.
   - **Nếu hỏng:** 401 → sai secret; expired:0 → deadline chưa qua thật.
6. Connect ví KHÁC asker → nút Claim refund bị disable kèm dòng "Only the asker (0x…) can claim". Đổi sang ví asker → bấm **Claim refund**, ký tx.
   - **Thấy:** sau xác nhận, trang chuyển banner "Bounty refunded to the asker." + link tx Arcscan; số dư USDC ví asker tăng ĐÚNG bằng budget. `/browse` không còn question này; tab Asked trong `/activity` hiện "refunded ↗".
   - **Nếu hỏng:** tx revert "not expired" → chưa qua `expiredAt` onchain, đợi thêm 1 phút; nút vẫn hiện sau refund → chưa refresh.
7. Bấm Claim refund lần nữa (hoặc gọi lại API record) → tx revert / API 409 "refund already recorded".
8. Kiểm tra cron không đụng việc khác: chạy lại lệnh curl bước 5 → `{"expired":0}` (idempotent, không có eval/payout retry nào bị kích).

## Unresolved questions

1. ~~Review M2 race~~ **RESOLVED (user-approved, 2026-07-24):** hai deadline guard đã vào `process-answer-evaluation` (trước LLM + trước accept), lý do hiển thị trung thực tách bạch khỏi "trả lời sai", nhắc gần-deadline trên `/q/[id]`, regression script `e2e-phase4-deadline-guards.ts` 6/6 giữ vĩnh viễn.
2. Hành vi `complete()` sau `expiredAt` vẫn chưa xác minh onchain (tồn từ Phase 3) — với guard #2, app không còn đường nào gọi `complete()` sau deadline, nên câu hỏi này chỉ còn giá trị tài liệu.
3. Server dev của anh/chị (:3002) dùng cho toàn bộ E2E; các fixture DB đều đã tự dọn.
