// Settings page: edits the shared localStorage settings used by all pages.

import "../styles.css";
import type { Language } from "../morse";
import * as Settings from "../settings";

const settings = Settings.load();

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const languageEl = $<HTMLSelectElement>("language");
const wordLengthEl = $<HTMLInputElement>("wordLength");
const wordLengthValEl = $("wordLengthVal");
const wpmEl = $<HTMLInputElement>("wpm");
const wpmValEl = $("wpmVal");
const gapEl = $<HTMLInputElement>("gap");
const gapValEl = $("gapVal");
const keyTypeEl = $<HTMLSelectElement>("keyType");
const iambicModeEl = $<HTMLSelectElement>("iambicMode");
const volumeEl = $<HTMLInputElement>("volume");
const toneEl = $<HTMLInputElement>("tone");
const toneValEl = $("toneVal");

const wordLengthLabel = (n: number) => (n <= 1 ? "1 letter" : `up to ${n}`);

languageEl.value = settings.language;
wordLengthEl.value = String(settings.wordLength);
wordLengthValEl.textContent = wordLengthLabel(settings.wordLength);
wpmEl.value = String(settings.wpm);
wpmValEl.textContent = String(settings.wpm);
gapEl.value = String(settings.gapTolerance);
gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
keyTypeEl.value = settings.keyType;
iambicModeEl.value = settings.iambicMode;
volumeEl.value = String(settings.volume);
toneEl.value = String(settings.toneHz);
toneValEl.textContent = String(settings.toneHz);

const persist = () => Settings.save(settings);

languageEl.addEventListener("change", () => {
  settings.language = languageEl.value as Language;
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
  settings.wpm = Number(wpmEl.value);
  wpmValEl.textContent = String(settings.wpm);
  persist();
});

gapEl.addEventListener("input", () => {
  settings.gapTolerance = Number(gapEl.value);
  gapValEl.textContent = `${settings.gapTolerance.toFixed(1)}×`;
  persist();
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
