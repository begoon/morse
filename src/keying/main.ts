// Keying mode: iambic paddle (Curtis Mode A/B) or straight key drives the
// sidetone and a silence-timed decoder showing the decoded text live.

import "../styles.css";
import { Decoder } from "../decoder";
import { Sidetone } from "../audio";
import { IambicKeyer } from "../keyer-iambic";
import { StraightKeyer } from "../keyer-straight";
import { renderCheatsheet } from "../cheatsheet";
import { ditMs, thresholds } from "../timing";
import * as Settings from "../settings";

const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

const outputEl = document.getElementById("output")!;
const patternEl = document.getElementById("pattern")!;
const hintsEl = document.getElementById("hints")!;
const cheatsheetEl = document.getElementById("cheatsheet")!;
const clearEl = document.getElementById("clear") as HTMLButtonElement;

const th = thresholds(settings.wpm);
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: th.gapLetter * settings.gapTolerance,
  wordGapMs: th.gapWord * settings.gapTolerance,
  maxChars: 40,
  onChange: (s) => {
    outputEl.textContent = s.text || " ";
    patternEl.textContent = s.pattern || " ";
  },
});

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

async function unlockAudio() {
  await sidetone.ensure();
}

window.addEventListener("keydown", (e) => {
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
  if (settings.keyType === "straight") {
    if (e.code === settings.keys.straight) straight.up();
  } else {
    if (e.code === settings.keys.dit) iambic.setDit(false);
    else if (e.code === settings.keys.dah) iambic.setDah(false);
  }
});

clearEl.addEventListener("click", () => decoder.reset());

// --- Init --------------------------------------------------------------------
renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: true });
hintsEl.textContent =
  settings.keyType === "straight"
    ? "Hold Space to key · short press = dit, long press = dah"
    : "Tap , for dit · . for dah · hold/squeeze for iambic";
decoder.reset();
