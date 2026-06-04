// Wires the DOM, settings, audio, keyers, decoder and the learning mode.

import "./styles.css";
import { Decoder } from "./decoder";
import { Sidetone } from "./audio";
import { IambicKeyer } from "./keyer-iambic";
import { StraightKeyer } from "./keyer-straight";
import { renderCheatsheet, glyphs, PUNCT } from "./cheatsheet";
import { playPattern, type PlayHandle } from "./player";
import { ditMs, thresholds } from "./timing";
import { tableFor, type Language } from "./morse";
import * as Settings from "./settings";

const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

// --- DOM ---------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const outputEl = $("output");
const patternEl = $("pattern");
const hintsEl = $("hints");
const modeEl = $<HTMLSelectElement>("mode");
const keyTypeEl = $<HTMLSelectElement>("keyType");
const iambicModeEl = $<HTMLSelectElement>("iambicMode");
const languageEl = $<HTMLSelectElement>("language");
const wpmEl = $<HTMLInputElement>("wpm");
const wpmValEl = $("wpmVal");
const gapEl = $<HTMLInputElement>("gap");
const gapValEl = $("gapVal");
const volumeEl = $<HTMLInputElement>("volume");
const toneEl = $<HTMLInputElement>("tone");
const toneValEl = $("toneVal");
const clearEl = $<HTMLButtonElement>("clear");
const cheatsheetEl = $("cheatsheet");

// --- Decoder (keying mode) ---------------------------------------------------
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: thresholds(settings.wpm).gapLetter,
  wordGapMs: thresholds(settings.wpm).gapWord,
  maxChars: 40,
  onChange: (s) => {
    if (settings.mode !== "keying") return;
    outputEl.textContent = s.text || " ";
    patternEl.textContent = s.pattern || " ";
  },
});

// --- Keyers (keying mode) ----------------------------------------------------
const iambic = new IambicKeyer({
  ditMs: () => ditMs(settings.wpm),
  toneOn: () => sidetone.keyOn(),
  toneOff: () => sidetone.keyOff(),
  onElementStart: () => decoder.elementStart(),
  onElement: (t) => decoder.element(t),
});
iambic.setMode(settings.iambicMode);

const straight = new StraightKeyer({
  wpm: () => settings.wpm,
  toneOn: () => sidetone.keyOn(),
  toneOff: () => sidetone.keyOff(),
  onElementStart: () => decoder.elementStart(),
  onElement: (t) => decoder.element(t),
});

// --- Learn-letters mode ------------------------------------------------------
// Plays a random character; the user types it to answer. Space replays, "/"
// reveals the Morse pattern beside the "?", and clicking the "?" reveals which
// key it is on the cheatsheet (showing that key's pattern).
let target: string | null = null;
let showMorse = false; // "/" revealed the pattern
let revealed = false; // "?" clicked -> answer shown on the keyboard
let playing: PlayHandle | null = null;

function letterPool(): string[] {
  return Object.keys(tableFor(settings.language)).filter(
    (c) => /[\p{L}\p{N}]/u.test(c) || PUNCT.includes(c),
  );
}

function playTarget() {
  if (!target) return;
  const pattern = tableFor(settings.language)[target];
  if (!pattern) return;
  playing?.cancel();
  sidetone.ensure().then(() => {
    if (target && settings.mode === "letters") {
      playing = playPattern(sidetone, pattern, ditMs(settings.wpm));
    }
  });
}

function renderLetters() {
  const pattern = target ? tableFor(settings.language)[target] : "";
  const morse =
    showMorse && pattern
      ? `<span class="challenge-morse">${glyphs(pattern)}</span>`
      : "";
  outputEl.innerHTML = `<span class="challenge" title="Click to reveal">?</span>${morse}`;
  patternEl.textContent = " ";
  highlightTarget();
}

function highlightTarget() {
  cheatsheetEl.querySelectorAll<HTMLElement>(".cheat-key").forEach((el) => {
    const isTarget = revealed && (el.dataset.char ?? "") === target;
    el.classList.toggle("target", isTarget);
    el.classList.toggle("reveal", isTarget);
  });
}

function newLetter() {
  const pool = letterPool();
  let next = target;
  do {
    next = pool[Math.floor(Math.random() * pool.length)]!;
  } while (pool.length > 1 && next === target);
  target = next;
  showMorse = false;
  revealed = false;
  renderLetters();
  playTarget();
}

function guess(char: string) {
  if (!target) return;
  if (char.toUpperCase() === target) {
    outputEl.classList.add("ok");
    setTimeout(() => {
      outputEl.classList.remove("ok");
      newLetter();
    }, 250);
  } else {
    outputEl.classList.add("bad");
    setTimeout(() => outputEl.classList.remove("bad"), 250);
  }
}

function handleLettersKey(e: KeyboardEvent) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " ") {
    e.preventDefault();
    playTarget();
  } else if (e.key === "/") {
    e.preventDefault();
    showMorse = true;
    renderLetters();
  } else if (e.key.length === 1) {
    e.preventDefault();
    sidetone.ensure(); // first keypress unlocks audio
    guess(e.key);
  }
}

outputEl.addEventListener("click", () => {
  if (settings.mode !== "letters") return;
  revealed = true;
  renderLetters();
});

// --- Keyboard routing --------------------------------------------------------
async function unlockAudio() {
  await sidetone.ensure();
}

window.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  if (settings.mode === "letters") {
    handleLettersKey(e);
    return;
  }
  // keying mode — drive the keyer. Any handled key unlocks audio.
  if (settings.keyType === "straight") {
    if (e.code === settings.keys.straight) {
      e.preventDefault();
      unlockAudio();
      straight.down();
    }
  } else {
    if (e.code === settings.keys.dit) {
      e.preventDefault();
      unlockAudio();
      iambic.setDit(true);
    } else if (e.code === settings.keys.dah) {
      e.preventDefault();
      unlockAudio();
      iambic.setDah(true);
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (isTyping(e) || settings.mode !== "keying") return;
  if (settings.keyType === "straight") {
    if (e.code === settings.keys.straight) straight.up();
  } else {
    if (e.code === settings.keys.dit) iambic.setDit(false);
    else if (e.code === settings.keys.dah) iambic.setDah(false);
  }
});

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "SELECT" ||
      t.tagName === "TEXTAREA")
  );
}

// --- Mode --------------------------------------------------------------------
function applyMode() {
  playing?.cancel();
  iambic.stop();
  straight.stop();
  const letters = settings.mode === "letters";
  renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: !letters });
  hintsEl.textContent = letters
    ? "Listen, then type the letter · Space replays · / shows the code · click ? to reveal"
    : "Tap , for dit · . for dah · hold/squeeze for iambic";
  if (letters) {
    newLetter();
  } else {
    decoder.reset();
  }
}

// --- Settings controls -------------------------------------------------------
function applyTiming() {
  const th = thresholds(settings.wpm);
  const k = settings.gapTolerance;
  decoder.setGaps(th.gapLetter * k, th.gapWord * k);
}

function persist() {
  Settings.save(settings);
}

modeEl.value = settings.mode;
keyTypeEl.value = settings.keyType;
iambicModeEl.value = settings.iambicMode;
languageEl.value = settings.language;
wpmEl.value = String(settings.wpm);
wpmValEl.textContent = String(settings.wpm);
gapEl.value = String(settings.gapTolerance);
gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
volumeEl.value = String(settings.volume);
toneEl.value = String(settings.toneHz);
toneValEl.textContent = String(settings.toneHz);

modeEl.addEventListener("change", () => {
  settings.mode = modeEl.value as Settings.Mode;
  applyMode();
  persist();
});

keyTypeEl.addEventListener("change", () => {
  settings.keyType = keyTypeEl.value as Settings.KeyType;
  iambic.stop();
  straight.stop();
  persist();
});

iambicModeEl.addEventListener("change", () => {
  settings.iambicMode = iambicModeEl.value as Settings.Settings["iambicMode"];
  iambic.setMode(settings.iambicMode);
  persist();
});

languageEl.addEventListener("change", () => {
  settings.language = languageEl.value as Language;
  decoder.setLanguage(settings.language);
  applyMode(); // re-render cheatsheet + restart the challenge for the new pool
  persist();
});

wpmEl.addEventListener("input", () => {
  settings.wpm = Number(wpmEl.value);
  wpmValEl.textContent = String(settings.wpm);
  applyTiming();
  persist();
});

gapEl.addEventListener("input", () => {
  settings.gapTolerance = Number(gapEl.value);
  gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
  applyTiming();
  persist();
});

volumeEl.addEventListener("input", () => {
  settings.volume = Number(volumeEl.value);
  sidetone.setVolume(settings.volume);
  persist();
});

toneEl.addEventListener("input", () => {
  settings.toneHz = Number(toneEl.value);
  toneValEl.textContent = String(settings.toneHz);
  sidetone.setTone(settings.toneHz);
  persist();
});

clearEl.addEventListener("click", () => {
  if (settings.mode === "letters") newLetter();
  else decoder.reset();
});

// --- Init --------------------------------------------------------------------
applyTiming();
applyMode();
