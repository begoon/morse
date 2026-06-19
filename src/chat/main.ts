// AI Morse chat: the operator keys a message (left), and when they key the
// over/end prosign (K, KK, or "."), it's sent to the AI, whose reply is shown as
// letters and/or Morse (per two checkboxes) and sounded out as CW (right).
//
// Input wiring (keyboard / on-screen buttons / USB mouse-paddle) mirrors the
// Keying page; the AI call lives in ./ai, the send-trigger in ./trigger, and the
// HH error-prosign highlighting in ./errors.

import "../styles.css";
import { Decoder } from "../decoder";
import { Sidetone } from "../audio";
import { IambicKeyer } from "../keyer-iambic";
import { StraightKeyer } from "../keyer-straight";
import { ditMs, thresholds, farnsworth } from "../timing";
import { encode } from "../morse";
import * as Settings from "../settings";
import { complete, SYSTEM_PROMPT, type ChatMessage } from "./ai";
import { detectSend } from "./trigger";
import { esc, markErrors } from "./errors";

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
let lastReply: string | null = null; // most recent AI answer, for "r" replay
let lastBubble: HTMLElement | null = null; // its bubble, for replay highlighting

// --- Decoder / keyer (the operator's input) ---------------------------------
const th = thresholds(settings.wpm);
const decoder = new Decoder({
  language: settings.language,
  letterGapMs: th.gapLetter * settings.gapTolerance,
  wordGapMs: th.gapWord * settings.gapTolerance,
  maxChars: 120,
  onChange: (s) => {
    const html = markErrors(s.text) + (s.pattern ? " " + esc(s.pattern) : "");
    liveEl.innerHTML = html || " ";
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
  // "c" clears the in-progress input.
  if (e.code === "KeyC") {
    e.preventDefault();
    decoder.reset();
    return;
  }
  // Space or "r" replays the last AI answer as CW.
  if (e.code === "Space" || e.code === "KeyR") {
    e.preventDefault();
    if (lastReply) void playReply(lastReply, lastBubble);
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
function addBubble(log: HTMLElement, text: string, cls: string, html = false): HTMLElement {
  const el = document.createElement("div");
  el.className = "chat-msg " + cls;
  if (html) el.innerHTML = markErrors(text);
  else el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

// Flat per-word/per-letter/per-element model of the reply, skipping characters
// not in the alphabet table. Shared by rendering and playback so each element's
// span (keyed by letter index `li` + element index `ei`) lines up with the tone
// being played, enabling the synchronized highlight.
type Letter = { li: number; char: string; elements: string[] };
function buildModel(text: string): Letter[][] {
  let li = 0;
  return text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((ch) => {
          const pattern = encode(ch, settings.language);
          return pattern ? { li: li++, char: ch, elements: [...pattern] } : null;
        })
        .filter((l): l is Letter => l !== null),
    )
    .filter((w) => w.length > 0);
}

function renderAiBubble(el: HTMLElement) {
  const text = el.dataset.text ?? "";
  el.textContent = "";
  const model = buildModel(text);
  const showLetters = settings.chatShowLetters || !settings.chatShowMorse;
  if (showLetters) {
    const line = document.createElement("div");
    line.className = "ai-letters";
    model.forEach((word, wi) => {
      if (wi) line.appendChild(document.createTextNode(" "));
      for (const l of word) {
        const s = document.createElement("span");
        s.className = "ltr";
        s.dataset.li = String(l.li);
        s.textContent = l.char;
        line.appendChild(s);
      }
    });
    el.appendChild(line);
  }
  if (settings.chatShowMorse) {
    const line = document.createElement("div");
    line.className = "ai-morse morse";
    model.forEach((word, wi) => {
      if (wi) line.appendChild(document.createTextNode("  /  "));
      word.forEach((l, k) => {
        if (k) line.appendChild(document.createTextNode(" "));
        const lspan = document.createElement("span");
        lspan.className = "m-ltr";
        lspan.dataset.li = String(l.li);
        l.elements.forEach((e, ei) => {
          const es = document.createElement("span");
          es.className = "m-el";
          es.dataset.li = String(l.li);
          es.dataset.ei = String(ei);
          es.textContent = e;
          lspan.appendChild(es);
        });
        line.appendChild(lspan);
      });
    });
    el.appendChild(line);
  }
}

function sendMessage(body: string) {
  stopPlayback();
  addBubble(youLogEl, body, "you", true); // flag HH (error prosign) in red
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
      lastReply = reply;
      lastBubble = bubble;
      bubble.classList.remove("pending");
      bubble.dataset.text = reply;
      renderAiBubble(bubble);
      aiLogEl.scrollTop = aiLogEl.scrollHeight;
      void playReply(reply, bubble);
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

// --- CW playback of the reply, with letter/element highlighting --------------
let playTimers: ReturnType<typeof setTimeout>[] = [];
let playingBubble: HTMLElement | null = null;

function clearHighlights(bubble: HTMLElement | null) {
  bubble
    ?.querySelectorAll(".active, .playing")
    .forEach((e) => e.classList.remove("active", "playing"));
}
function setActiveLetter(bubble: HTMLElement | null, li: number) {
  if (!bubble) return;
  bubble.querySelectorAll(".active").forEach((e) => e.classList.remove("active"));
  bubble
    .querySelectorAll(`.ltr[data-li="${li}"], .m-ltr[data-li="${li}"]`)
    .forEach((e) => e.classList.add("active"));
}
function setPlaying(bubble: HTMLElement | null, li: number, ei: number, on: boolean) {
  bubble
    ?.querySelectorAll(`.m-el[data-li="${li}"][data-ei="${ei}"]`)
    .forEach((e) => e.classList.toggle("playing", on));
}

function stopPlayback() {
  for (const id of playTimers) clearTimeout(id);
  playTimers = [];
  sidetone.keyOff(); // silence if cancelled mid-element
  clearHighlights(playingBubble);
  playingBubble = null;
}

// Schedule the reply as CW: each element keys the tone on/off and toggles its
// span's highlight at the same instant, so the dit/dah lights up exactly as it
// sounds; the current letter stays highlighted for its whole duration. Timing
// follows Farnsworth (fast characters, gaps widened to the effective speed).
async function playReply(text: string, bubble: HTMLElement | null) {
  stopPlayback();
  await sidetone.ensure();
  playingBubble = bubble;
  const { ditMs: dit, letterGapMs, wordGapMs } = farnsworth(settings.charWpm, settings.wpm);
  const at = (ms: number, fn: () => void) => playTimers.push(setTimeout(fn, ms));
  const model = buildModel(text);
  let t = 0;
  model.forEach((word, wi) => {
    word.forEach((l, k) => {
      at(t, () => setActiveLetter(bubble, l.li));
      l.elements.forEach((e, ei) => {
        const on = (e === "." ? 1 : 3) * dit;
        const start = t;
        at(start, () => {
          sidetone.keyOn();
          setPlaying(bubble, l.li, ei, true);
        });
        at(start + on, () => {
          sidetone.keyOff();
          setPlaying(bubble, l.li, ei, false);
        });
        t += on + dit; // element + 1-dit intra-element gap
      });
      if (k < word.length - 1) t += letterGapMs - dit; // top up to the letter gap
    });
    if (wi < model.length - 1) t += wordGapMs - dit; // top up to the word gap
  });
  at(t, () => clearHighlights(bubble));
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
