# Morse Trainer

A browser-based Morse code trainer. Key Morse with an iambic paddle or a
straight key, hear audio sidetone, and watch the decoded letters appear.

## Run

```bash
bun install
bun --hot index.ts   # http://localhost:3000
```

## Test

```bash
bun test
```

## Keys

- **Iambic paddle** (default): `,` = dit, `.` = dah. Hold for repeats, squeeze
  both for di-dah alternation (Curtis Mode B).
- **Straight key**: hold `Space` — short press = dit, long press = dah.

## Features

- True iambic (Mode B) paddle keyer and straight-key keyer
- Web Audio sidetone with adjustable tone (400–1000 Hz) and volume
- Live decode to text, showing the last 10 characters
- English and Russian Morse tables
- Adjustable speed (default 5 WPM, PARIS standard: `dit = 1200 / WPM` ms)
- SVG key schematics that animate while keying
- All settings persisted in `localStorage`

## Layout

```
index.ts              Bun.serve serving index.html (HMR)
index.html            markup + settings panel
src/morse.ts          EN/RU tables + lookup/encode
src/timing.ts         PARIS timing + straight-key thresholds
src/audio.ts          Web Audio sidetone
src/keyer-iambic.ts   iambic Mode-B keyer
src/keyer-straight.ts straight-key keyer + press classifier
src/decoder.ts        element stream -> decoded text (testable timers)
src/visuals.ts        SVG schematics
src/settings.ts       localStorage settings
src/main.ts           wires it all together
*.test.ts             unit tests (morse, decoder, keyer)
```
