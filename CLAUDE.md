# Morse Trainer

A browser-based Morse trainer, shipped as separate GitHub Pages routes with a
landing menu at `docs/index.html`:

- **Play** (`docs/play/`): plays a target and the user types it back (correct →
  splash on the key + advance; wrong → error buzz). `Space` replays, `/` shows
  the code and a second `/` reveals the next expected key on the cheatsheet
  (clicking the output also reveals). The Word length setting caps the target:
  1 = single characters; 2+ = an English word of 2..N letters drawn from
  `src/play/words.json` (≈1/3 of the time from CW jargon/Q-codes — see
  `CW_CHANCE` in `src/play/words.ts`). Russian always plays single characters.
- **Keying** (`docs/keying/`): iambic paddle (Curtis Mode A/B) or straight key
  → live decode.
- **Test** (`docs/test/`): Foundation mock exam runner (see below).
- **Settings** (`docs/settings/`): all settings (alphabet, word length, wpm,
  gap tolerance, key type, iambic mode, volume, tone), persisted under the
  `morse-trainer-settings` localStorage key shared by every page.

## Build & run

Each route is a single self-contained HTML file for GitHub Pages.

- `just build` — runs `build.ts`, which bundles each entry (`index.html`,
  `src/play/`, `src/keying/`, `src/settings-page/`, `src/test/`) via
  `Bun.build` and inlines all JS/CSS. **Rebuild after any `src/` change** and
  commit `docs/` (GitHub Pages serves it from `main` / `docs`).
- `just serve` — build, then `python3 -m http.server -d docs 3000`.
- `just test` — `bun test`. Typecheck with `bunx tsc --noEmit`.
- `index.ts` is an optional `bun --hot` dev server (HMR); not the primary path.

## Layout

- `src/play/main.ts` / `src/keying/main.ts` / `src/settings-page/main.ts` —
  per-page wiring; each page's `index.html` sits beside its `main.ts`.
- `src/play/words.ts` — target picking (`pickTarget`, rng-injectable);
  `words.json` — committed word bank (`{common, cw}`, uppercase), regenerated
  by `tools/fetch-words.ts` (fetches the google-10000-english list; the CW
  jargon list is curated in the tool).
- `src/morse.ts` — EN/RU tables, `tableFor`, encode/lookup, `encodeWord` (joins
  letter patterns with `" "` = letter gap).
- `src/keyer-iambic.ts` / `keyer-straight.ts` — keyers. The iambic keyer samples
  paddle state at element boundaries (no press buffering); Mode A/B differ only
  on squeeze release.
- `src/decoder.ts` — silence-timed decode. `src/timing.ts` — PARIS timing from
  wpm.
- `src/cheatsheet.ts` — QWERTY/ЙЦУКЕН keyboard; `. , ?` shown to its right;
  patterns hidden in play mode and revealed per key.
- `src/player.ts` — plays a pattern as audio; `" "` in the pattern inserts a
  3-dit letter gap. `src/audio.ts` — Web Audio sidetone + `error()` buzz.
  `src/settings.ts` — persisted settings (localStorage).
- `src/styles.css` — shared styles incl. the `.topnav` nav header used on every
  page (duplicated in `src/test/styles.css`).
- Tests: `*.test.ts` at the repo root.

## Exam runner (`src/test/` → `docs/test/`)

Runs the three RSGB Foundation mock papers from `foundation/*.pdf` (26
single-choice questions each): pick Mock 1/2/3 or Combined (26 sampled from
all 78, or all 78); settings for shuffling questions/answers and immediate vs
at-the-end feedback (persisted under `morse-exam-settings`). Pass mark 19/26,
scaled by percentage for the 78-question run.

- `src/test/quiz.ts` — pure logic (build run, shuffle, grade); `main.ts` — UI;
  `questions.json` — the committed question bank.
- `tools/extract-questions.ts` regenerates `questions.json` from the PDFs
  (macOS-only: uses PDFKit via `osascript`). Only re-run if the PDFs change.
- Question diagrams live in `foundation/mock_<paper>_q<n>.png`, mapped in
  `src/test/images.ts` and inlined as data URIs by the `png-dataurl` plugin in
  `build.ts` (shown on the quiz screen and in the results review).

## Conventions

- After UI changes, verify the **built** pages by driving them headless (Chrome
  `--remote-debugging-port` + CDP `Runtime.evaluate`), not just screenshots.
- Editing tool note: a couple of source lines contain non-breaking spaces; match
  on neighbouring lines if an exact-string edit fails.

## Bun

Default to Bun over Node.

- `bun <file>` / `bun test` / `bun install` / `bunx <pkg>`; `Bun.serve()` (not
  express), `bun:sqlite`, built-in `WebSocket`, `Bun.file`, `Bun.$`.
- Bun auto-loads `.env` (no dotenv). HTML imports bundle TS/JSX/CSS directly.
