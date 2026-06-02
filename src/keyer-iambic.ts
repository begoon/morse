// Iambic paddle keyer (Curtis Mode B).
//
// Two paddles: dit and dah. The keyer emits perfectly-timed elements at the
// configured WPM:
//   - hold dit  -> repeating dits
//   - hold dah  -> repeating dahs
//   - squeeze both -> alternating di-dah-di-dah, with the Mode-B "extra"
//     trailing element after both are released.
//
// Tapping the opposite paddle during an element latches that paddle into a
// one-shot memory, so it is sent next (insertion / alternation).

export type KeyerHooks = {
  /** Current dit duration in ms (re-read each element so WPM changes apply). */
  ditMs: () => number;
  toneOn: () => void;
  toneOff: () => void;
  /** A tone is starting (silence interrupted) — fed to the decoder. */
  onElementStart?: () => void;
  /** A completed element, fed to the decoder. */
  onElement: (type: "." | "-") => void;
  /** Visual active-state for a paddle/element, or null when idle. */
  setActive?: (el: "." | "-" | null) => void;
};

export class IambicKeyer {
  private hooks: KeyerHooks;
  private paddle = { dit: false, dah: false };
  private ditMemory = false;
  private dahMemory = false;
  private last: "." | "-" | null = null;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(hooks: KeyerHooks) {
    this.hooks = hooks;
  }

  setDit(down: boolean) {
    this.paddle.dit = down;
    if (down) {
      this.ditMemory = true;
      this.start();
    }
  }

  setDah(down: boolean) {
    this.paddle.dah = down;
    if (down) {
      this.dahMemory = true;
      this.start();
    }
  }

  /** Release everything and silence (e.g. when switching key types). */
  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.paddle.dit = this.paddle.dah = false;
    this.ditMemory = this.dahMemory = false;
    this.last = null;
    this.hooks.toneOff();
    this.hooks.setActive?.(null);
  }

  private start() {
    if (!this.running) {
      this.running = true;
      this.nextElement();
    }
  }

  private nextElement() {
    const wantDit = this.paddle.dit || this.ditMemory;
    const wantDah = this.paddle.dah || this.dahMemory;
    // Memories are sampled at the decision point.
    this.ditMemory = false;
    this.dahMemory = false;

    let el: "." | "-";
    if (wantDit && wantDah) {
      el = this.last === "." ? "-" : ".";
    } else if (wantDit) {
      el = ".";
    } else if (wantDah) {
      el = "-";
    } else {
      this.running = false;
      this.last = null;
      this.hooks.setActive?.(null);
      return;
    }

    this.last = el;
    this.sendElement(el);
  }

  private sendElement(el: "." | "-") {
    const dit = this.hooks.ditMs();
    const dur = (el === "." ? 1 : 3) * dit;
    this.hooks.onElementStart?.();
    this.hooks.toneOn();
    this.hooks.setActive?.(el);

    this.timer = setTimeout(() => {
      this.hooks.toneOff();
      this.hooks.setActive?.(null);
      this.hooks.onElement(el);

      // Mode B: latch the opposite paddle if it is held during this element,
      // so it (or the squeeze alternation) is sent next.
      if (el === "." && this.paddle.dah) this.dahMemory = true;
      if (el === "-" && this.paddle.dit) this.ditMemory = true;

      // Inter-element gap (1 dit), then decide the next element.
      this.timer = setTimeout(() => this.nextElement(), dit);
    }, dur);
  }
}
