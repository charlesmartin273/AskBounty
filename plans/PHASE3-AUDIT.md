# PHASE 3 AUDIT — Answer Flow + Evaluation Agent + Payout

2026-07-22 · Status: **PASS** (9 E2E scripts, 66 assertions, all green on real Arc Testnet + real Gemini + real Supabase) — awaiting user approval.

Scope (user-expanded): signed answer submission → objective checks → Gemini eval → first-pass-wins accept → **onchain payout (submit → complete → forward) → dual-tx receipt**. Cron sweep / refund / browse stay in Phase 4.

## 1. Deviations vs PRD/plan

| # | Deviation | Resolution |
|---|---|---|
| 1 | PRD §3/§4.3: cron evaluates "within 5 minutes" → built trigger-on-submit (instant, inline) | Approved architecture (brainstorm). Cron sweeper for stuck answers = Phase 4 |
| 2 | PRD §3 `callClaude` → Gemini free tier | PRD-ERRATA E5, user-approved, provider-swappable via `lib/eval/llm-client.ts` |
| 3 | PRD §5 "releases 20 USDC to answerer" → two-hop Option B (escrow→agent→winner), minus protocol fees | PRD-ERRATA E1/E2, user-approved. Forward amount = `PaymentReleased.amount` exactly (M2) |
| 4 | PRD §4.3 "Markdown editor" → textarea + safe preview (text + ``` code fences only) | Full markdown render deferred to Phase 5 (XSS-safe by construction, matches question body) |
| 5 | PRD §6 first-pass-wins rule "printed on every question page" — was only shown when 0 answers | **FIXED during audit**: rule now always printed in the Answers section |
| 6 | PRD §6 "cancel while zero submissions" — not implemented in any phase plan | Open question for user (cut or v2) — see Unresolved |
| 7 | PRD §6 agent-wallet low-gas warning — not built | Deferred to Phase 5 polish (per plan) |
| 8 | Payout+receipt pulled from Phase 4 into Phase 3 | User-approved scope change, recorded in both phase files |

## 2. Real-run evidence (all on Arc Testnet, jobs 159063-159117)

Dev server `next dev` :3002, `E2E_BASE_URL=http://localhost:3002`. Post-fix confirmation runs marked ✱.

### `npx tsx scripts/e2e-phase3-answer-flow.ts` ✱ — 14/14 PASS (R5, R2, R4)
```
PASS | R5a garbage signature -> 401 · R5b tampered body -> 401 · R5c address spoof -> 401
PASS | R5 no DB rows written on rejection | answers rows = 0
PASS | lazy answer -> failed with per-check reasons | min_words 11/50 FAIL, has_code_block FAIL
PASS | LLM NOT called on objective fail (no topics_covered entry)
PASS | cooldown blocks rapid resubmit -> 429
PASS | good answer -> accepted | min_words:true, has_code_block:true, topics_covered:true
PASS | payout paid with both txs recorded
PASS | R2 winner balance delta == net_payout snapshot
       before=7.234567 after=8.234567 delta=1.000000 USDC == snapshot=1.000000 USDC
PASS | R4 receipt shows both txs + Arcscan links | /q/qz499bkubk0j
PASS | post-accept submit -> 409 · question flipped to answered
complete: https://testnet.arcscan.app/tx/0x16da6672c34043e94b7e4aa2586052de666ab059c67e8a5f803538d99c10f03c
forward:  https://testnet.arcscan.app/tx/0x67ecc7c20c9d9f86e361340015a28b601ea3ca01139ff0000c5a52c3eacaff7e
```

### 4 mandatory items — one dedicated E2E each (yêu cầu 1)

**H2 nonce serialization** — `e2e-phase3-nonce-serialization.ts` — 3/3 PASS. Two questions accepted concurrently → 2 full payouts (6 agent-wallet txs) through `withAgentWallet` + viem `nonceManager`, zero nonce errors, 4 distinct txs:
```
A complete 0x36477d…c635985c · A forward 0x07b00b…ea282da1
B complete 0xf3c52a…dbbb3e23 · B forward 0xdb2a14…294235c5
```

**M1 double-accept** — `e2e-phase3-double-accept.ts` ✱ — 5/5 PASS. Two passing answers, same question, same instant → exactly ONE accepted (a1=accepted, a2=failed "another answer was accepted first"), exactly ONE payout pair (complete `0xba66aa…cfc0f316`, forward `0x05c8d0…c778b620`); direct DB probe: second `accepted` row rejected by `one_accepted_per_question`.

**M2 forward-per-event** — `e2e-phase3-forward-event-amount.ts` ✱ — 4/4 PASS with distinctive budget **1.234567 USDC**: `PaymentReleased.amount` (parsed independently from the complete receipt) == recorded paid.amount == winner balance delta == net_payout snapshot == 1.234567 exactly (post-fix run job 159118: complete `0xf0fea23b5b3cb5dabd55f0d668ba9aa49b0f59dacd0438c07e6faaded3d8cdca`, forward `0xf4a2f7dd0e27a7722610cb6dd491634d11079ff5d0aec1f7bf27550194c21458`; identical pre-fix run on job 159064).

**M3 fail-closed verdict** — `e2e-phase3-fail-closed-verdict.ts` ✱ — 21/21 PASS. 11 malformed LLM outputs through the REAL evaluate-answer path (injected transport) → all `error`, never accepted; `overall=true` with uncovered topic → demoted to fail; LlmEvalError 429→retryable / 401→not; objective gate short-circuits before LLM on BOTH branches (topics + empty-topics); delimiter neutralization verified on BOTH blocks (answer-side C1 + asker-side, exactly 4 framing delimiters survive); empty-topics prompt contains question text + direct_answer criterion; valid verdict controls → pass.

### R3 Gemini failure — `e2e-phase3-eval-error-retry.ts` — 5/5 PASS (yêu cầu 3)
Second server started with `GEMINI_API_KEY=invalid-key-for-r3-test` (same DB). Submit through it → Gemini 400 API_KEY_INVALID → answer stays `pending` with error surfaced; public page shows **"evaluation pending, retrying"** + Retry button; manual retry through the healthy server → accepted + paid (complete `0x62a2cf…753afcd`, forward `0x561a66…4e53dbd7`). No silent hang at any point.

### Discrepancy rule "số vào bằng số ra" — `e2e-phase3-payout-discrepancy.ts` — 4/4 PASS
Fee drift cannot be forced onchain (no admin role) → simulated by tampering the DB snapshot to 0.75 while escrow releases 1.000000. Result: winner received the FULL 1.000000 (agent retained nothing), `paid.discrepancy={released:"1", expectedNet:"0.75"}` recorded, receipt shows "Fee change detected" with both numbers. (complete `0x4e30b8…c208949`, forward `0x4ab0bc…6012c378`)

### Empty-topics eval branch (manual-test finding, permanent regression E2E)
`e2e-phase3-empty-topics-eval.ts` — 4/4 PASS (question qmocpdikler7, job 159122, criteria `{minWords:1, topics:[]}`): terse WRONG answer "21" → failed by the LLM on **correctness** ("mathematically incorrect. The correct sum of 9 and 10 is 19"), objective checks ran first and passed independently; terse CORRECT answer "19" → **accepted + paid** (complete `0x9a183d96…b7d7e8`, forward `0xe23f0709…a88a3754`). Script stays in the suite permanently so future prompt edits cannot re-break this branch.

### Migration + edge cases
- `verify-phase3-migration.ts` (after user ran migration-003): status CHECK **APPLIED**, unique index **APPLIED**, default `'draft'` **APPLIED**.
- `e2e-phase3-edge-cases.ts` ✱ — 6/6 PASS (see §3).

## 3. Edge cases (AUDIT step 3)

| Edge case | Result |
|---|---|
| Empty/whitespace body | 400 "answer body is required" |
| Oversized body (>20k chars) | 400 with limit in message |
| Submit to draft (unfunded) question | 409, no eval, no LLM call |
| Retry with malformed / unknown answer id | 400 / 404 |
| Invalid questionId, missing signature | 400 / 400 |
| Concurrent duplicate submit, same wallet (double-click past UI guard) | both rejected by status guard; on an open question cooldown TOCTOU could admit both rows — accept CAS + unique index are the money-safety backstop (documented residual, no fund risk) |

6/6 PASS.

## 4. Bugs found & fixes (code review `plans/reports/code-reviewer-260721-1610-phase3-review.md`)

All 7 E2E suites passed BEFORE review; the review targeted what tests are blind to. Fixed and re-verified:

1. **C1 (critical, security):** `"""` delimiter escapable inside answer body → prompt-injection/bounty-theft vector. Fix: neutralize `"""` → `\"\"\"` in `llm-review-prompt.ts`; new E2E asserts only the 2 framing delimiters survive.
2. **C2 (critical, funds):** unauthenticated retry racing an in-flight eval could overwrite `accepted`→`failed` (stranded bounty). Fix: every answer-status write guarded `.eq("status","pending")` + affected-rows check; retry route refuses pending answers without a recorded error.
3. **H2:** crash window between question-flip and answer-accept. Fix: inverted order — accept FIRST (unique index arbitrates), then flip; `ensureQuestionAnswered` heals the gap on retry.
4. **H1:** `parsePaymentReleasedAmount` first-match ambiguous if fee BPs ≠ 0 (agent = provider AND evaluator → possible 2 legs). Fix: require EXACTLY one matching event, else loud `payout_failed`.
5. **M1/M3 (review):** unchecked Supabase update errors could hide the Retry button (silent R3 hang). Fix: `guardedUpdate` throws on error; POST route catches pipeline throws and persists `{code:"internal", retryable:true}`.
6. **M2 (review):** retry endpoint = free Gemini spam. Fix: gated to errored answers + 10s per-answer throttle.
7. **L1:** `topics: []` passed vacuously → now rejected fail-closed. **L4:** provider error bodies persisted publicly → single-line, 200-char cap. **L6:** receipt rounded 1.234567→"1.23" → now exact decimal strings.
8. **PRD §6 deviation (self-found, step 1):** first-pass-wins rule now printed on every question page.
9. **Empty-topics eval judged blind (found by USER manual test, 2026-07-22):** the review prompt never included the question, so with `topics:[]` the LLM was asked about "the question's subject" without seeing the question — terse-but-correct answers ("19" for "what is 9+10") failed as "no context". Fix (user-approved security constraints honored): question title+body now embedded as a SEPARATE labeled+delimited+neutralized block (context only — asker gets no injection backdoor; answer stays absolutely untrusted); with `topics:[]` the LLM judges one `direct_answer` criterion ("does the ANSWER directly and correctly answer the QUESTION?"); objective checks unchanged — still run first, in code, independent of the LLM on both branches. Verified offline (21/21) + live (4/4, see Empty-topics section); permanent regression script added.

Deferred (documented, no fund risk): cooldown TOCTOU (L2), signature-replay comment (L5).

## 5. Verification

- `npx tsc --noEmit` clean; `npm run build` clean (routes `/api/answers`, `/api/answers/[id]/retry` present).
- Post-fix re-runs ✱: answer-flow 14/14, edge-cases 6/6, double-accept 5/5, fail-closed 17/17, forward-event re-run (see appended result), all payout paths exercised through the fixed code.
- Review status: DONE_WITH_CONCERNS → both critical + both high findings fixed same day; re-verified.

## 6. Phase todo status

| Item | Status |
|---|---|
| Signature verify + recover (R5, server-side, pre-DB) | ✅ |
| Cooldown helper (60s per wallet per question) | ✅ |
| Objective checks (gate before LLM) | ✅ |
| LLM review prompt (delimited + neutralized untrusted input) | ✅ |
| Verdict validation fail-closed (M3) | ✅ |
| evaluate-answer orchestrator (injectable transport) | ✅ |
| POST /api/answers (verify → insert → eval → accept-first CAS) | ✅ |
| POST /api/answers/[id]/retry (R3 manual retry + payout resume + heal) | ✅ |
| Payout pipeline accept-answer (H2-serialized, M2 event amount, claim-gated) | ✅ |
| Dual-tx receipt + discrepancy line (R4) | ✅ |
| Answer editor + preview + eval results UI + answer list | ✅ |
| Mounted on /q/[id] (+ WalletConnect, first-pass rule) | ✅ |
| migration-003 (status default/CHECKs + unique index) — applied + verified | ✅ |
| 9 E2E scripts (4 dedicated per R1 + R3 + discrepancy + flow + edges + empty-topics regression) | ✅ |
| tsc + build clean | ✅ |

---

## MANUAL TEST GUIDE

Chuẩn bị: `npm run dev` đang chạy; ví MetaMask trên Arc Testnet có chút USDC (chỉ để ký message — trả lời KHÔNG tốn gas); một question đang mở (tạo qua `/ask` với budget nhỏ, criteria: minWords 50, cần code block, 1-2 topics).

1. Mở `/q/[id]` của question đang mở → kéo xuống "Your answer" → bấm **Connect wallet** (ví KHÁC ví asker).
   - **Thấy:** khung soạn thảo với 2 tab Write/Preview, nút "Sign & submit answer", dòng luật "First answer that passes all criteria wins…" phía trên danh sách answers.
   - **Nếu hỏng:** không thấy editor → question chưa `open` (chưa fund xong) hoặc đã hết hạn.
2. Gõ câu trả lời lười ("just use pagination", ~10 từ, không code) → Preview xem thử → Sign & submit, ký message trong ví.
   - **Thấy:** sau ~1 giây, kết quả từng check hiện ra: ✗ min_words (11/50 words), ✗ has_code_block; badge FAILED đỏ; question vẫn OPEN.
   - **Nếu hỏng:** quay mãi không trả → xem log server; không bật ví ký → editor lỗi signMessage.
3. Đợi hết 60s cooldown, dán câu trả lời đạt chuẩn (≥50 từ + ``` code block + đủ topics) → ký → submit.
   - **Thấy:** cả 3 check ✓ (kể cả topics_covered kèm reasoning của LLM); badge ACCEPTED xanh; đầu trang hiện **receipt xanh "Bounty paid: X USDC → 0x…"** với ĐÚNG 2 dòng transaction: "1. escrow → agent wallet (complete)" và "2. agent wallet → winner (forward)", mỗi dòng 1 link Arcscan; editor biến mất ("submissions are closed").
   - **Nếu hỏng:** accepted nhưng receipt vàng "payout pending, retrying" → payout lỗi, bấm **Retry payout**; vẫn hỏng → xem `eval_results.payoutError`.
4. Bấm cả 2 link Arcscan trên receipt.
   - **Thấy:** tx 1 = `complete` trên contract AgenticCommerce (escrow trả agent); tx 2 = USDC `transfer` từ ví agent đến ĐÚNG ví bạn vừa ký, số tiền ĐÚNG BẰNG "winner receives X" hiển thị trước khi trả lời. So số dư ví: tăng đúng X.
   - **Nếu hỏng:** số lệch → chụp màn hình cả 2 tx báo lại (đây là invariant quan trọng nhất).
5. Submit lại lần nữa từ ví bất kỳ.
   - **Thấy:** báo lỗi "question is not accepting answers (status: answered)".
6. **Drill R3 (ép lỗi Gemini):** mở `.env.local`, đổi `GEMINI_API_KEY` thành `sai123` → restart `npm run dev` → tạo question mở mới → submit câu trả lời đạt chuẩn.
   - **Thấy:** answer treo ở trạng thái vàng **"evaluation pending, retrying"** kèm mã lỗi Gemini + nút **Retry evaluation** — KHÔNG im lặng, KHÔNG failed, KHÔNG accepted.
   - **Nếu hỏng:** answer thành failed/accepted → fail-closed bị vỡ, báo ngay.
7. Khôi phục `GEMINI_API_KEY` đúng → restart dev server → mở lại trang → bấm **Retry evaluation**.
   - **Thấy:** eval chạy lại → accepted → receipt 2 tx như bước 3-4.
   - **Nếu hỏng:** 429 "retry throttled" → đợi 10 giây bấm lại.
8. **Test câu hỏi đơn giản không topics:** tạo question kiểu "What is 9 + 10?" với min words = 1, KHÔNG bật code required, KHÔNG thêm topic → submit "21" từ 1 ví, rồi "19" từ ví khác.
   - **Thấy:** "21" FAILED với lý do sai số học (reasoning nói rõ đáp án đúng là 19); "19" ACCEPTED + payout, dù chỉ 1 từ.
   - **Nếu hỏng:** "19" bị fail vì "thiếu ngữ cảnh" → prompt không nhúng question, regression của fix 2026-07-22 (chạy `npx tsx scripts/e2e-phase3-empty-topics-eval.ts` để xác nhận).

## Unresolved questions

1. ~~Fee BPs ≠ 0: agent giữ evaluator fee hay forward cả?~~ **RESOLVED (user, 2026-07-22):** agent forward **TOÀN BỘ** phần escrow release, không giữ evaluator fee — "số vào = số ra" tuyệt đối kể cả khi fee ≠ 0. Fail-loud giữ nguyên khi release đa-leg mơ hồ. README đã sửa (bỏ mọi câu agent giữ evaluator fee); copy receipt sửa thành "the agent kept nothing".
2. **`complete()` sau `expiredAt`:** hành vi chưa xác minh onchain — race payout-vs-refund quanh deadline sẽ rơi vào `payout_failed` (loud). Đề xuất xử lý UX ở Phase 4 (cron đánh dấu expired).
3. ~~PRD §6 "cancel khi chưa có answer nào"~~ **RESOLVED (user, 2026-07-22):** để v2, KHÔNG làm trong hackathon — expiry refund đã đảm bảo tiền không bao giờ kẹt; cancel chỉ là tiện lợi. Ghi vào README mục Known limitation: "Askers reclaim funds via expiry refund; explicit early-cancel is a v2 convenience."
4. Dev server đang chạy của anh/chị ở :3002 (PID 21592) được dùng cho E2E (hot-reload code mới); server :3005 tạm cho drill R3 đã tắt.
