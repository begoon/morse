// Morse code tables and lookup.
//
// Patterns use '.' for dit and '-' for dah. Each table maps a display
// character to its Morse pattern. Reverse maps (pattern -> char) are derived
// for decoding.

export type Language = "en" | "ru";

/** English / international Morse: letters, digits, common punctuation. */
export const MORSE_EN: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  '"': ".-..-.",
  "@": ".--.-.",
};

/**
 * Russian Morse. Cyrillic letters reuse the standard international dit-dah
 * patterns. Digits and punctuation are shared with the English table.
 */
export const MORSE_RU: Record<string, string> = {
  А: ".-",
  Б: "-...",
  В: ".--",
  Г: "--.",
  Д: "-..",
  Е: ".",
  Ж: "...-",
  З: "--..",
  И: "..",
  Й: ".---",
  К: "-.-",
  Л: ".-..",
  М: "--",
  Н: "-.",
  О: "---",
  П: ".--.",
  Р: ".-.",
  С: "...",
  Т: "-",
  У: "..-",
  Ф: "..-.",
  Х: "....",
  Ц: "-.-.",
  Ч: "---.",
  Ш: "----",
  Щ: "--.-",
  Ъ: "--.--",
  Ы: "-.--",
  Ь: "-..-",
  Э: "..-..",
  Ю: "..--",
  Я: ".-.-",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": "......",
  ",": ".-.-.-",
  "?": "..--..",
  "/": "-..-.",
  "-": "-....-",
};

function buildReverse(table: Record<string, string>): Record<string, string> {
  const rev: Record<string, string> = {};
  for (const [char, pattern] of Object.entries(table)) {
    // First definition wins when patterns collide (shouldn't within a table).
    if (!(pattern in rev)) rev[pattern] = char;
  }
  return rev;
}

const REVERSE: Record<Language, Record<string, string>> = {
  en: buildReverse(MORSE_EN),
  ru: buildReverse(MORSE_RU),
};

export function tableFor(lang: Language): Record<string, string> {
  return lang === "ru" ? MORSE_RU : MORSE_EN;
}

/** Decode a dit-dah pattern to a character, or '?' if unknown. */
export function lookup(pattern: string, lang: Language): string {
  if (pattern === "") return "";
  return REVERSE[lang][pattern] ?? "?";
}

/** Encode a character to its pattern, or undefined if not in the table. */
export function encode(char: string, lang: Language): string | undefined {
  return tableFor(lang)[char.toUpperCase()];
}

/** Encode a word as per-letter patterns joined with " " (a letter gap).
 * Characters missing from the table are skipped. */
export function encodeWord(word: string, lang: Language): string {
  return [...word]
    .map((c) => encode(c, lang))
    .filter((p): p is string => !!p)
    .join(" ");
}
