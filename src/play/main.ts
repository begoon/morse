// Play mode: sounds out a target (a character, or a word when the word-length
// setting allows) and the user types it back. Space replays, "/" shows the
// code, a second "/" (or clicking the output, or the auto-reveal timer) reveals
// the whole answer — after which the action becomes "Next" and "/" / a click
// advances to the next target (no need to type the revealed answer).

import "../styles.css";
import { Sidetone } from "../audio";
import { renderCheatsheet, glyphs } from "../cheatsheet";
import { playPattern, type PlayHandle } from "../player";
import { farnsworth } from "../timing";
import { encodeWord } from "../morse";
import * as Settings from "../settings";
import { speechFor, speak } from "../speech";
import { pickTarget, type WordPools } from "./words";
import * as Stats from "./stats";
import poolsJson from "./words.json";

const pools = poolsJson as WordPools;
// O(1) lookup for "is this a real word?" (vs CW jargon / random groups).
const commonSet = new Set(pools.common);
const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

const outputEl = document.getElementById("output")!;
const morseEl = document.getElementById("morse")!;
const historyEl = document.getElementById("history")!;
const cheatsheetEl = document.getElementById("cheatsheet")!;
const replayBtn = document.getElementById("replay") as HTMLButtonElement;
const revealBtn = document.getElementById("reveal") as HTMLButtonElement;
const statsBodyEl = document.getElementById("statsBody")!;
const statsResetEl = document.getElementById("statsReset") as HTMLButtonElement;
const headCopyEl = document.getElementById("headCopy") as HTMLInputElement;
const speakRevealEl = document.getElementById("speakReveal") as HTMLInputElement;

const HISTORY_MAX = 40; // like keying's decoder maxChars
let history = ""; // running line of guessed letters, targets separated by spaces

let target = ""; // the word (or single character) being played
let pos = 0; // next expected letter index
let showMorse = false; // "/" revealed the pattern
let revealed = false; // second "/" -> next expected key shown on the keyboard
let answerShown = false; // auto-reveal fired -> the answer letter is shown
let playing: PlayHandle | null = null;
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let spoken = false; // the answer has been read aloud for this target

// Head-copy mode: play the whole target, then type it blind and press Enter to
// check. No per-letter hints, reveal, or cheatsheet highlight. Toggleable live
// from the Play page (and persisted to Settings).
let headCopy = settings.headCopy;
let buffer = ""; // what the operator has typed for the current target
let checked = false; // the buffer has been graded and the answer revealed

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

// Start (or restart) the "beat the clock" countdown for the current letter.
// When it expires the whole remaining answer is revealed at once (and spoken);
// the player still types it out to advance.
function startRevealTimer() {
  clearRevealTimer();
  if (settings.autoRevealSec > 0 && pos < target.length) {
    revealTimer = setTimeout(autoReveal, settings.autoRevealSec * 1000);
  }
}

function clearRevealTimer() {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
}

function autoReveal() {
  revealTimer = null;
  fullReveal();
}

function playTarget() {
  if (!target) return;
  const pattern = encodeWord(target, settings.language);
  if (!pattern) return;
  playing?.cancel();
  sidetone.ensure().then(() => {
    if (target)
      playing = playPattern(sidetone, pattern, farnsworth(settings.charWpm, settings.wpm));
  });
}

function render() {
  // Typed letters are shown solid; once the timer reveals the answer, the
  // remaining letters appear all at once; otherwise they stay placeholders.
  const placeholder = target.length === 1 ? "?" : "_";
  const slots = [...target]
    .map((c, i) =>
      i < pos
        ? `<span class="slot done">${c}</span>`
        : answerShown
          ? `<span class="slot revealed">${c}</span>`
          : `<span class="slot">${placeholder}</span>`,
    )
    .join("");
  outputEl.innerHTML = `<span class="challenge" title="Click to reveal">${slots}</span>`;
  // The reveal line below the output shows the morse code on "/", one letter
  // pattern per cell so long words wrap.
  morseEl.innerHTML = showMorse
    ? encodeWord(target, settings.language)
        .split(" ")
        .map((p) => `<span class="morse-letter">${glyphs(p)}</span>`)
        .join("")
    : "";
  highlightTarget();
}

// The running line of previous letters. When the timer auto-reveals the answer,
// the whole remaining target is previewed highlighted at the end here (the
// player still types it out to commit).
function renderHistory() {
  if (answerShown && pos < target.length) {
    historyEl.innerHTML = `${esc(history)}<span class="revealed">${esc(target.slice(pos))}</span>`;
  } else {
    historyEl.textContent = history;
  }
}

// Per-character accuracy, worst-first, so the weakest characters are obvious.
function renderStats() {
  const stats = Stats.load();
  const rows = Object.entries(stats)
    .map(([c, e]) => ({ c, e, acc: e.seen ? e.correct / e.seen : 0 }))
    .sort((a, b) => a.acc - b.acc || b.e.seen - a.e.seen);
  statsBodyEl.innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<span class="stat"><b>${r.c}</b> ${Math.round(r.acc * 100)}% <small>${r.e.correct}/${r.e.seen}</small></span>`,
        )
        .join("")
    : `<span class="stat-empty">No data yet — start copying.</span>`;
}

function highlightTarget() {
  const expected = target[pos] ?? "";
  cheatsheetEl.querySelectorAll<HTMLElement>(".cheat-key").forEach((el) => {
    const isTarget = revealed && (el.dataset.char ?? "") === expected;
    // Highlight the key only — the code is shown in the #morse row, not on the
    // key, so we don't toggle `.reveal` (which would un-hide its pattern).
    el.classList.toggle("target", isTarget);
    if (isTarget) el.scrollIntoView({ block: "nearest", inline: "center" });
  });
}

// Read the answer aloud (once per target). Real English words are pronounced;
// abbreviations, numbers, callsigns, code groups, single letters and all Russian
// are spelled out character by character.
function maybeSpeak() {
  if (!settings.speakOnReveal || spoken) return;
  spoken = true;
  const isWord =
    settings.language === "en" && target.length > 1 && commonSet.has(target);
  const u = speechFor(target, isWord, settings.language);
  speak(u.text, u.lang);
}

// Give up on the current target: show the whole answer at once (all letters +
// spoken), stop the clock, count the un-typed letters as missed, and flip the
// action to "Next" — there's nothing left to type. Idempotent per target.
function fullReveal() {
  if (headCopy || answerShown) return; // no hints in head-copy; reveal once
  clearRevealTimer();
  answerShown = true;
  revealed = true; // highlight the next key on the cheatsheet
  showMorse = true; // and show the code under the word
  for (let i = pos; i < target.length; i++) Stats.record(target[i]!, false);
  renderStats();
  maybeSpeak();
  render();
  renderHistory();
  updateRevealBtn();
}

// The reveal/next button reads "Next" once the answer is shown, else "Reveal".
function updateRevealBtn() {
  revealBtn.textContent = answerShown ? "Next" : 'Reveal ("/")';
}

// Head-copy display: the typed-so-far buffer while listening, then the graded
// answer (your guess struck through next to the correct target) once checked.
function renderHeadCopy() {
  morseEl.innerHTML = "";
  if (checked) {
    const ok = buffer.toUpperCase() === target;
    outputEl.innerHTML = ok
      ? `<span class="challenge hc-ok">${target}</span>`
      : `<span class="challenge"><span class="hc-bad">${esc(buffer) || "—"}</span> <span class="hc-ans">${target}</span></span>`;
  } else {
    outputEl.innerHTML = `<span class="challenge">${esc(buffer)}<span class="hc-cursor">▌</span></span>`;
  }
}

// Grade the typed buffer against the target, record per-character stats, reveal
// the answer. Correct → auto-advance; wrong → wait for Enter to move on.
function checkBuffer() {
  checked = true;
  clearRevealTimer();
  maybeSpeak(); // read the correct target aloud, right or wrong
  const guessU = buffer.toUpperCase();
  const ok = guessU === target;
  for (let i = 0; i < target.length; i++) {
    Stats.record(target[i]!, guessU[i] === target[i]);
  }
  renderStats();
  if (ok) {
    history += target + " ";
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    renderHistory();
    renderHeadCopy();
    setTimeout(newTarget, 600);
  } else {
    sidetone.error();
    renderHeadCopy();
  }
}

// The "/" action (key or button): first press shows the code, a second reveals
// the whole answer. Once revealed, "/" advances to the next target (the button
// reads "Next") — the answer is shown, so there's nothing to type.
function revealStep() {
  if (headCopy) return; // no hints in head-copy mode
  if (answerShown) {
    newTarget();
  } else if (!showMorse) {
    showMorse = true;
    render();
  } else {
    fullReveal();
  }
}

function newTarget() {
  target = pickTarget(
    pools,
    settings.language,
    settings.wordLength,
    target,
    Math.random,
    settings.practiceMode,
  );
  pos = 0;
  showMorse = false;
  revealed = false;
  answerShown = false;
  spoken = false;
  buffer = "";
  checked = false;
  outputEl.classList.remove("ok", "bad");
  updateRevealBtn();
  if (headCopy) renderHeadCopy();
  else render();
  renderHistory();
  playTarget();
  if (!headCopy) startRevealTimer();
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
  if (answerShown) return; // already revealed — use "/" (Next) to advance
  const expected = target[pos];
  if (!expected) return;
  const ok = char.toUpperCase() === expected;
  Stats.record(expected, ok);
  renderStats();
  if (ok) {
    clearRevealTimer(); // this letter was answered — stop its clock
    splashKey(expected); // short splash on the correct key
    pos++;
    revealed = false; // each letter must be revealed anew
    history += expected;
    if (pos >= target.length) history += " ";
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    renderHistory();
    render();
    if (pos >= target.length) {
      setTimeout(newTarget, 150); // newTarget starts the next clock
    } else {
      startRevealTimer(); // next letter, fresh clock
    }
  } else {
    sidetone.error();
    outputEl.classList.add("bad");
    setTimeout(() => outputEl.classList.remove("bad"), 150);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (headCopy) {
    if (e.key === " ") {
      e.preventDefault();
      playTarget();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (checked) newTarget();
      else checkBuffer();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (!checked && buffer) {
        buffer = buffer.slice(0, -1);
        renderHeadCopy();
      }
    } else if (e.key.length === 1) {
      e.preventDefault();
      sidetone.ensure();
      if (!checked) {
        buffer += e.key.toUpperCase();
        renderHeadCopy();
      }
    }
    return;
  }
  if (e.key === " ") {
    e.preventDefault();
    playTarget();
  } else if (e.key === "/") {
    e.preventDefault();
    revealStep();
  } else if (e.key.length === 1) {
    e.preventDefault();
    sidetone.ensure(); // first keypress unlocks audio
    guess(e.key);
  }
});

// Clicking the output reveals the whole answer (then click it / press "/" to
// move on, same as the button).
outputEl.addEventListener("click", () => {
  if (answerShown) newTarget();
  else fullReveal();
});

// On-screen equivalents of Space (replay) and "/" (show code / reveal). blur()
// keeps a subsequent Space keypress from re-triggering the focused button.
replayBtn.addEventListener("click", () => {
  playTarget();
  replayBtn.blur();
});
revealBtn.addEventListener("click", () => {
  revealStep();
  revealBtn.blur();
});
statsResetEl.addEventListener("click", () => {
  Stats.reset();
  renderStats();
  statsResetEl.blur();
});

// Head-copy toggle: flip the mode live, persist it, and restart with a fresh
// target so the input flow and display match the new mode.
headCopyEl.checked = headCopy;
headCopyEl.addEventListener("change", () => {
  headCopy = headCopyEl.checked;
  settings.headCopy = headCopy;
  Settings.save(settings);
  newTarget();
});

// Speak-the-answer toggle: persist live. No restart needed — it only affects
// what happens at the next reveal, not the input flow.
speakRevealEl.checked = settings.speakOnReveal;
speakRevealEl.addEventListener("change", () => {
  settings.speakOnReveal = speakRevealEl.checked;
  Settings.save(settings);
});

// --- Init --------------------------------------------------------------------
renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: false });
// Tap a cheatsheet key to guess it (the only input path on touch devices,
// where there's no physical keyboard). Keys are static after render, so a
// single pass of listeners is enough.
cheatsheetEl.classList.add("guessable");
cheatsheetEl.querySelectorAll<HTMLElement>(".cheat-key").forEach((el) => {
  el.addEventListener("click", () => {
    const char = el.dataset.char;
    if (!char) return;
    sidetone.ensure(); // first tap unlocks audio
    if (headCopy) {
      if (!checked) {
        buffer += char;
        renderHeadCopy();
      }
    } else {
      guess(char);
    }
  });
});
renderStats();
newTarget();
