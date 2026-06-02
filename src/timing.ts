// PARIS-standard Morse timing. Everything derives from the dit duration.

/** Dit duration in milliseconds for a given words-per-minute. */
export function ditMs(wpm: number): number {
  return 1200 / wpm;
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
