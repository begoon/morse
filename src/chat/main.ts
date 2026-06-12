// AI Morse chat: the operator keys a message (left), and when they key the
// over/end prosign (K, KK, or "."), it's sent to the AI, whose reply is shown as
// letters and/or Morse (per two checkboxes) and sounded out as CW (right).
//
// Input wiring (keyboard / on-screen buttons / USB mouse-paddle) mirrors the
// Keying page; the AI call lives in ./ai and the send-trigger in ./trigger.

import "../styles.css";
import { Decoder } from "../decoder";
import { Sidetone } from "../audio";
import { IambicKeyer } from "../keyer-iambic";
import { StraightKeyer } from "../keyer-straight";
import { ditMs, thresholds, UNITS } from "../timing";
import { encodeWord } from "../morse";
import { playPattern, type PlayHandle } from "../player";
import * as Settings from "../settings";
import { complete, SYSTEM_PROMPT, type ChatMessage } from "./ai";
import { detectSend } from "./trigger";

const settings = Settings.load();
const sidetone = new Sidetone();
sidetone.setTone(settings.toneHz);
sidetone.setVolume(settings.volume);

const youLogEl = document.getElementById("youLog")!;
const aiLogEl = document.getElementById("aiLog")!;
const liveEl = document.getElementById("live")!;
const ditBtn = document.getElementById("key-dit") as HTMLButtonElement;
const dahBtn = document.getElementById("key-dah") as HTMLButtonElement;
const clearEl = document.getElementById("clear") as HTMLButtonElement;
const showLettersEl = document.getElementById("showLetters") as HTMLInputElement;
const showMorseEl = document.getElementById("showMorse") as HTMLInputElement;

// Running transcript sent to the AI for context (system prompt first).
const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
let awaiting = false;

// --- Decoder / keyer (the operator's input) ---------------------------------
const th = thresholds(settings.wpm);
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: th.gapLetter * settings.gapTolerance,
  wordGapMs: th.gapWord * settings.gapTolerance,
  maxChars: 120,
  onChange: (s) => {
    liveEl.textContent = (s.text + (s.pattern ? " " + s.pattern : "")) || " ";
  },
  onChar: () => {
    if (awaiting) return; // ignore input while a reply is in flight
    const { send, body } = detectSend(decoder.state.text);
    if (send) sendMessage(body);
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

function unlockAudio() {
  void sidetone.ensure();
}

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

// On-screen keypad (touch + mouse), matching the Keying page.
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
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); down(); }, { passive: false });
  const touchUp = (e: TouchEvent) => { e.preventDefault(); up(); };
  btn.addEventListener("touchend", touchUp, { passive: false });
  btn.addEventListener("touchcancel", touchUp, { passive: false });
  btn.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    down();
  });
  window.addEventListener("mouseup", up);
}
wireKeypadButton(ditBtn, "dit");
wireKeypadButton(dahBtn, "dah");

clearEl.addEventListener("click", () => decoder.reset());

// USB mouse-paddle: left button = dit, right = dah (paddle mode only).
function mousePaddle(button: number): "dit" | "dah" | null {
  if (settings.keyType !== "paddle") return null;
  if (button === 0) return "dit";
  if (button === 2) return "dah";
  return null;
}
function isControl(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.("button, a, summary, input, label");
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
  if (which) releaseElement(which);
});
window.addEventListener("contextmenu", (e) => {
  if (settings.keyType === "paddle" && !isControl(e.target)) e.preventDefault();
});

// --- Conversation ------------------------------------------------------------
function addBubble(log: HTMLElement, text: string, cls: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "chat-msg " + cls;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

/** Render the AI text into "<letters>" / "<morse>" per the display checkboxes. */
function morseOf(text: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .map((w) => encodeWord(w, settings.language))
    .filter(Boolean)
    .join("  /  ");
}
function renderAiBubble(el: HTMLElement) {
  const text = el.dataset.text ?? "";
  el.textContent = "";
  const showLetters = settings.chatShowLetters || !settings.chatShowMorse;
  if (showLetters) el.appendChild(document.createTextNode(text));
  if (settings.chatShowMorse) {
    const m = document.createElement("span");
    m.className = "morse";
    m.textContent = morseOf(text);
    el.appendChild(m);
  }
}

function sendMessage(body: string) {
  stopPlayback();
  addBubble(youLogEl, body, "you");
  decoder.reset();
  messages.push({ role: "user", content: body });

  awaiting = true;
  const bubble = addBubble(aiLogEl, "…", "ai pending");
  const provider = settings.aiProvider;
  const apiKey =
    provider === "openai"
      ? settings.openaiKey
      : provider === "anthropic"
        ? settings.anthropicKey
        : settings.geminiKey;

  complete(provider, settings.aiModel, apiKey, messages)
    .then((reply) => {
      messages.push({ role: "assistant", content: reply });
      bubble.classList.remove("pending");
      bubble.dataset.text = reply;
      renderAiBubble(bubble);
      aiLogEl.scrollTop = aiLogEl.scrollHeight;
      void playReply(reply);
    })
    .catch((err: unknown) => {
      bubble.classList.remove("pending");
      bubble.classList.add("error");
      bubble.textContent = err instanceof Error ? err.message : String(err);
    })
    .finally(() => {
      awaiting = false;
    });
}

// --- CW playback of the reply ------------------------------------------------
let playTimers: ReturnType<typeof setTimeout>[] = [];
let playHandles: PlayHandle[] = [];
function stopPlayback() {
  for (const id of playTimers) clearTimeout(id);
  playTimers = [];
  for (const h of playHandles) h.cancel();
  playHandles = [];
}
function patternDuration(pattern: string, dit: number): number {
  let t = 0;
  for (const sym of pattern) {
    if (sym === " ") t += 2 * dit;
    else t += (sym === "." ? 1 : 3) * dit + dit;
  }
  return t;
}
async function playReply(text: string) {
  stopPlayback();
  await sidetone.ensure();
  const dit = ditMs(settings.wpm);
  let offset = 0;
  for (const word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    const pattern = encodeWord(word, settings.language);
    if (!pattern) continue;
    const start = offset;
    playTimers.push(
      setTimeout(() => playHandles.push(playPattern(sidetone, pattern, dit)), start),
    );
    offset += patternDuration(pattern, dit) + UNITS.wordGap * dit;
  }
}

// --- Display checkboxes ------------------------------------------------------
showLettersEl.checked = settings.chatShowLetters;
showMorseEl.checked = settings.chatShowMorse;
function onToggle() {
  settings.chatShowLetters = showLettersEl.checked;
  settings.chatShowMorse = showMorseEl.checked;
  Settings.save(settings);
  for (const el of aiLogEl.querySelectorAll<HTMLElement>(".chat-msg.ai:not(.error):not(.pending)")) {
    renderAiBubble(el);
  }
}
showLettersEl.addEventListener("change", onToggle);
showMorseEl.addEventListener("change", onToggle);

decoder.reset();
