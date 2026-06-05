# Morse Trainer

A browser-based Morse trainer. Two modes, selected in the settings panel:

- **Learn letters** (default): plays a random character; the user types it to
  answer (correct → splash on the key + advance; wrong → error buzz). `Space`
  replays, `/` shows the code and a second `/` reveals the key on the cheatsheet
  (clicking the `?` also reveals). Playback uses the Speed setting (default
  10 wpm).
- **Keying**: iambic paddle (Curtis Mode A/B) or straight key → live decode.

## Build & run

Ships as a single self-contained `docs/index.html` for GitHub Pages.

- `just build` — runs `build.ts`, which bundles via `Bun.build` and inlines all
  JS/CSS into one `docs/index.html`. **Rebuild after any `src/` change** and
  commit `docs/` (GitHub Pages serves it from `main` / `docs`).
- `just serve` — build, then `python3 -m http.server -d docs 3000`.
- `just test` — `bun test`. Typecheck with `bunx tsc --noEmit`.
- `index.ts` is an optional `bun --hot` dev server (HMR); not the primary path.

## Layout

- `src/main.ts` — wires DOM, settings, audio, keyers, decoder and both modes.
- `src/morse.ts` — EN/RU tables, `tableFor`, encode/lookup.
- `src/keyer-iambic.ts` / `keyer-straight.ts` — keyers. The iambic keyer samples
  paddle state at element boundaries (no press buffering); Mode A/B differ only
  on squeeze release.
- `src/decoder.ts` — silence-timed decode. `src/timing.ts` — PARIS timing from
  wpm.
- `src/cheatsheet.ts` — QWERTY/ЙЦУКЕН keyboard; `. , ?` shown to its right;
  patterns hidden in learn mode and revealed per key.
- `src/player.ts` — plays a pattern as audio. `src/audio.ts` — Web Audio
  sidetone + `error()` buzz. `src/settings.ts` — persisted settings
  (localStorage).
- Tests: `*.test.ts` at the repo root.

## Conventions

- After UI changes, verify the **built** page by driving it headless (Chrome
  `--remote-debugging-port` + CDP `Runtime.evaluate`), not just screenshots.
- Editing tool note: a couple of source lines contain non-breaking spaces; match
  on neighbouring lines if an exact-string edit fails.

## Bun

Default to Bun over Node.

- `bun <file>` / `bun test` / `bun install` / `bunx <pkg>`; `Bun.serve()` (not
  express), `bun:sqlite`, built-in `WebSocket`, `Bun.file`, `Bun.$`.
- Bun auto-loads `.env` (no dotenv). HTML imports bundle TS/JSX/CSS directly.
