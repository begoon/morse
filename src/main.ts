// Wires the DOM, settings, audio, keyers, decoder and visuals together.

import "./styles.css";
import { Decoder } from "./decoder";
import { Sidetone } from "./audio";
import { IambicKeyer } from "./keyer-iambic";
import { StraightKeyer } from "./keyer-straight";
import { renderSchematic, setActive } from "./visuals";
import { renderCheatsheet } from "./cheatsheet";
import { ditMs, thresholds } from "./timing";
import * as Settings from "./settings";
import type { Language } from "./morse";

const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

// --- DOM ---------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const outputEl = $("output");
const patternEl = $("pattern");
const schematicEl = $("schematic");
const keyTypeEl = $<HTMLSelectElement>("keyType");
const languageEl = $<HTMLSelectElement>("language");
const wpmEl = $<HTMLInputElement>("wpm");
const wpmValEl = $("wpmVal");
const gapEl = $<HTMLInputElement>("gap");
const gapValEl = $("gapVal");
const volumeEl = $<HTMLInputElement>("volume");
const toneEl = $<HTMLInputElement>("tone");
const toneValEl = $("toneVal");
const legendEl = $("legend");
const clearEl = $<HTMLButtonElement>("clear");
const cheatsheetEl = $("cheatsheet");

// --- Decoder -----------------------------------------------------------------
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: thresholds(settings.wpm).gapLetter,
  wordGapMs: thresholds(settings.wpm).gapWord,
  maxChars: 40,
  onChange: (s) => {
    outputEl.textContent = s.text || " ";
    patternEl.textContent = s.pattern || " ";
  },
});

// --- Keyers ------------------------------------------------------------------
const onActive = (el: "." | "-" | null) =>
  setActive(schematicEl, settings.keyType, el);

const iambic = new IambicKeyer({
  ditMs: () => ditMs(settings.wpm),
  toneOn: () => sidetone.keyOn(),
  toneOff: () => sidetone.keyOff(),
  onElementStart: () => decoder.elementStart(),
  onElement: (t) => decoder.element(t),
  setActive: onActive,
});

const straight = new StraightKeyer({
  wpm: () => settings.wpm,
  toneOn: () => sidetone.keyOn(),
  toneOff: () => sidetone.keyOff(),
  onElementStart: () => decoder.elementStart(),
  onElement: (t) => decoder.element(t),
  setActive: onActive,
});

// --- Keyboard routing --------------------------------------------------------
async function unlockAudio() {
  await sidetone.ensure();
}

window.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  // Any handled key counts as the user gesture that unlocks audio.
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
  if (isTyping(e)) return;
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

// --- Settings controls -------------------------------------------------------
function applyTiming() {
  const th = thresholds(settings.wpm);
  const k = settings.gapTolerance;
  decoder.setGaps(th.gapLetter * k, th.gapWord * k);
}

function refreshKeyMode() {
  iambic.stop();
  straight.stop();
  renderSchematic(schematicEl, settings.keyType);
  legendEl.textContent =
    settings.keyType === "straight"
      ? "Hold Space — short = dit, long = dah"
      : "Tap , for dit · Tap . for dah · hold or squeeze for iambic";
}

function persist() {
  Settings.save(settings);
}

keyTypeEl.value = settings.keyType;
languageEl.value = settings.language;
wpmEl.value = String(settings.wpm);
wpmValEl.textContent = String(settings.wpm);
gapEl.value = String(settings.gapTolerance);
gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
volumeEl.value = String(settings.volume);
toneEl.value = String(settings.toneHz);
toneValEl.textContent = String(settings.toneHz);

keyTypeEl.addEventListener("change", () => {
  settings.keyType = keyTypeEl.value as Settings.KeyType;
  refreshKeyMode();
  persist();
});

languageEl.addEventListener("change", () => {
  settings.language = languageEl.value as Language;
  decoder.setLanguage(settings.language);
  renderCheatsheet(cheatsheetEl, settings.language);
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

clearEl.addEventListener("click", () => decoder.reset());

// --- Init --------------------------------------------------------------------
applyTiming();
refreshKeyMode();
renderCheatsheet(cheatsheetEl, settings.language);
decoder.reset();
