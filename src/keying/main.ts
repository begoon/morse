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
const cheatsheetEl = document.getElementById("cheatsheet")!;
const clearEl = document.getElementById("clear") as HTMLButtonElement;
const ditBtn = document.getElementById("key-dit") as HTMLButtonElement;
const dahBtn = document.getElementById("key-dah") as HTMLButtonElement;

const th = thresholds(settings.wpm);
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: th.gapLetter * settings.gapTolerance,
  wordGapMs: th.gapWord * settings.gapTolerance,
  maxChars: 40,
  onChange: (s) => {
    outputEl.textContent = s.text || " ";
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

// Pressing/releasing a keying "element" (the `.` and `-` keypad buttons map to
// the dit/dah paddles, or to the single straight key). Shared by the keyboard
// keys and the on-screen buttons so both drive the keyer identically.
function pressElement(which: "dit" | "dah") {
  unlockAudio();
  if (settings.keyType === "straight") straight.down();
  else if (which === "dit") iambic.setDit(true);
  else iambic.setDah(true);
}

function releaseElement(which: "dit" | "dah") {
  if (settings.keyType === "straight") straight.up();
  else if (which === "dit") iambic.setDit(false);
  else iambic.setDah(false);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (settings.keyType === "straight") {
    if (e.code === settings.keys.straight) {
      e.preventDefault();
      pressElement("dit");
      return;
    }
  } else {
    if (e.code === settings.keys.dit) {
      e.preventDefault();
      pressElement("dit");
      return;
    } else if (e.code === settings.keys.dah) {
      e.preventDefault();
      pressElement("dah");
      return;
    }
  }
  // Space clears the output (unless it's bound as a keying key above).
  if (e.code === "Space") {
    e.preventDefault();
    decoder.reset();
  }
});

window.addEventListener("keyup", (e) => {
  if (settings.keyType === "straight") {
    if (e.code === settings.keys.straight) releaseElement("dit");
  } else {
    if (e.code === settings.keys.dit) releaseElement("dit");
    else if (e.code === settings.keys.dah) releaseElement("dah");
  }
});

// On-screen keypad: hold-to-key with pointer capture so the release still fires
// if the finger slides off the button. preventDefault stops the tap from also
// firing a synthetic click / scrolling / zooming on touch.
function wireKeypadButton(btn: HTMLButtonElement, which: "dit" | "dah") {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    pressElement(which);
  });
  const up = () => releaseElement(which);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
}
wireKeypadButton(ditBtn, "dit");
wireKeypadButton(dahBtn, "dah");

clearEl.addEventListener("click", () => decoder.reset());

// --- Init --------------------------------------------------------------------
renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: true });
decoder.reset();
