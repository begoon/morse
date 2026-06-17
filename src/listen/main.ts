// Listen mode: sounds out a target (a character, or a word when the word-length
// setting allows). You copy it in your head and say it aloud, then reveal to
// check — there is no typing. Space is the one eyes-free key: a short tap
// replays; holding it past LONG_PRESS_MS reveals the whole answer (code +
// letters, optionally spoken — same as the auto-reveal timer). After a reveal
// the answer lingers POST_REVEAL_MS, then the next target plays automatically —
// so a finger resting on the spacebar runs the whole drill without looking. A
// tap (or "/", or clicking the output) skips the wait and advances now.

import "../styles.css";
import { Sidetone } from "../audio";
import { glyphs } from "../cheatsheet";
import { playPattern, type PlayHandle } from "../player";
import { farnsworth } from "../timing";
import { encodeWord } from "../morse";
import * as Settings from "../settings";
import { speechFor, speak } from "../speech";
import { pickTarget, type WordPools } from "./words";
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
const replayBtn = document.getElementById("replay") as HTMLButtonElement;
const revealBtn = document.getElementById("reveal") as HTMLButtonElement;
const speakRevealEl = document.getElementById("speakReveal") as HTMLInputElement;

const HISTORY_MAX = 40; // running log of revealed targets
let history = ""; // space-separated targets you've revealed this session

let target = ""; // the word (or single character) being played
let answerShown = false; // the whole answer is shown -> auto-advancing
let playing: PlayHandle | null = null;
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let spoken = false; // the answer has been read aloud for this target

// How long the revealed answer lingers (so you can hear/read it) before the
// next target plays automatically.
const POST_REVEAL_MS = 3000;

// Start (or restart) the "beat the clock" countdown: say the target before it
// expires. When it does, the answer is revealed (and spoken). 0 = off.
function startRevealTimer() {
  clearRevealTimer();
  if (settings.autoRevealSec > 0 && !answerShown) {
    revealTimer = setTimeout(autoReveal, settings.autoRevealSec * 1000);
  }
}

function clearRevealTimer() {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
}

function clearAdvanceTimer() {
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = null;
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
  // Placeholders until revealed, then the whole answer at once.
  const placeholder = target.length === 1 ? "?" : "_";
  const slots = [...target]
    .map((c) =>
      answerShown
        ? `<span class="slot revealed">${c}</span>`
        : `<span class="slot">${placeholder}</span>`,
    )
    .join("");
  outputEl.innerHTML = `<span class="challenge" title="Click to reveal">${slots}</span>`;
  // On reveal, show the morse code too — one letter pattern per cell so long
  // words wrap.
  morseEl.innerHTML = answerShown
    ? encodeWord(target, settings.language)
        .split(" ")
        .map((p) => `<span class="morse-letter">${glyphs(p)}</span>`)
        .join("")
    : "";
}

// Running log of targets revealed so far this session.
function renderHistory() {
  historyEl.textContent = history;
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

// Reveal the whole answer at once (all letters + code + spoken), stop the clock,
// log it, then linger POST_REVEAL_MS before auto-advancing. Idempotent per
// target.
function fullReveal() {
  if (answerShown) return; // reveal once
  clearRevealTimer();
  answerShown = true;
  history = `${history} ${target}`.trim();
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  maybeSpeak();
  render();
  renderHistory();
  updateButtons();
  advanceTimer = setTimeout(newTarget, POST_REVEAL_MS); // then move on by itself
}

// Both action buttons (Replay + Reveal) show while listening; once the answer is
// revealed it auto-advances, so neither button is shown (tap Space / "/" / click
// the output to skip the wait).
function updateButtons() {
  const hidden = answerShown ? "none" : "";
  replayBtn.style.display = hidden;
  revealBtn.style.display = hidden;
}

// The "/" action (key or button): reveal the whole answer, or — once revealed —
// skip the wait and advance now.
function revealStep() {
  if (answerShown) newTarget();
  else fullReveal();
}

function newTarget() {
  clearAdvanceTimer();
  target = pickTarget(
    pools,
    settings.language,
    settings.wordLength,
    target,
    Math.random,
    settings.practiceMode,
  );
  answerShown = false;
  spoken = false;
  updateButtons();
  render();
  renderHistory();
  playTarget();
  startRevealTimer();
}

// Space is the single eyes-free key. While listening: a short tap replays, a
// hold past LONG_PRESS_MS reveals (so one finger does both). Once revealed, a
// tap advances. "/" stays as an explicit reveal/next shortcut.
const LONG_PRESS_MS = 400;
let spaceTimer: ReturnType<typeof setTimeout> | null = null;
let spaceRevealedByHold = false; // this hold already triggered the reveal

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") {
    if (e.repeat) return;
    e.preventDefault();
    sidetone.ensure();
    revealStep(); // reveal, or advance once revealed
  } else if (e.key === " ") {
    e.preventDefault(); // swallow auto-repeat too so the page never scrolls
    if (e.repeat) return;
    sidetone.ensure(); // first interaction unlocks audio
    spaceRevealedByHold = false;
    // Arm the hold-to-reveal timer only while listening; the tap action (replay
    // / advance) fires on release in keyup.
    if (!answerShown) {
      spaceTimer = setTimeout(() => {
        spaceTimer = null;
        spaceRevealedByHold = true;
        fullReveal();
      }, LONG_PRESS_MS);
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key !== " ") return;
  if (spaceTimer) {
    clearTimeout(spaceTimer);
    spaceTimer = null;
  }
  if (spaceRevealedByHold) {
    spaceRevealedByHold = false; // the hold already revealed — don't also act
    return;
  }
  // Short tap: replay while listening, advance once revealed.
  if (answerShown) newTarget();
  else playTarget();
});

// Clicking the output reveals the whole answer (then click it / press "/" to
// move on, same as the button).
outputEl.addEventListener("click", () => {
  sidetone.ensure();
  if (answerShown) newTarget();
  else fullReveal();
});

// On-screen equivalents of Space (replay) and "/" (show code / reveal / next).
// blur() keeps a subsequent Space keypress from re-triggering the focused button.
replayBtn.addEventListener("click", () => {
  playTarget();
  replayBtn.blur();
});
revealBtn.addEventListener("click", () => {
  revealStep();
  revealBtn.blur();
});

// Speak-the-answer toggle: persist live. No restart needed — it only affects
// what happens at the next reveal.
speakRevealEl.checked = settings.speakOnReveal;
speakRevealEl.addEventListener("change", () => {
  settings.speakOnReveal = speakRevealEl.checked;
  Settings.save(settings);
});

// --- Init --------------------------------------------------------------------
newTarget();
