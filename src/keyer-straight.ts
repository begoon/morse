// Straight-key keyer. The user holds one key; press duration determines the
// element. Short press => dit, long press => dah, split at the WPM-derived
// threshold. Gaps between elements/letters/words are timed by the decoder.

import { thresholds } from "./timing";

/** Classify a key-press duration as a dit or dah for the given WPM. */
export function classifyPress(durationMs: number, wpm: number): "." | "-" {
  return durationMs < thresholds(wpm).pressDitDah ? "." : "-";
}

export type StraightHooks = {
  wpm: () => number;
  toneOn: () => void;
  toneOff: () => void;
  onElementStart?: () => void;
  onElement: (type: "." | "-") => void;
  setActive?: (el: "." | "-" | null) => void;
  /** Monotonic clock in ms; defaults to performance.now. */
  now?: () => number;
};

export class StraightKeyer {
  private hooks: StraightHooks;
  private now: () => number;
  private pressedAt: number | null = null;

  constructor(hooks: StraightHooks) {
    this.hooks = hooks;
    this.now = hooks.now ?? (() => performance.now());
  }

  down() {
    if (this.pressedAt !== null) return; // ignore auto-repeat
    this.pressedAt = this.now();
    this.hooks.onElementStart?.();
    this.hooks.toneOn();
    this.hooks.setActive?.(".");
  }

  up() {
    if (this.pressedAt === null) return;
    const dur = this.now() - this.pressedAt;
    this.pressedAt = null;
    this.hooks.toneOff();
    this.hooks.setActive?.(null);
    this.hooks.onElement(classifyPress(dur, this.hooks.wpm()));
  }

  stop() {
    if (this.pressedAt !== null) {
      this.pressedAt = null;
      this.hooks.toneOff();
      this.hooks.setActive?.(null);
    }
  }
}
