# Data Format

OCR-extracted UK Amateur Radio Foundation licence mock exams (6 tests, 26 multiple-choice questions each). Source page screenshots are in `originals/`; everything else is derived, machine-parseable markdown.

## Files

| File pattern | Count | Content |
|---|---|---|
| `mock<N>.md` | N = 1..6 | Questions and options for mock test N |
| `mock<N>-answers.md` | N = 1..6 | Correct answer letter + explanation for each question |
| `mock<N>-q<Q>.png` | 7 files | Image referenced by question Q of test N |
| `originals/` | 34 files | Source page screenshots (not needed for parsing) |

Every test has exactly 26 questions, numbered 1–26 with no gaps. Every question has exactly 4 options: A, B, C, D.

## `mock<N>.md` structure

```markdown
# MOCK TEST <N>

## Question <Q>

<question text, one or more paragraphs>

![<alt text>](mock<N>-q<Q>.png)      <- present only if the question has an image

- A. <option text>
- B. <option text>
- C. <option text>
- D. <option text>
```

Parsing rules:

- Each question starts at a `## Question <Q>` heading (level-2, exact prefix `Question `).
- Everything between the heading and the option list is the question stem. It may contain a markdown image line (`![...](...)`) — the image belongs to that question.
- Options are a flat bullet list, always 4 items, always in the form `- <LETTER>. <text>`. Letters are uppercase A–D, followed by a period and a space. Option text never spans multiple bullets but may contain commas, parentheses, units, etc.
- Emphasis markers may appear inside stems/options: `**not**`, `**TRUE**`, `**most**` (bold replaces underline from the source document). Strip `*` characters if you need plain text.
- `[sic]` marks a typo preserved from the source (e.g. mock5 Q6 option A "high satts [sic] EIRP").
- Units/frequencies are written exactly as in the source: `145.500MHz`, `10.1MHz`, `909kHz`, `5mΩ` (Unicode Ω), `25 Watts`.

## `mock<N>-answers.md` structure

```markdown
# MOCK TEST <N> — ANSWERS

## Question <Q> — <LETTER>

<explanation, one or more paragraphs>
```

Parsing rules:

- Heading format is exactly `## Question <Q> — <LETTER>` where `<LETTER>` ∈ {A, B, C, D}. The separator is an em dash `—` (U+2014) with spaces around it.
- To get the answer key programmatically, this regex works across all 6 files:
  `^## Question (\d+) — ([A-D])$`
- The explanation may contain multiple paragraphs, quotes from the Ofcom licence, and occasionally an italic aside (`*...*`) addressed to the student (e.g. mock4 Q24).
- `mock1-answers.md` Question 15 embeds the same `mock1-q15.png` image that the question uses.

## Images

| File | Test | Question | Depicts |
|---|---|---|---|
| `mock1-q15.png` | 1 | 15 | PL-259 RF connector photo/drawing |
| `mock2-q10.png` | 2 | 10 | AM-modulated waveform |
| `mock2-q14.png` | 2 | 14 | 1/4-wave ground plane vertical antenna |
| `mock3-q7.png`  | 3 | 7  | Electrical symbol for a fuse |
| `mock4-q12.png` | 4 | 12 | Receiver block diagram (boxes 1-3, antenna → speaker) |
| `mock5-q11.png` | 5 | 11 | Transmitter block diagram (boxes 1-4, mic → antenna; box 3 hangs below box 2) |
| `mock6-q7.png`  | 6 | 7  | Circuit: 9V battery, resistor R, lamp |

Image references inside the `.md` files are relative paths, so the `.md` files and `.png` files must stay in the same directory (or rewrite the paths if you move them).

## Joining questions to answers

Key on `(test number, question number)`. Question numbering is identical between `mock<N>.md` and `mock<N>-answers.md`. Example join output for a quiz app: question stem + 4 options from `mock<N>.md`, correct letter + explanation from `mock<N>-answers.md`.

## Provenance / fidelity notes

- Text was OCR'd from screenshots (Claude vision + Apple Vision framework), with answer letters cross-verified against the explanation texts. Source typos are preserved and marked `[sic]`.
- Smart quotes in the source were normalised to straight ASCII quotes in most places; the em dash only appears in answer headings and inside some explanation texts.
- The answer explanations reference an external "4-page exam booklet" (RSGB Foundation exam reference booklet) — those page/table references are part of the explanation text, not of this dataset.
