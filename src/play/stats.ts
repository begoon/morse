// Per-character copy accuracy, persisted in localStorage. Recorded by play mode
// on every guess so the operator can see which characters to drill.

const STORAGE_KEY = "morse-char-stats";

export type CharStat = { seen: number; correct: number };
export type CharStats = Record<string, CharStat>;

export function load(): CharStats {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as CharStats;
  } catch {
    return {};
  }
}

function save(stats: CharStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable — ignore.
  }
}

/** Record one attempt at `char` (whether the operator copied it correctly). */
export function record(char: string, correct: boolean): void {
  const stats = load();
  const e = stats[char] ?? { seen: 0, correct: 0 };
  e.seen++;
  if (correct) e.correct++;
  stats[char] = e;
  save(stats);
}

export function reset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
