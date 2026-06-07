// Target selection for the play mode: single characters, or real words when
// the word-length cap allows (English only; RU has no embedded word list).

import { tableFor, type Language } from "../morse";
import { PUNCT } from "../cheatsheet";

export type WordPools = { common: string[]; cw: string[] };

type Rng = () => number;

/** Chance of drawing from the CW jargon pool instead of common words. */
export const CW_CHANCE = 1 / 3;

export function letterPool(lang: Language): string[] {
    return Object.keys(tableFor(lang)).filter(
        (c) => /[\p{L}\p{N}]/u.test(c) || PUNCT.includes(c),
    );
}

function pick(pool: readonly string[], prev: string | null, rng: Rng): string {
    let next: string;
    do {
        next = pool[Math.floor(rng() * pool.length)]!;
    } while (pool.length > 1 && next === prev);
    return next;
}

/**
 * Pick the next target. `n` caps the word length: 1 plays single characters;
 * 2+ plays an English word of 2..n letters, preferring CW jargon
 * (abbreviations, Q-codes) about a third of the time.
 */
export function pickTarget(
    pools: WordPools,
    lang: Language,
    n: number,
    prev: string | null,
    rng: Rng = Math.random,
): string {
    if (n <= 1 || lang === "ru") return pick(letterPool(lang), prev, rng);
    const inRange = (w: string) => w.length >= 2 && w.length <= n;
    const cw = pools.cw.filter(inRange);
    const common = pools.common.filter(inRange);
    const pool = rng() < CW_CHANCE && cw.length ? cw : common;
    return pick(pool.length ? pool : letterPool(lang), prev, rng);
}
