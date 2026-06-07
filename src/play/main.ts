// Play mode: sounds out a target (a character, or a word when the word-length
// setting allows) and the user types it back. Space replays, "/" shows the
// code, a second "/" (or clicking the output) reveals the next expected key on
// the cheatsheet.

import "../styles.css";
import { Sidetone } from "../audio";
import { renderCheatsheet, glyphs } from "../cheatsheet";
import { playPattern, type PlayHandle } from "../player";
import { ditMs } from "../timing";
import { encodeWord } from "../morse";
import * as Settings from "../settings";
import { pickTarget, type WordPools } from "./words";
import poolsJson from "./words.json";

const pools = poolsJson as WordPools;
const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

const outputEl = document.getElementById("output")!;
const historyEl = document.getElementById("history")!;
const hintsEl = document.getElementById("hints")!;
const cheatsheetEl = document.getElementById("cheatsheet")!;

const HISTORY_MAX = 40; // like keying's decoder maxChars
let history = ""; // running line of guessed letters, targets separated by spaces

let target = ""; // the word (or single character) being played
let pos = 0; // next expected letter index
let showMorse = false; // "/" revealed the pattern
let revealed = false; // second "/" -> next expected key shown on the keyboard
let playing: PlayHandle | null = null;

function playTarget() {
  if (!target) return;
  const pattern = encodeWord(target, settings.language);
  if (!pattern) return;
  playing?.cancel();
  sidetone.ensure().then(() => {
    if (target) playing = playPattern(sidetone, pattern, ditMs(settings.wpm));
  });
}

function render() {
  const morse = showMorse
    ? `<span class="challenge-morse">${encodeWord(target, settings.language)
        .split(" ")
        .map(glyphs)
        .join("&nbsp;&nbsp;")}</span>`
    : "";
  const slots =
    target.length === 1
      ? `<span class="slot">?</span>`
      : [...target]
          .map((c, i) =>
            i < pos
              ? `<span class="slot done">${c}</span>`
              : `<span class="slot">_</span>`,
          )
          .join("");
  outputEl.innerHTML = `<span class="challenge" title="Click to reveal">${slots}</span>${morse}`;
  highlightTarget();
}

function highlightTarget() {
  const expected = target[pos] ?? "";
  cheatsheetEl.querySelectorAll<HTMLElement>(".cheat-key").forEach((el) => {
    const isTarget = revealed && (el.dataset.char ?? "") === expected;
    el.classList.toggle("target", isTarget);
    el.classList.toggle("reveal", isTarget);
    if (isTarget) el.scrollIntoView({ block: "nearest", inline: "center" });
  });
}

function reveal() {
  revealed = true;
  render();
}

function newTarget() {
  target = pickTarget(pools, settings.language, settings.wordLength, target);
  pos = 0;
  showMorse = false;
  revealed = false;
  render();
  playTarget();
}

function splashKey(char: string) {
  cheatsheetEl.querySelectorAll<HTMLElement>(".cheat-key").forEach((el) => {
    if ((el.dataset.char ?? "") !== char) return;
    el.classList.remove("splash");
    void el.offsetWidth; // restart the animation if already playing
    el.classList.add("splash");
    setTimeout(() => el.classList.remove("splash"), 350);
  });
}

function guess(char: string) {
  const expected = target[pos];
  if (!expected) return;
  if (char.toUpperCase() === expected) {
    splashKey(expected); // short splash on the correct key
    pos++;
    revealed = false; // each letter must be revealed anew
    history += expected;
    if (pos >= target.length) history += " ";
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    historyEl.textContent = history;
    render();
    if (pos >= target.length) setTimeout(newTarget, 150);
  } else {
    sidetone.error();
    outputEl.classList.add("bad");
    setTimeout(() => outputEl.classList.remove("bad"), 150);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " ") {
    e.preventDefault();
    playTarget();
  } else if (e.key === "/") {
    e.preventDefault();
    // First "/" shows the code; a second "/" reveals the next letter.
    if (!showMorse) {
      showMorse = true;
      render();
    } else {
      reveal();
    }
  } else if (e.key.length === 1) {
    e.preventDefault();
    sidetone.ensure(); // first keypress unlocks audio
    guess(e.key);
  }
});

outputEl.addEventListener("click", reveal);

// --- Init --------------------------------------------------------------------
renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: false });
hintsEl.textContent =
  settings.wordLength > 1 && settings.language === "en"
    ? "Listen, then type the word · Space replays · / shows the code, / again reveals the next letter"
    : "Listen, then type the letter · Space replays · / shows the code, / again reveals";
newTarget();
