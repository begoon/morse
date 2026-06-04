// Iambic paddle keyer (Curtis Mode A / Mode B, switchable).
//
// Two paddles: dit and dah. The keyer emits perfectly-timed elements at the
// configured WPM:
//   - hold dit  -> repeating dits
//   - hold dah  -> repeating dahs
//   - squeeze both -> alternating di-dah-di-dah
//
// Tapping the opposite paddle during an element latches that paddle into a
// one-shot memory, so it is sent next (insertion / alternation).
//
// Mode A vs Mode B differ only when you release BOTH paddles mid-element while
// squeezing:
//   - Mode A: finish the current element and stop.
//   - Mode B: finish the current element, then send one extra opposite element.
// The difference is whether the opposite paddle is sampled live at the end of
// the element (A) or remembered if it was held at any point during it (B).

export type IambicMode = "A" | "B";

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
  private mode: IambicMode = "A";
  /** Element currently being sent (null between elements). */
  private currentEl: "." | "-" | null = null;
  /** Mode B: was the opposite paddle held at any point during currentEl? */
  private oppositeSeen = false;

  constructor(hooks: KeyerHooks) {
    this.hooks = hooks;
  }

  setMode(mode: IambicMode) {
    this.mode = mode;
  }

  setDit(down: boolean) {
    this.paddle.dit = down;
    if (down) {
      this.ditMemory = true;
      if (this.currentEl === "-") this.oppositeSeen = true;
      this.start();
    }
  }

  setDah(down: boolean) {
    this.paddle.dah = down;
    if (down) {
      this.dahMemory = true;
      if (this.currentEl === ".") this.oppositeSeen = true;
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
    this.currentEl = null;
    this.oppositeSeen = false;
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
    this.currentEl = el;
    // The opposite paddle already being held counts as "seen" for this element.
    this.oppositeSeen = el === "." ? this.paddle.dah : this.paddle.dit;
    this.hooks.onElementStart?.();
    this.hooks.toneOn();
    this.hooks.setActive?.(el);

    this.timer = setTimeout(() => {
      this.hooks.toneOff();
      this.hooks.setActive?.(null);
      this.hooks.onElement(el);

      // Latch the opposite paddle so it (or the squeeze alternation) is sent
      // next. Mode A samples it live; Mode B remembers if it was held during
      // the element, producing the trailing extra element on a squeeze release.
      const oppositeDown = el === "." ? this.paddle.dah : this.paddle.dit;
      const latch = this.mode === "B" ? oppositeDown || this.oppositeSeen : oppositeDown;
      if (latch) {
        if (el === ".") this.dahMemory = true;
        else this.ditMemory = true;
      }
      this.currentEl = null;

      // Inter-element gap (1 dit), then decide the next element.
      this.timer = setTimeout(() => this.nextElement(), dit);
    }, dur);
  }
}
