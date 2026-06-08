# Morse Trainer

A browser-based Morse trainer, shipped as separate GitHub Pages routes with a
landing menu. Listen and type characters and words back, key Morse with an
iambic paddle or straight key and watch the live decode, or sit one of ten
RSGB Foundation mock exams.

## Build & run

Each route is a single self-contained HTML file (all JS/CSS inlined) under
`docs/`, served by GitHub Pages from `main` / `docs`.

```bash
just install        # bun install
just build          # bundle every route into docs/<route>/index.html
just serve          # build, then python3 -m http.server -d docs 3000
just test           # bun test  (typecheck with: bunx tsc --noEmit)
```

**Rebuild after any `src/` change and commit `docs/`** — that's what GitHub
Pages serves. You can also open `docs/index.html` with the VS Code **Live
Server** extension after building (a `.vscode/settings.json` scopes Live Server
to `docs/` so it only reloads on rebuilds).

`index.ts` is an optional `bun --hot index.ts` dev server (HMR); not the
primary path.

## Routes

The landing menu (`docs/index.html`) links to four pages, all sharing one set
of settings:

- **Play** (`docs/play/`) — a target is played as Morse and you type it back
  (correct → the key splashes and it advances; wrong → an error buzz). `Space`
  replays, `/` shows the code, a second `/` (or clicking the output) reveals
  the next expected key on the cheatsheet. The **Word length** setting caps the
  target: `1` = single characters; `2+` = an English word of up to that many
  letters (≈⅓ of the time from CW jargon / Q-codes). A running line shows the
  letters you've guessed. Russian always plays single characters.
- **Keying** (`docs/keying/`) — key Morse yourself with an iambic paddle
  (Curtis Mode A/B) or a straight key; it decodes to text live. `Space` clears
  the output (unless it's bound as the straight key).
- **Test** (`docs/test/`) — Foundation mock exam runner (see below).
- **Settings** (`docs/settings/`) — alphabet, word length, speed, gap
  tolerance, key type, keyer mode, volume, and tone, persisted in
  `localStorage` and shared by every page.

## Keying

- **Iambic paddle** (default): `,` = dit, `.` = dah. Hold for repeats, squeeze
  both for di-dah alternation.
- **Straight key**: hold `Space` — short press = dit, long press = dah.

The iambic keyer supports **Curtis Mode A** (default) and **Mode B**,
switchable in Settings. They differ only when you release both paddles
mid-element while squeezing:

- **Mode A** finishes the current element and stops.
- **Mode B** finishes the current element, then sends one extra opposite
  element.

## Exam runner

Nine Foundation mock papers (26 single-choice questions each), tagged by
source:

- **rsgb** — Mock 1–3, extracted from the RSGB mock PDFs.
- **hamtrain** — Mock 1–7 (1–6 with a written explanation per question).

Pick a single paper, **Combined** (a 26-question exam with one question per
topic — the papers are topic-ordered, so each of the 26 positions is drawn from
a random paper), or **Everything** (all 260 questions). Options for shuffling
questions and answers, and showing the correct answer immediately or only at
the end. Pass mark is 19/26, scaled by percentage
for longer runs. Some questions include a diagram. The hamtrain answer
explanations are shown after you answer (immediate mode) and in the results
review.

## Features

- Listening trainer (characters and words) and a free keying mode
- Switchable iambic (Curtis Mode A/B) paddle keyer and straight-key keyer
- Web Audio sidetone with adjustable tone (400–1000 Hz) and volume
- Live decode to text
- English and Russian Morse tables
- Adjustable speed (PARIS standard: `dit = 1200 / wpm` ms)
- QWERTY / ЙЦУКЕН cheatsheet keyboard
- Nine RSGB Foundation mock exams with images and explanations
- All settings persisted in `localStorage`

## Layout

```
index.html                landing menu
src/play/                  Play route (main.ts + index.html + word bank)
src/keying/                Keying route
src/settings-page/         Settings route
src/test/                  Exam runner (quiz.ts logic, question banks, images)
src/morse.ts               EN/RU tables + lookup/encode
src/timing.ts              PARIS timing + straight-key thresholds
src/audio.ts               Web Audio sidetone + error buzz
src/player.ts              plays a pattern as audio
src/keyer-iambic.ts        iambic Curtis Mode A/B keyer
src/keyer-straight.ts      straight-key keyer + press classifier
src/decoder.ts             element stream -> decoded text
src/cheatsheet.ts          QWERTY / ЙЦУКЕН keyboard
src/settings.ts            localStorage settings
src/styles.css             shared styles
build.ts                   bundles each route into self-contained docs/ HTML
tools/                     one-off word-bank and question-bank extractors
foundation/                mock-exam source material (PDFs / markdown / images)
*.test.ts                  unit tests
```
