// Renders an alphabet cheatsheet for the current language: each character with
// its Morse pattern, drawn with visual dit/dah glyphs.

import { tableFor, type Language } from "./morse";

const DIT = "·";
const DAH = "−";

function glyphs(pattern: string): string {
  return pattern
    .split("")
    .map((c) => (c === "." ? DIT : DAH))
    .join(" "); // hair space between symbols
}

export function renderCheatsheet(container: HTMLElement, lang: Language) {
  const table = tableFor(lang);
  const cells = Object.entries(table)
    // Order from simplest to longest: E (·), T (−), then A, N, I, M … so the
    // shortest, most common characters come first.
    .sort(([, a], [, b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([char, pattern]) => `
      <div class="cheat-cell">
        <span class="cheat-char">${char}</span>
        <span class="cheat-pattern">${glyphs(pattern)}</span>
      </div>`,
    )
    .join("");
  container.innerHTML = `<div class="cheat-grid">${cells}</div>`;
}
