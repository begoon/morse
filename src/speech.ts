// Spoken read-out of the answer for play mode. Pronounces real words and spells
// out everything else (abbreviations, Q-codes, numbers, callsigns, code groups,
// single letters). Uses the browser-native Web Speech API — no deps.

import type { Language } from "./morse";

// Punctuation read as a name rather than as a (silent) symbol when spelling.
const PUNCT_WORDS: Record<string, string> = {
  ".": "period",
  ",": "comma",
  "?": "question mark",
};

const bcp47 = (lang: Language): string => (lang === "ru" ? "ru-RU" : "en-US");

/**
 * Build the utterance for a target. `isWord` true → pronounce it as a word;
 * false → spell it out, one character at a time (commas force a pause between
 * characters so e.g. "73" reads "seven three", "TNX" reads "T N X").
 */
export function speechFor(
  target: string,
  isWord: boolean,
  lang: Language,
): { text: string; lang: string } {
  // Lower-case so voices read letters as "a", not "capital a".
  if (isWord) return { text: target.toLowerCase(), lang: bcp47(lang) };
  const text = [...target].map((c) => PUNCT_WORDS[c] ?? c.toLowerCase()).join(", ");
  return { text, lang: bcp47(lang) };
}

/** Speak `text` in `lang`, cancelling anything already speaking. No-op when the
 * platform has no speech synthesis. */
export function speak(text: string, lang: string): void {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  synth.speak(u);
}
