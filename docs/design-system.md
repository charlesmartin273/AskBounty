# Design System — trích từ "Orionix"

**Nguồn:** `C:\Users\pc\Desktop\Clone Web\Orionix` (Next.js + Tailwind v4).
**Độ tin cậy:** CAO. Project có file token thật, không phải mockup ảnh.
Đọc trực tiếp từ:

- `src/app/globals.css` — block `@theme inline` + `:root` + typography utilities
- `src/app/layout.tsx` — khai báo font
- `src/components/*.tsx` — giá trị component (padding, radius, shadow, hover)

Không có giá trị nào phải "ước lượng từ ảnh".

**Mục đích:** đây là ngôn ngữ thiết kế để tham chiếu. KHÔNG copy nội dung, layout,
hình ảnh, hay copywriting của Orionix.

---

## 1. Màu

### 1.1 Palette gốc (5 màu, `globals.css:13-17`)

| Vai trò | Token | Hex | Ghi chú |
|---|---|---|---|
| Background trang | `--color-cream` | `#f9f8f6` | Trắng ngà, hơi ấm. KHÔNG phải `#ffffff` |
| Surface / card | (dùng thẳng) | `#ffffff` | Card trắng tinh nổi trên nền cream |
| Text chính / ink | `--color-ink` | `#141414` | Gần đen, không dùng `#000000` |
| Text phụ | `--color-muted` | `#656565` | Mô tả, đoạn văn phụ |
| Text mờ nhất | `--color-faint` | `#a4a4a4` | Ngày tháng, số thứ tự, icon disabled |
| Accent | `--color-accent` | `#ff0000` | Đỏ nguyên chất, dùng CỰC ít |
| Surface tối | (dùng thẳng) | `#141414` / `#000000` | Card dark, panel CTA |

Toàn hệ chỉ có **1 màu duy nhất không thuộc thang xám**: đỏ `#ff0000`.

### 1.2 Border / hairline (`globals.css:20-26`)

Không có màu viền đặc — tất cả là **đen alpha thấp**, xếp thang 4 cấp:

| Token | Giá trị | Dùng ở đâu |
|---|---|---|
| `--color-line` | `rgb(0 0 0 / 0.04)` | Viền vỏ hero (mảnh nhất) |
| `--color-line-2` | `rgb(0 0 0 / 0.06)` | Border mặc định, mobile menu |
| `--color-line-3` | `rgb(0 0 0 / 0.08)` | Divider FAQ, đường kẻ footer |
| `--color-line-4` | `rgb(0 0 0 / 0.1)` | Ring / focus |

Trên nền tối thì đảo lại:

| Token | Giá trị |
|---|---|
| `--color-line-inv` | `rgb(255 255 255 / 0.1)` |
| `--color-line-inv-2` | `rgb(255 255 255 / 0.06)` |
| `--color-on-dark-muted` | `rgb(255 255 255 / 0.64)` — text phụ trên nền đen |

Divider trong card tối dùng `rgba(255,255,255,0.12)`; trong card sáng dùng `rgba(0,0,0,0.1)`
(`pricing-section.tsx:160`).

### 1.3 Trạng thái

**Hệ này KHÔNG có màu success / warning / info.** Chỉ có:

- `--destructive: #ff0000` (`globals.css:59`) — trùng luôn với `--accent`
- `--accent-foreground: #ffffff`

Nếu áp cho AskBounty (có trạng thái paid / pending / failed) thì phải **tự thêm**
success + warning. Đề xuất giữ tinh thần low-saturation của hệ gốc:

- success `#1a7f4b`, bg `rgb(26 127 75 / 0.08)`
- warning `#8a6100`, bg `rgb(138 97 0 / 0.08)`
- error: dùng luôn `#ff0000`, bg `rgb(255 0 0 / 0.06)`

(3 dòng này là **đề xuất mở rộng**, không có trong source.)

### 1.4 Bridge shadcn (`globals.css:44-64`)

```
--background: #f9f8f6   --foreground: #141414
--card: #ffffff         --card-foreground: #141414
--primary: #141414      --primary-foreground: #ffffff
--secondary: #ffffff    --secondary-foreground: #141414
--muted: rgb(0 0 0/.04) --muted-foreground: #656565
--accent: #ff0000       --border: rgb(0 0 0/.06)
--input: rgb(0 0 0/.08) --ring: rgb(0 0 0/.1)
--radius: 24px
```

Điểm đáng chú ý: `--primary` là **đen**, không phải đỏ. Đỏ chỉ là dấu chấm nhấn.

---

## 2. Typography

### 2.1 Font family (`layout.tsx:9-26`, `globals.css:29-31`)

| Vai trò | Font | Fallback |
|---|---|---|
| Display / heading | **Fraunces** (variable serif) | `serif` |
| Body / UI | **Inter** | `sans-serif` |
| Label / eyebrow | **Geist Mono** | `monospace` |

Fraunces chạy variable axes cụ thể — đây là chi tiết làm nên "chất" của hệ:

```css
font-feature-settings: "ss01" on;
font-variation-settings: "opsz" <bằng font-size>, "wght" 350, "SOFT" 100, "WONK" 1;
```

`WONK 1` bật glyph nghiêng lệch của Fraunces; `SOFT 100` bo mềm chân chữ.
Nếu dùng font khác thì mất đúng cái nét này.

### 2.2 Thang display (Fraunces, weight 400, `globals.css:103-200`)

| Class | Size | Line-height | Letter-spacing | Dùng cho |
|---|---|---|---|---|
| `t-display-128` | 128px | 128px | -5.12px | Marquee full-bleed |
| `t-display-72` | 72px | 76px | -2.98px | H1 hero |
| `t-display-64` | 64px | 68px | -2.56px | Heading section lớn |
| `t-display-56` | 56px | 60px | -2.24px | Heading section chuẩn |
| `t-display-48` | 48px | 52px | -1.92px | Số liệu / counter |
| `t-display-40` | 40px | 44px | -1.6px | Tiêu đề step |
| `t-display-32` | 32px | 36px | -1.28px | Tiêu đề card, giá tiền |
| `t-display-24` | 24px | 28px | -0.96px | Tiêu đề card nhỏ |
| `t-wordmark` | 16px | 12px | -0.48px | Logo chữ (weight **500**) |

**Quy luật:** line-height ≈ size + 4px. Letter-spacing = **size × -0.04** (âm, luôn luôn).
Đây là công thức tái dựng được cho mọi cỡ mới.

### 2.3 Thang body (Inter, `globals.css:203-245`)

| Class | Size / LH / LS | Weight |
|---|---|---|
| `t-body-16` | 16 / 24 / -0.32px | 400 |
| `t-body-16-medium` | 16 / 24 / -0.32px | 500 |
| `t-body-14` | 14 / 20 / -0.28px | 400 |
| `t-body-14-medium` | 14 / 20 / -0.28px | 500 |
| `t-body-12-medium` | 12 / 16 / -0.24px | 500 |
| `t-button` | 16 / 16 / -0.2px | 500 |

Chỉ 2 weight: **400 và 500**. Không có bold 600/700 ở đâu cả.
Letter-spacing body = size × -0.02.

### 2.4 Label (Geist Mono, `globals.css:248-256`)

```
t-label: 12px / 16px / letter-spacing +0.36px / UPPERCASE / wght 550
```

Đây là kiểu duy nhất có **letter-spacing dương** và viết hoa. Dùng cho eyebrow,
tên social, timezone.

### 2.5 Responsive typography

Không dùng `clamp()`. Heading được override thủ công ở breakpoint:

- `t-display-56` → mobile (`<810px`): `40px / 44px / -1.6px`
- `t-display-64` → tablet: `48/52/-1.92`, mobile: `32/36/-1.28`
- `t-display-72` (hero) → mobile: `48/52/-1.76`, tablet: `72/78/-2.88`

---

## 3. Spacing

### 3.1 Đơn vị cơ bản

**4px**, nhưng nhịp thực tế chạy theo **8px**. Các giá trị lẻ 4px (gap `4px`, `12px`)
chỉ xuất hiện ở chi tiết nhỏ (icon gap, dot gap).

Thang dùng thật: `4 · 8 · 10 · 12 · 16 · 24 · 32 · 40 · 48 · 56 · 72 · 80 · 104`

`10px` (`gap-2.5`) xuất hiện nhiều — di sản từ Framer, dùng cho gap của wrapper.

### 3.2 Padding section (`pricing-section.tsx:228-231`, lặp ở mọi section)

| Breakpoint | Padding ngang | Padding dọc | Gap trong |
|---|---|---|---|
| Desktop (≥1200px) | `64px` (một số section `72px`) | `80px` | `72px` |
| Tablet (810–1199px) | `24px` | `72px` | `40–48px` |
| Mobile (<810px) | `0` (outer wrapper cầm `12px`) | `48px top / 64px bottom` | `40px` |

Wrapper ngoài cùng của section: `padding: 0 8px` desktop, `0 12px` mobile.
Max-width container: **1560px**, luôn `mx-auto`.

### 3.3 Padding card

| Loại card | Desktop | Mobile |
|---|---|---|
| Pricing card | `40px` đều | `32px` |
| CTA panel (dark) | `px 64 / pt 80 / pb 32` | `px 24 / pt 40 / pb 24` |
| Media card (blog, works, testimonial) | `4px` viền ngoài + `20px` nội dung | như trên |
| Mobile nav panel | `24px` | — |

**Pattern quan trọng:** card chứa ảnh dùng "khung tranh" — bọc trắng `padding: 4px`,
ảnh bên trong bo `20px`, khung ngoài bo `24px`. (`works-section.tsx:161-165`,
`blog-section.tsx:65,97`, `testimonials-section.tsx:118-120`)

### 3.4 Padding nút / pill

| Thành phần | Padding |
|---|---|
| Button default | `10px 20px` (`py-2.5 px-5`) |
| Button large | `14px 20px` (`py-3.5 px-5`) |
| Pill / tag / eyebrow | `6px 12px` (`py-1.5 px-3`) |

### 3.5 Gap dọc

`gap-4` (16px) trong nhóm text · `gap-6` (24px) giữa các khối trong card ·
`gap-8` (32px) giữa các phần lớn của card · `gap-10` (40px) giữa card trong grid.

---

## 4. Bo góc & Đổ bóng

### 4.1 Border-radius

| Token / giá trị | Dùng cho |
|---|---|
| `999px` / `100px` (`--radius-pill`) | Nút, pill, tag, dot, icon tròn |
| `48px` | Đáy card pricing (bo bất đối xứng) |
| `40px` (`--radius-shell`) | Vỏ hero desktop |
| `32px` | Panel CTA, khung video reel |
| `24px` (`--radius-card`, `--radius`) | **Radius mặc định** — card, panel, mobile menu |
| `20px` | Ảnh bên trong card, card mobile |

**Chi tiết đặc trưng:** card pricing bo **không đều** — `rounded-t-24 rounded-b-48`
(mobile: `t-20 b-32`). Trên nặng dưới nhẹ → tạo cảm giác "giọt nước". Đây là
signature move của hệ này (`pricing-section.tsx:130`).

### 4.2 Box-shadow

**Toàn bộ site chỉ có ĐÚNG MỘT box-shadow**, và nó nằm trên nút
(`site-button.tsx:49`):

```css
box-shadow:
  0 1px   1px  0     rgba(0,0,0,0.12),
  0 1.5px 3px  0     rgba(0,0,0,0.20),
  0 4px   8px  0     rgba(0,0,0,0.20),
  0 12px  24px -6px  rgba(0,0,0,0.30);
```

4 lớp chồng, spread âm ở lớp ngoài cùng. Rất nặng, cố tình — để **nút là vật thể
duy nhất nổi lên khỏi mặt phẳng**.

**Card KHÔNG có shadow.** Card tách khỏi nền bằng độ tương phản màu
(`#ffffff` trên `#f9f8f6`), không bằng bóng. Hero cũng không dùng shadow — nó
đặt một ảnh blur phía sau với `mix-blend-mode: darken` (`hero-section.tsx:108`).

Nếu cần thang shadow cho AskBounty, chỉ nên có 2 cấp và **giữ nguyên nguyên tắc
"chỉ nút mới nổi"**:

- `shadow-button`: chuỗi 4 lớp ở trên
- `shadow-overlay`: `0 12px 32px -8px rgba(0,0,0,0.18)` cho dropdown / modal
  (**đề xuất**, không có trong source)

---

## 5. Component

### 5.1 Button (`site-button.tsx`)

Chỉ có **1 button** cho cả site, 2 variant màu, 2 size.

- **Hình dáng:** pill hoàn toàn (`radius 100px`), `overflow: clip`, width = `min-content`
  (hoặc `w-full` khi `fill`)
- **Variant `black`:** nền `#141414`, chữ `#f9f8f6`
- **Variant `white`:** nền `#ffffff`, chữ `#141414`
- **Không có viền.** Phân biệt hoàn toàn bằng nền + shadow
- **Chữ:** `t-body-14-medium` (14/20, weight 500)
- **Padding:** `10px 20px` default, `14px 20px` large
- **Hover:** label **trượt lên thay thế chính nó**. Bên trong có 2 bản label giống
  hệt xếp dọc, cách nhau `gap 20px` (large: `24px`), viewport cao `20px`; hover thì
  dịch stack lên `-40px` (large `-44px`). Transition `300ms cubic-bezier(0.44,0,0.56,1)`
- **Không có** hover đổi màu, không có scale, không có active/disabled state riêng

### 5.2 Pill / Tag / Eyebrow (`clients-section.tsx:22-34`)

Xuất hiện ở đầu MỌI section:

- `inline-flex`, `gap 8px`, `padding 6px 12px`, `radius 999px`
- Nền `#ffffff` (biến thể tag: `rgba(0,0,0,0.06)` — `blog-section.tsx:89`)
- Bên trong: **dot đỏ 8×8 bo tròn** + chữ `t-label` (mono, uppercase, 12px) màu ink
- Dot đỏ này là nơi màu accent xuất hiện — gần như là chỗ duy nhất

### 5.3 Card

**Card nội dung (pricing):**
- Nền `#ffffff` (hoặc `#141414` cho card "highlight")
- `radius t-24 b-48`, `padding 40px`, `gap 32px`, không viền, không shadow
- Card dark đảo màu chữ: title → cream, body → `rgba(255,255,255,0.64)`
- Divider bên trong: **đường kẻ chấm** (dotted rule) 1px, không phải solid
- CTA `fill` pinned đáy bằng `mt-auto` để card cùng hàng bằng nhau

**Card có ảnh (blog / works / testimonial):**
- Khung trắng ngoài `padding 4px`, `radius 24px`
- Ảnh trong `radius 20px`, `overflow: hidden`
- Hover: ảnh `scale(1.04)`, `600ms cubic-bezier(0.44,0,0.56,1)`. Card đứng yên

### 5.4 Input

**KHÔNG có input trong source** — site không có form nào.
Token đã có sẵn nên suy ra được (đây là **đề xuất**, không phải trích):

- Nền `#ffffff`, viền `1px solid var(--input)` = `rgb(0 0 0 / 0.08)`
- `radius 999px` nếu là field đơn dòng (khớp ngôn ngữ pill), `24px` nếu textarea
- Padding `10px 20px`, chữ `t-body-14`, placeholder màu `--color-faint` `#a4a4a4`
- Focus: viền → `rgb(0 0 0 / 0.1)` + `ring 3px rgb(0 0 0 / 0.1)` (theo `--ring`)
- Error: viền `#ff0000`, ring `rgba(255,0,0,0.2)`

### 5.5 Accordion (`faq-section.tsx`)

- Item cách nhau `24px`, phân tách bằng `border-bottom 1px solid rgb(0 0 0/.08)`
- Cấu trúc hàng: số thứ tự (`t-display-32`, màu faint, cột rộng 24px) · gap 12px ·
  câu hỏi (`t-body-16-medium`) · nút tròn 36px nền trắng chứa chevron
- Mở: chevron xoay `180deg` `300ms`; panel animate bằng
  `grid-template-rows: 0fr → 1fr`, `400ms`
- Câu trả lời thụt trái `36px` (= 24px cột số + 12px gap), màu `--muted`

### 5.6 Navigation (`navbar.tsx`)

- `fixed`, cao **96px**, nền **trong suốt hoàn toàn**, không backdrop-blur,
  **không đổi trạng thái khi scroll**
- Link: `t-body-14-medium`, hover → `opacity 0.6`, `300ms`
- Trang hiện tại: **dot đỏ 4×4** bên phải label
- Breakpoint mobile: `810px`. Panel mobile: `radius 24px`, viền `line-2`, nền cream, `padding 24px`

### 5.7 Motion (`globals.css:283-308`, `use-reveal.ts`)

Easing chuẩn của toàn hệ: **`cubic-bezier(0.44, 0, 0.56, 1)`** — dùng ở mọi nơi.

| Loại | Thời lượng |
|---|---|
| Reveal khi scroll vào | `800ms`, `translateY(24px) → 0` + `opacity 0 → 1` |
| Reveal blur (logo, poster) | `800ms`, `blur(10px) → 0` |
| Hover (opacity, transform) | `300ms` |
| Hover scale ảnh | `600ms` |
| Accordion | `400ms` |
| Stagger card trong hàng | `120ms`/card |
| Stagger ký tự heading hero | `20ms`/ký tự |

IntersectionObserver: `threshold 0.1`, `rootMargin "0px 0px -10% 0px"`, chạy 1 lần.
Có `@media (prefers-reduced-motion: reduce)` tắt sạch reveal + marquee.

### 5.8 Chi tiết bề mặt

Cả trang phủ **film grain**: ảnh noise lặp tile `50px × 50px`, `position: absolute`,
`inset-0`, `pointer-events: none` (`globals.css:266-270`). Đây là thứ khiến nền
cream trông "có chất giấy" chứ không phẳng lì.

`::selection` = `rgb(0 0 0 / 0.08)` — không dùng màu xanh mặc định.

---

## 6. Vibe

> **Studio sáng tạo cao cấp: nền giấy ngà + serif variable cổ điển, gần như đơn sắc,
> một chấm đỏ duy nhất làm điểm nhấn — tối giản nhưng ấm và thủ công, không phải
> kiểu tech xanh-tím lạnh.**

Ba thứ tạo nên chất này, xếp theo mức độ quan trọng:

1. **Serif Fraunces với `WONK 1` + letter-spacing âm rất mạnh (-4%)** — heading
   sang, hơi lệch chuẩn, không giống bất kỳ dashboard SaaS nào
2. **Kỷ luật màu tuyệt đối** — cream / ink / 2 cấp xám / đỏ. Hết. Không gradient
   màu, không glassmorphism, không nhiều màu
3. **Chỉ nút mới có bóng** — mọi thứ khác phẳng. Điều này khiến CTA thành vật thể
   nổi bật duy nhất trên trang

---

## 7. Ghi chú khi áp cho AskBounty

Chưa áp gì cả — dưới đây là những điểm cần quyết trước:

- **Thiếu màu trạng thái.** AskBounty có paid / pending / failed / expired.
  Hệ gốc chỉ có đỏ. Cần thêm success + warning (mục 1.3 có đề xuất).
- **Thiếu input.** Site gốc không có form; AskBounty thì có (đặt câu hỏi, nhập
  số tiền). Mục 5.4 là suy ra từ token, cần user duyệt.
- **Heading 56–72px** hợp landing page. Trang chi tiết câu hỏi / danh sách của
  AskBounty có lẽ nên trần ở `t-display-40` hoặc `t-display-32`.
- **Fraunces variable axes** yêu cầu load font variable đầy đủ — nặng hơn font
  tĩnh. Cần cân nhắc với ngân sách performance.
- **Film grain overlay** đẹp nhưng là 1 ảnh phủ toàn trang; cân nhắc bỏ nếu ưu tiên
  tốc độ tải.

## Câu hỏi chưa giải quyết

1. AskBounty có cần dark mode không? Hệ gốc **không có** dark mode — chỉ có card
   dark lẻ tẻ trên nền sáng. Nếu cần dark mode thì phải tự dựng thang màu tối.
2. Có giữ đỏ `#ff0000` làm accent không, hay đổi sang màu khác? Đỏ nguyên chất
   dễ đụng ngữ nghĩa "lỗi/nguy hiểm" trong app có tiền.
3. Có mua/dùng Fraunces + Geist Mono không, hay thay bằng cặp font khác? Thay font
   sẽ mất phần lớn "vibe" mô tả ở mục 6.
