// Persisted user settings (localStorage).

import type { Language } from "./morse";
import type { IambicMode } from "./keyer-iambic";

export type KeyType = "paddle" | "straight";

export type Settings = {
  keyType: KeyType;
  /** Iambic keyer behaviour on squeeze release (Curtis Mode A or B). */
  iambicMode: IambicMode;
  language: Language;
  /** Play mode: max word length. 1 = single characters; 2+ = English words
   * of 2..N letters (RU always plays single characters). */
  wordLength: number;
  wpm: number;
  /** Play mode: auto-reveal the current letter after this many seconds (the
   * "beat the clock" challenge). 0 = off. */
  autoRevealSec: number;
  /** Multiplier widening the decode letter/word gap thresholds (keying speed
   * is unchanged). 1 = strict PARIS spacing; higher = more forgiving pauses. */
  gapTolerance: number;
  volume: number; // 0..1
  toneHz: number;
  keys: {
    straight: string; // KeyboardEvent.code
    dit: string;
    dah: string;
  };
  /** AI chat (/chat): provider, model, and per-provider API keys. Keys live
   * only in this browser's localStorage and are never built into docs/. */
  aiProvider: AiProvider;
  aiModel: string;
  openaiKey: string;
  geminiKey: string;
  anthropicKey: string;
  /** Chat: whether the AI reply is shown as letters and/or as Morse. */
  chatShowLetters: boolean;
  chatShowMorse: boolean;
};

export type AiProvider = "openai" | "gemini" | "anthropic";

export const DEFAULTS: Settings = {
  keyType: "paddle",
  iambicMode: "A",
  language: "en",
  wordLength: 1,
  wpm: 10,
  autoRevealSec: 0,
  gapTolerance: 1.5,
  volume: 0.2,
  toneHz: 600,
  keys: {
    straight: "Space",
    dit: "BracketLeft", // [
    dah: "BracketRight", // ]
  },
  aiProvider: "openai",
  aiModel: "gpt-4o-mini",
  openaiKey: "",
  geminiKey: "",
  anthropicKey: "",
  chatShowLetters: true,
  chatShowMorse: true,
};

const STORAGE_KEY = "morse-trainer-settings";

export function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const keys = { ...DEFAULTS.keys, ...(parsed.keys ?? {}) };
    // Migrate the previous default keying keys (Comma/Period) to the current
    // ones. There's no UI to customise keys, so a persisted Comma/Period pair
    // is only ever a stale default snapshot — safe to upgrade in place.
    if (keys.dit === "Comma" && keys.dah === "Period") {
      keys.dit = DEFAULTS.keys.dit;
      keys.dah = DEFAULTS.keys.dah;
    }
    return { ...DEFAULTS, ...parsed, keys };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode, etc.) — ignore.
  }
}
