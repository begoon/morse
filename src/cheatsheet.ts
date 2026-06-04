// Renders a cheatsheet for the current language laid out like a physical
// keyboard: a number row, the three letter rows in QWERTY (English) or ЙЦУКЕН
// (Russian) order, and a short punctuation row (only . , ?). Each key can show
// its Morse pattern, or hide it (learning mode reveals patterns on demand).

import { tableFor, type Language } from "./morse";

const DIT = "·";
const DAH = "−";

/** Punctuation kept on the cheatsheet (everything else is dropped). */
export const PUNCT = [".", ",", "?"];

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

export function glyphs(pattern: string): string {
  return pattern
    .split("")
    .map((c) => (c === "." ? DIT : DAH))
    .join(" "); // hair space between symbols
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function key(char: string, pattern: string): string {
  return `
    <div class="cheat-key" data-char="${escAttr(char)}">
      <span class="cheat-char">${char}</span>
      <span class="cheat-pattern">${glyphs(pattern)}</span>
    </div>`;
}

export function renderCheatsheet(
  container: HTMLElement,
  lang: Language,
  opts: { showPatterns?: boolean } = {},
) {
  const table = tableFor(lang);

  const rows = LAYOUTS[lang]
    .map((row, i) => {
      const keys = row
        .filter((char) => char in table)
        .map((char) => key(char, table[char]!))
        .join("");
      return `<div class="cheat-row" style="margin-left:${ROW_STAGGER[i] ?? 0}rem">${keys}</div>`;
    })
    .join("");

  // Short punctuation set — only . , ? (when present in the language) — shown
  // as a column to the right of the main keyboard.
  const punct = PUNCT.filter((char) => char in table)
    .map((char) => key(char, table[char]!))
    .join("");

  // hide-morse hides every pattern; learning mode reveals one via .reveal.
  container.classList.toggle("hide-morse", opts.showPatterns === false);
  container.innerHTML =
    `<div class="cheat-board">` +
    `<div class="cheat-keyboard">${rows}</div>` +
    (punct ? `<div class="cheat-punct">${punct}</div>` : "") +
    `</div>`;
}
