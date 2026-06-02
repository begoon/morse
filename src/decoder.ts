// Shared Morse decoder.
//
// Both keyers feed completed elements ('.' or '-') in via `element()`. The
// decoder accumulates the current letter's pattern and, after a period of
// silence, flushes it to a decoded character (letter gap) and later emits a
// space (word gap).
//
// Timer scheduling is injectable so the decode logic can be unit-tested with a
// fake clock. In the browser the real `setTimeout`/`clearTimeout` are used.

import { lookup, type Language } from "./morse";

export type DecoderTimers = {
  set: (fn: () => void, ms: number) => number;
  clear: (id: number) => void;
};

const realTimers: DecoderTimers = {
  set: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clear: (id) => clearTimeout(id),
};

export type DecoderOptions = {
  language: Language;
  /** Letter-gap silence in ms; flushes the in-progress pattern to a char. */
  letterGapMs: number;
  /** Word-gap silence in ms; appends a space after the letter is flushed. */
  wordGapMs: number;
  /** Max characters retained in the output string. */
  maxChars?: number;
  /** Called whenever output text or the in-progress pattern changes. */
  onChange?: (state: DecoderState) => void;
  timers?: DecoderTimers;
};

export type DecoderState = {
  /** Decoded text, trimmed to the last `maxChars` characters. */
  text: string;
  /** Pattern currently being built (live feedback), e.g. ".-". */
  pattern: string;
};

export class Decoder {
  private opts: Required<Omit<DecoderOptions, "onChange" | "timers">> &
    Pick<DecoderOptions, "onChange">;
  private timers: DecoderTimers;
  private pattern = "";
  private text = "";
  private letterTimer: number | null = null;
  private wordTimer: number | null = null;

  constructor(options: DecoderOptions) {
    this.opts = {
      language: options.language,
      letterGapMs: options.letterGapMs,
      wordGapMs: options.wordGapMs,
      maxChars: options.maxChars ?? 10,
      onChange: options.onChange,
    };
    this.timers = options.timers ?? realTimers;
  }

  setLanguage(lang: Language) {
    this.opts.language = lang;
  }

  setGaps(letterGapMs: number, wordGapMs: number) {
    this.opts.letterGapMs = letterGapMs;
    this.opts.wordGapMs = wordGapMs;
  }

  get state(): DecoderState {
    return { text: this.text, pattern: this.pattern };
  }

  /**
   * Signal that a tone has started — i.e. the silence between elements is
   * interrupted. Cancels any pending letter/word flush so the gap timers only
   * ever measure real silence, not the duration of the next element's tone.
   */
  elementStart() {
    this.cancelTimers();
  }

  /** Record a completed element and arm the letter-gap (silence) timer. */
  element(type: "." | "-") {
    this.cancelTimers();
    this.pattern += type;
    this.emit();
    this.letterTimer = this.timers.set(
      () => this.flushLetter(),
      this.opts.letterGapMs,
    );
  }

  /** Flush the in-progress pattern to a decoded character. */
  flushLetter() {
    this.cancelTimers();
    if (this.pattern === "") return;
    const char = lookup(this.pattern, this.opts.language);
    this.pattern = "";
    this.append(char);
    // After a letter, a further silence means a word boundary (space).
    const remaining = this.opts.wordGapMs - this.opts.letterGapMs;
    this.wordTimer = this.timers.set(
      () => this.flushWord(),
      Math.max(0, remaining),
    );
  }

  /** Emit a word boundary (space), unless one was just emitted. */
  flushWord() {
    this.cancelTimers();
    if (this.text.length > 0 && !this.text.endsWith(" ")) {
      this.append(" ");
    }
  }

  /** Clear all output and in-progress state. */
  reset() {
    this.cancelTimers();
    this.pattern = "";
    this.text = "";
    this.emit();
  }

  private append(char: string) {
    this.text += char;
    if (this.text.length > this.opts.maxChars) {
      this.text = this.text.slice(-this.opts.maxChars);
    }
    this.emit();
  }

  private cancelTimers() {
    if (this.letterTimer !== null) {
      this.timers.clear(this.letterTimer);
      this.letterTimer = null;
    }
    if (this.wordTimer !== null) {
      this.timers.clear(this.wordTimer);
      this.wordTimer = null;
    }
  }

  private emit() {
    this.opts.onChange?.(this.state);
  }
}
