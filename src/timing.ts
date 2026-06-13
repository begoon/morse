// PARIS-standard Morse timing. Everything derives from the dit duration.

/** Dit duration in milliseconds for a given words-per-minute. */
export function ditMs(wpm: number): number {
  return 1200 / wpm;
}

export type Timing = { ditMs: number; letterGapMs: number; wordGapMs: number };

/**
 * Farnsworth playback timing: characters are sent at `charWpm` (so you learn
 * each character's sound, not counted elements) while the inter-letter and
 * inter-word gaps are stretched so the overall rate is `effWpm`.
 *
 * Derivation (ARRL Farnsworth): a PARIS word is 50 dit-units — 31 inside the
 * characters (elements + intra-element gaps) and 19 of spacing (four 3-unit
 * letter gaps + one 7-unit word gap). Characters play at `charWpm`; the
 * remaining time needed to make the word last `60000/effWpm` ms is spread over
 * those 19 spacing units. When `charWpm === effWpm` this is standard PARIS.
 */
export function farnsworth(charWpm: number, effWpm: number): Timing {
  const c = Math.max(charWpm, effWpm); // character speed can't be slower than effective
  const dit = 1200 / c;
  const unit =
    effWpm >= c ? dit : Math.max(dit, (60000 / effWpm - 31 * dit) / 19);
  return { ditMs: dit, letterGapMs: 3 * unit, wordGapMs: 7 * unit };
}

/** Element/gap durations in dit units. */
export const UNITS = {
  dit: 1,
  dah: 3,
  intraGap: 1, // between elements of one letter
  letterGap: 3, // between letters
  wordGap: 7, // between words
} as const;

/**
 * Thresholds (in ms) for classifying straight-key press and gap durations at a
 * given WPM. Splits are placed at the geometric-ish midpoints with tolerance:
 *  - press: dit if shorter than 2 dits, else dah
 *  - gap:   intra (<2 dits), letter (2-5 dits), word (>5 dits)
 */
export function thresholds(wpm: number) {
  const d = ditMs(wpm);
  return {
    ditMs: d,
    pressDitDah: 2 * d, // press shorter than this => dit
    gapLetter: 2 * d, // gap >= this => letter boundary
    gapWord: 5 * d, // gap >= this => word boundary
  };
}
