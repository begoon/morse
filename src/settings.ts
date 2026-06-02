// Persisted user settings (localStorage).

import type { Language } from "./morse";

export type KeyType = "paddle" | "straight";

export type Settings = {
  keyType: KeyType;
  language: Language;
  wpm: number;
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
};

export const DEFAULTS: Settings = {
  keyType: "paddle",
  language: "en",
  wpm: 5,
  gapTolerance: 1.5,
  volume: 0.2,
  toneHz: 600,
  keys: {
    straight: "Space",
    dit: "Comma", // ,
    dah: "Period", // .
  },
};

const STORAGE_KEY = "morse-trainer-settings";

export function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      keys: { ...DEFAULTS.keys, ...(parsed.keys ?? {}) },
    };
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
