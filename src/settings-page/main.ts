// Settings page: edits the shared localStorage settings used by all pages.

import "../styles.css";
import type { Language } from "../morse";
import * as Settings from "../settings";

const settings = Settings.load();

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const languageEl = $<HTMLSelectElement>("language");
const practiceModeEl = $<HTMLSelectElement>("practiceMode");
const wordLengthEl = $<HTMLInputElement>("wordLength");
const wordLengthValEl = $("wordLengthVal");
const wpmEl = $<HTMLInputElement>("wpm");
const charWpmEl = $<HTMLInputElement>("charWpm");
const gapEl = $<HTMLInputElement>("gap");
const gapValEl = $("gapVal");
const autoRevealEl = $<HTMLInputElement>("autoReveal");
const autoRevealValEl = $("autoRevealVal");
const keyTypeEl = $<HTMLSelectElement>("keyType");
const iambicModeEl = $<HTMLSelectElement>("iambicMode");
const volumeEl = $<HTMLInputElement>("volume");
const toneEl = $<HTMLInputElement>("tone");
const toneValEl = $("toneVal");
const aiProviderEl = $<HTMLSelectElement>("aiProvider");
const aiModelEl = $<HTMLInputElement>("aiModel");
const aiModelsEl = $<HTMLDataListElement>("aiModels");
const openaiKeyEl = $<HTMLInputElement>("openaiKey");
const anthropicKeyEl = $<HTMLInputElement>("anthropicKey");
const geminiKeyEl = $<HTMLInputElement>("geminiKey");

// Suggested models per provider (free text still allowed).
const MODELS: Record<Settings.AiProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-opus-4-8", "claude-haiku-4-5", "claude-sonnet-4-6"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-flash"],
};
const setModelSuggestions = (provider: Settings.AiProvider) => {
  aiModelsEl.innerHTML = "";
  for (const m of MODELS[provider]) {
    const opt = document.createElement("option");
    opt.value = m;
    aiModelsEl.appendChild(opt);
  }
};

const wordLengthLabel = (n: number) => (n <= 1 ? "1 letter" : `up to ${n}`);

languageEl.value = settings.language;
practiceModeEl.value = settings.practiceMode;
wordLengthEl.value = String(settings.wordLength);
wordLengthValEl.textContent = wordLengthLabel(settings.wordLength);
wpmEl.value = String(settings.wpm);
charWpmEl.value = String(settings.charWpm);
gapEl.value = String(settings.gapTolerance);
gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
const autoRevealLabel = (s: number) => (s <= 0 ? "Off" : `${s}s`);
autoRevealEl.value = String(settings.autoRevealSec);
autoRevealValEl.textContent = autoRevealLabel(settings.autoRevealSec);
keyTypeEl.value = settings.keyType;
iambicModeEl.value = settings.iambicMode;
volumeEl.value = String(settings.volume);
toneEl.value = String(settings.toneHz);
toneValEl.textContent = String(settings.toneHz);
aiProviderEl.value = settings.aiProvider;
setModelSuggestions(settings.aiProvider);
aiModelEl.value = settings.aiModel;
openaiKeyEl.value = settings.openaiKey;
anthropicKeyEl.value = settings.anthropicKey;
geminiKeyEl.value = settings.geminiKey;

const persist = () => Settings.save(settings);

languageEl.addEventListener("change", () => {
  settings.language = languageEl.value as Language;
  persist();
});

practiceModeEl.addEventListener("change", () => {
  settings.practiceMode = practiceModeEl.value as Settings.PracticeMode;
  persist();
});

wordLengthEl.addEventListener("input", () => {
  const n = Number(wordLengthEl.value);
  if (wordLengthEl.value === "" || !Number.isInteger(n)) return; // partial input while typing
  settings.wordLength = Math.min(8, Math.max(1, n));
  wordLengthValEl.textContent = wordLengthLabel(settings.wordLength);
  persist();
});

// Snap the field back to the persisted (clamped) value when editing ends.
wordLengthEl.addEventListener("change", () => {
  wordLengthEl.value = String(settings.wordLength);
});

wpmEl.addEventListener("input", () => {
  const n = Number(wpmEl.value);
  if (wpmEl.value === "" || !Number.isInteger(n)) return; // partial input while typing
  settings.wpm = Math.min(40, Math.max(3, n));
  persist();
});

// Snap the field back to the persisted (clamped) value when editing ends.
wpmEl.addEventListener("change", () => {
  wpmEl.value = String(settings.wpm);
});

charWpmEl.addEventListener("input", () => {
  const n = Number(charWpmEl.value);
  if (charWpmEl.value === "" || !Number.isInteger(n)) return; // partial input while typing
  settings.charWpm = Math.min(60, Math.max(5, n));
  persist();
});
charWpmEl.addEventListener("change", () => {
  charWpmEl.value = String(settings.charWpm);
});

gapEl.addEventListener("input", () => {
  settings.gapTolerance = Number(gapEl.value);
  gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
  persist();
});

autoRevealEl.addEventListener("input", () => {
  const n = Number(autoRevealEl.value);
  if (autoRevealEl.value === "" || !Number.isInteger(n)) return; // partial input while typing
  settings.autoRevealSec = Math.min(30, Math.max(0, n));
  autoRevealValEl.textContent = autoRevealLabel(settings.autoRevealSec);
  persist();
});

// Snap the field back to the persisted (clamped) value when editing ends.
autoRevealEl.addEventListener("change", () => {
  autoRevealEl.value = String(settings.autoRevealSec);
});

keyTypeEl.addEventListener("change", () => {
  settings.keyType = keyTypeEl.value as Settings.KeyType;
  persist();
});

iambicModeEl.addEventListener("change", () => {
  settings.iambicMode = iambicModeEl.value as Settings.Settings["iambicMode"];
  persist();
});

volumeEl.addEventListener("input", () => {
  settings.volume = Number(volumeEl.value);
  persist();
});

toneEl.addEventListener("input", () => {
  settings.toneHz = Number(toneEl.value);
  toneValEl.textContent = String(settings.toneHz);
  persist();
});

aiProviderEl.addEventListener("change", () => {
  settings.aiProvider = aiProviderEl.value as Settings.AiProvider;
  setModelSuggestions(settings.aiProvider);
  // Reset the model to the new provider's default unless the current one is
  // already valid for it — avoids e.g. asking Gemini for an OpenAI model.
  if (!MODELS[settings.aiProvider].includes(settings.aiModel)) {
    settings.aiModel = MODELS[settings.aiProvider][0]!;
    aiModelEl.value = settings.aiModel;
  }
  persist();
});

aiModelEl.addEventListener("input", () => {
  settings.aiModel = aiModelEl.value.trim();
  persist();
});

openaiKeyEl.addEventListener("input", () => {
  settings.openaiKey = openaiKeyEl.value.trim();
  persist();
});

anthropicKeyEl.addEventListener("input", () => {
  settings.anthropicKey = anthropicKeyEl.value.trim();
  persist();
});

geminiKeyEl.addEventListener("input", () => {
  settings.geminiKey = geminiKeyEl.value.trim();
  persist();
});
