# Trợ Lý — Design System

**Trợ Lý** ("Assistant" in Vietnamese) is a native **Android AI chat app** — Kotlin + Jetpack Compose, Material 3. It is a personal, self-hosted ChatGPT-style client: it talks to the owner's own LLM server (Ollama / OpenAI-compatible) over the home network, reached from anywhere through Tailscale and a small gateway called **9Router**. The user can swap models mid-conversation — local "máy nhà" (home-server) models like **Qwen3 35B/8B** and cloud models like **Claude Sonnet** and **DeepSeek V3**.

The whole product is in **Vietnamese**, warm and personal in tone, built around one signature color: **ngọc bích** (jade green, `#0E7A5F`) on a pale ivory-green canvas, set in **Be Vietnam Pro**.

This design system captures that look and feel as reusable CSS tokens, React components, foundation specimens, and a click-through recreation of the app.

---

## Sources

This system was reverse-engineered from a single attached codebase (read-only, mounted locally):

- **`AI agent/TroLyAI/`** — the native Android app. Kotlin 2.1, Jetpack Compose, Material 3, min SDK 26 / target 35.
  - `app/src/main/java/com/trolyai/app/ui/theme/` — `Color.kt`, `Type.kt`, `Theme.kt` → the source of truth for all tokens.
  - `app/src/main/java/com/trolyai/app/ui/components/Components.kt` → ModelChip, Toggle, Composer, TypingIndicator, ModelBottomSheet, Badge, DayDivider, SuggestRow.
  - `app/src/main/java/com/trolyai/app/ui/screens/` → 5 screens: Welcome, Chat, History, Settings, Error.
  - `app/src/main/java/com/trolyai/app/ChatViewModel.kt` + `data/Models.kt` → state, demo data, model list, copy.
  - `app/src/main/res/font/` → the bundled **Be Vietnam Pro** TTFs (400–800), copied into `assets/fonts/`.
- The app's own README states it was itself adapted 1:1 from an earlier HTML design file (`ai-chat-app-uxui_1.html`), which was **not** included in the attachment.

No Figma file or marketing site was provided. There is one product surface: **the Android app**.

---

## CONTENT FUNDAMENTALS

The product speaks **Vietnamese**, in a tone that is **friendly, personal, and slightly informal** — like a capable assistant who knows you.

- **Person & address.** The app addresses the user as **"anh"** (familiar second person, "you" — here a male user), and the assistant refers to itself as **"trợ lý"** (the assistant), never "I/AI" in a cold sense. Example greeting: *"Chào buổi sáng, anh muốn **hỏi gì** hôm nay?"* ("Good morning, what would you like to ask today?"). The questioning verb is colored jade for emphasis.
- **Greetings are time-aware** — "Chào buổi sáng / chiều / tối," (morning / afternoon / evening) chosen by the clock.
- **Casing.** Sentence case everywhere for body and titles. **UPPERCASE** only for small eyebrow/section labels (e.g. `MÁY CHỦ (BASE URL)`, `ĐÃ GHIM`, `HÔM NAY`) with `0.8px` letter-spacing.
- **Verbs are short and direct** on actions: *Gửi* (Send), *Thử lại* (Retry), *Sao chép* (Copy), *Tạo lại* (Regenerate), *Lưu* (Save), *Hủy* (Cancel), *Xóa* (Delete), *Chat mới* (New chat).
- **Microcopy is reassuring and concrete.** Destructive actions always spell out consequences: *"sẽ bị xóa vĩnh viễn. Không thể hoàn tác."* ("will be permanently deleted. Cannot be undone."). Errors are practical and tell you what to check: *"Kiểm tra server Ollama còn chạy và điện thoại cùng mạng Wi-Fi."*
- **Status copy is human, not technical** — "Không kết nối được máy chủ nhà" ("Couldn't reach the home server"), "Đã thử lại 2 lần · lần cuối 9:42".
- **Placeholders invite action** — *"Nhắn cho trợ lý…"* ("Message the assistant…"), *"Tìm trong hội thoại…"* ("Search conversations…").
- **Emoji are part of the voice** (see Iconography) — a leaf 🌿 stands in for the brand, suggestion cards open with 📝💻📄, models carry 🏠/☁️, a sprinkle of 🌿 ends friendly replies. Used warmly but sparingly — one per item, never decorative clutter.
- **Vibe:** calm, competent, cozy. A self-hosted tool made by an enthusiast for daily use — privacy-minded ("Nhanh, riêng tư"), proud of running on "máy nhà" (the home machine), never corporate.

---

## VISUAL FOUNDATIONS

A single accent color doing a lot of work on a quiet, warm-neutral canvas. The mood is **soft, rounded, and airy** — Material 3 bones with a custom jade identity.

- **Color.** One hero hue: **jade `#0E7A5F`**. It is the user's chat bubble, every primary button, the send FAB, focus rings, links/accents, the active toggle, the logo tile, and the colored word in the greeting. Everything else is restrained: near-black-green ink `#16201C` for text, muted `#5A6B64` for secondary, hairline `#E4EAE6` borders. **`--jade-soft` `#E3F2EC`** is the workhorse tint — icon tiles, suggestion chips, AI-accent fills, badges. Amber `#E8A33D` is a rare accent (pin star ★, "local model" badge). Semantic states reuse warm tones: a sandy `--warn-bg` for offline/local, a dusty rose `--failed-bg` for failed sends, terracotta `--danger #C94F3D` for destructive.
- **Backgrounds.** Flat, solid colors only — **no gradients, no images, no patterns, no textures**. The app canvas is `--bg #F7F9F7` (a barely-green off-white); cards and bars are pure white. Depth comes from the bg/surface contrast plus hairline borders, not from fills.
- **Type.** Be Vietnam Pro exclusively. Titles and the hero greeting are **ExtraBold (800)**; list/bubble emphasis is SemiBold/Bold; body is Regular. Generous line-height on body (≈1.5). No serif, no display face, no mono except for `inline code` inside bubbles (rendered on a `--jade-soft` background in `--jade-deep`).
- **Shape language: very rounded.** Pills (`99px`) for chips, the model chip, toggles, search, and pill buttons. Cards/banners/settings groups at `16px`. Icon tiles at `12–14px`. The logo tile at `18px`. **Chat bubbles are `22px` with one `6px` "tail" corner** — bottom-right for the user, top-left for the AI — the single most recognizable shape in the app. The composer and bottom sheet are `26px`.
- **Borders.** Thin and everywhere: `1px` hairline `--line` outlines white cards, AI bubbles, chips, the search field, settings groups, dividers. The composer field uses a `1.5px` border that turns jade on focus. This **outline-over-shadow** approach is core — surfaces are defined by their border, not by heavy elevation.
- **Shadows.** Used sparingly and softly. The FAB floats on a soft jade-tinted shadow (`8dp`); the toggle thumb has a tiny `2dp` drop; the bottom sheet lifts off the scrim. Cards at rest are essentially flat (border only). No hard or dark shadows.
- **Selection / radio.** The model picker's radio is a **ring that thickens** — a `2px` outline becomes a `6px` jade ring when selected (no inner dot).
- **Hover / press.** Native Android = ripple, no hover. In the web recreation: press darkens jade → `--jade-deep`; secondary/ghost surfaces tint toward `--jade-soft`; tappable rows get a faint surface wash. Keep transitions short.
- **Animation.** Minimal and functional. Toggle track+thumb slide (~180ms, Material standard easing `cubic-bezier(0.2,0,0,1)`). The **typing indicator** is three jade dots breathing in opacity (0.3↔1.0, 600ms, 200ms stagger, reverse). Bottom sheet slides up. No bounces, no parallax, no decorative motion. Respect `prefers-reduced-motion`.
- **Transparency / blur.** Almost none — this is a flat, opaque design. The only transparency is the modal scrim behind the bottom sheet/dialogs and disabled states at ~50% opacity.
- **Layout.** Mobile-first, single column. Fixed top **app bar** (circular icon button · centered **model chip** · circular icon button), a scrolling middle, and a fixed bottom **composer**. `16px` screen gutters (`28px` on the spacious welcome screen). The model chip in the center of the app bar is a signature element. The History screen floats a jade **FAB** ("✚ Chat mới") bottom-right.
- **Imagery.** There is **no photography or illustration** in the product. Identity is carried entirely by color, type, the leaf glyph, and emoji. (See Iconography.)

---

## ICONOGRAPHY

Trợ Lý has **no custom icon set and no icon font of its own.** Icons come from two places, and the distinction matters when extending the system:

1. **Emoji as iconography (the dominant approach).** The app leans on system emoji for almost all "icons," rendered as text inside rounded tiles:
   - **Brand glyph:** 🌿 (leaf) is the de-facto logo, shown white-on-jade in an `18px` rounded tile.
   - **Suggestion cards:** 📝 (write), 💻 (code), 📄 (summarize).
   - **Models:** 🏠 (local/home server), ☁️ (cloud); list items also use 🌐.
   - **History rows:** per-conversation emoji (📌 💬 🎬 🔧 📈) in jade-soft tiles; 📌/★ for pinned.
   - **Settings rows:** 🧠 model, 🖧 server, 🔑 API key, ⚡ stream, 🌙 dark mode, 🔤 font size, 🎙 read-aloud, 💾 backup, 🗑 delete, 🔌 connection.
   - **Status:** ⚠️ offline/failed, 🔌 disconnected, 🗂 empty state, 💭 deep-thinking, 👍 👎 feedback, 🔄/↻ retry, 📋 copy.
   - **Unicode glyphs as controls:** the app-bar buttons are literal text glyphs — ☰ (menu), ⚙ (settings), ✚ (new), ← (back), › (chevron), ▾/▴ (expand), 🔍 (search).
2. **Material Symbols (a handful, inside the composer only).** The Compose app uses `androidx.compose.material.icons` for: **Send** (paper-plane), **Mic**, **AttachFile** (paperclip), **Mood** (emoji-picker toggle), and **Psychology** (the "deep think" brain). These are the only true vector icons.

**Guidance for this system:** to keep the composer crisp at any size, the web recreation substitutes the five Material composer icons with **[Material Symbols Rounded](https://fonts.google.com/icons)** loaded from CDN (matching names: `send`, `mic`, `attach_file`, `mood`, `psychology`) — the same family the app draws from, rounded style to match the soft shape language. **⚠️ Substitution flagged:** the original ships specific Material Icons vectors; if you want pixel-exact composer icons, export them from the app and drop them into `assets/`. Everywhere else, **keep using emoji and Unicode glyphs** — they are intrinsic to the brand voice, not a placeholder. Do not introduce a third icon style (no Lucide/Heroicons/Feather) — it would read as off-brand.

---

## Index — what's in this system

**Foundations**
- `styles.css` — global entry point (link this one file). Imports everything below.
- `tokens/colors.css` — light + dark palette, base + semantic aliases.
- `tokens/typography.css` — Be Vietnam Pro scale, weights, line-heights.
- `tokens/spacing.css` — spacing, radii, hit targets, shadows, motion.
- `tokens/fonts.css` — `@font-face` for the bundled Be Vietnam Pro TTFs.
- `guidelines/*.card.html` — foundation specimen cards (Type, Colors, Spacing, Brand).

**Components** (`components/<group>/` — React, namespace `TroLy`)
- `core/` — `Button`, `ModelChip`, `Toggle`, `Badge`, `Chip`
- `chat/` — `ChatBubble`, `TypingIndicator`, `Composer`, `DayDivider`
- `layout/` — `AppBar`, `IconButton`, `ListRow`, `Card`

**UI kit** (`ui_kits/app/`)
- `index.html` — interactive click-through of the full app (Welcome → Chat → History → Settings → Error + model sheet).
- `*.jsx` — per-screen recreations composing the components above.

**Assets** (`assets/`)
- `fonts/` — Be Vietnam Pro TTFs (400/500/600/700/800).
- `ic_launcher_foreground.xml` — the launcher leaf mark (vector source, reference only).

**Meta**
- `SKILL.md` — Agent-Skill manifest for downloading & reusing this system.
- `readme.md` — this file.
