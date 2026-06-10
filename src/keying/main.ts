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
  maxChars: 240,
  onChange: (s) => {
    outputEl.textContent = s.text || " ";
    // Keep the latest copy visible as the multi-line pane fills and scrolls.
    outputEl.scrollTop = outputEl.scrollHeight;
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

// On-screen keypad: hold-to-key. Touch events (not pointer events) are used so
// two paddle buttons can be held at once — iOS Safari delivers only a single
// pointer and fires pointercancel on a second finger, which broke iambic
// squeeze. Each finger lands on its own button with its own touchstart, so
// holding both `.` and `-` squeezes the keyer (alternating di-dah). A mouse
// fallback covers the desktop; preventDefault on touchstart suppresses the
// synthetic mouse events so a press is never counted twice.
function wireKeypadButton(btn: HTMLButtonElement, which: "dit" | "dah") {
  let active = false;
  const down = () => {
    if (active) return;
    active = true;
    btn.classList.add("pressed");
    pressElement(which);
  };
  const up = () => {
    if (!active) return;
    active = false;
    btn.classList.remove("pressed");
    releaseElement(which);
  };

  btn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      down();
    },
    { passive: false },
  );
  const touchUp = (e: TouchEvent) => {
    e.preventDefault();
    up();
  };
  btn.addEventListener("touchend", touchUp, { passive: false });
  btn.addEventListener("touchcancel", touchUp, { passive: false });

  // Mouse (desktop): release on the window so dragging off the button still
  // ends the press.
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    down();
  });
  window.addEventListener("mouseup", up);
}
wireKeypadButton(ditBtn, "dit");
wireKeypadButton(dahBtn, "dah");

clearEl.addEventListener("click", () => decoder.reset());

// USB "keyer" that presents as a mouse: left button (0) = left paddle (dit),
// right button (2) = right paddle (dah). Active in paddle mode. The on-screen
// controls (buttons, nav links, cheatsheet toggle) are left alone so normal
// clicking still works; mouseup always releases so a paddle can't stick.
function mousePaddle(button: number): "dit" | "dah" | null {
  if (settings.keyType !== "paddle") return null;
  if (button === 0) return "dit";
  if (button === 2) return "dah";
  return null;
}
function isControl(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.("button, a, summary");
}

window.addEventListener("mousedown", (e) => {
  const which = mousePaddle(e.button);
  if (!which || isControl(e.target)) return;
  e.preventDefault();
  unlockAudio();
  pressElement(which);
});
window.addEventListener("mouseup", (e) => {
  const which = mousePaddle(e.button);
  if (which) releaseElement(which); // release even if the cursor is over a control
});
// Keep the right paddle from opening the context menu.
window.addEventListener("contextmenu", (e) => {
  if (settings.keyType === "paddle" && !isControl(e.target)) e.preventDefault();
});

// --- Init --------------------------------------------------------------------
renderCheatsheet(cheatsheetEl, settings.language, { showPatterns: true });
decoder.reset();
