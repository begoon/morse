// Plays a dit/dah pattern through the sidetone as timed tones, so the play
// mode can sound out a character or a word. A " " in the pattern separates
// letters (the `letterGapMs` gap — wider than 3 dits under Farnsworth). Returns
// a handle to cancel playback.

import type { Sidetone } from "./audio";
import type { Timing } from "./timing";

export type PlayHandle = { cancel: () => void };

export function playPattern(
  sidetone: Sidetone,
  pattern: string,
  timing: Timing,
): PlayHandle {
  const { ditMs, letterGapMs } = timing;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  for (const sym of pattern) {
    if (sym === " ") {
      // A 1-dit intra gap was already added after the previous element; top it
      // up to the full (possibly Farnsworth-widened) inter-letter gap.
      t += letterGapMs - ditMs;
      continue;
    }
    const dur = (sym === "." ? 1 : 3) * ditMs;
    timers.push(setTimeout(() => sidetone.keyOn(), t));
    timers.push(setTimeout(() => sidetone.keyOff(), t + dur));
    t += dur + ditMs; // element followed by a one-dit intra-element gap
  }
  return {
    cancel() {
      for (const id of timers) clearTimeout(id);
      sidetone.keyOff();
    },
  };
}
