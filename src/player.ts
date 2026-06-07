// Plays a dit/dah pattern through the sidetone as timed tones, so the play
// mode can sound out a character or a word. A " " in the pattern separates
// letters (standard three-dit letter gap). Returns a handle to cancel playback.

import type { Sidetone } from "./audio";

export type PlayHandle = { cancel: () => void };

export function playPattern(
  sidetone: Sidetone,
  pattern: string,
  ditMs: number,
): PlayHandle {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  for (const sym of pattern) {
    if (sym === " ") {
      t += 2 * ditMs; // 1-dit intra gap already added -> 3-dit letter gap
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
