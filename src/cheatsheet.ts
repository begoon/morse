// Renders a cheatsheet for the current language laid out like a physical
// keyboard: a number row plus the letter rows in QWERTY (English) or ЙЦУКЕН
// (Russian) order, each key showing its Morse pattern. Characters in the table
// that aren't on the keyboard (punctuation) follow in a small grid.

import { tableFor, type Language } from "./morse";

const DIT = "·";
const DAH = "−";

// Keyboard letter/number rows per language, top to bottom.
const LAYOUTS: Record<Language, string[][]> = {
  en: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ],
  ru: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х", "Ъ"],
    ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
    ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю"],
  ],
};

// Left-indent (in rem) per row to mimic a keyboard's staggered rows.
const ROW_STAGGER = [0, 0, 0.9, 1.8];

function glyphs(pattern: string): string {
  return pattern
    .split("")
    .map((c) => (c === "." ? DIT : DAH))
    .join(" "); // hair space between symbols
}

function key(char: string, pattern: string): string {
  return `
    <div class="cheat-key">
      <span class="cheat-char">${char}</span>
      <span class="cheat-pattern">${glyphs(pattern)}</span>
    </div>`;
}

export function renderCheatsheet(container: HTMLElement, lang: Language) {
  const table = tableFor(lang);
  const onKeyboard = new Set<string>();

  const rows = LAYOUTS[lang]
    .map((row, i) => {
      const keys = row
        .filter((char) => char in table)
        .map((char) => {
          onKeyboard.add(char);
          return key(char, table[char]!);
        })
        .join("");
      return `<div class="cheat-row" style="margin-left:${ROW_STAGGER[i] ?? 0}rem">${keys}</div>`;
    })
    .join("");

  // Anything in the table but not on the keyboard (punctuation), shortest first.
  const extras = Object.entries(table)
    .filter(([char]) => !onKeyboard.has(char))
    .sort(([, a], [, b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    .map(([char, pattern]) => key(char, pattern))
    .join("");

  container.innerHTML =
    `<div class="cheat-keyboard">${rows}</div>` +
    (extras ? `<div class="cheat-grid">${extras}</div>` : "");
}
