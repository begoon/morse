// Word bank shape and target-picking logic for the play mode.

import { describe, expect, test } from "bun:test";
import poolsJson from "./src/play/words.json";
import { CW_CHANCE, letterPool, pickTarget, type WordPools } from "./src/play/words";

const pools = poolsJson as WordPools;

/** Deterministic LCG for reproducible picks. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

describe("words.json", () => {
    test("pools are uppercase and within length bounds", () => {
        expect(pools.common.length).toBeGreaterThanOrEqual(1000);
        expect(pools.cw.length).toBeGreaterThanOrEqual(40);
        for (const w of pools.common) expect(w).toMatch(/^[A-Z]{2,8}$/);
        for (const w of pools.cw) expect(w).toMatch(/^[A-Z0-9]{2,8}$/);
    });

    test("every length 2..8 has common words", () => {
        for (let len = 2; len <= 8; len++) {
            expect(pools.common.some((w) => w.length === len)).toBe(true);
        }
    });
});

describe("pickTarget", () => {
    test("n=1 picks a single character from the letter pool", () => {
        const pool = new Set(letterPool("en"));
        const r = rng(1);
        for (let i = 0; i < 50; i++) {
            const t = pickTarget(pools, "en", 1, null, r);
            expect(t.length).toBe(1);
            expect(pool.has(t)).toBe(true);
        }
    });

    test("ru always picks single characters regardless of n", () => {
        const pool = new Set(letterPool("ru"));
        const r = rng(2);
        for (let i = 0; i < 50; i++) {
            const t = pickTarget(pools, "ru", 6, null, r);
            expect(t.length).toBe(1);
            expect(pool.has(t)).toBe(true);
        }
    });

    test("n>=2 picks words of 2..n letters from the pools", () => {
        const all = new Set([...pools.common, ...pools.cw]);
        const r = rng(3);
        for (const n of [2, 3, 5, 8]) {
            for (let i = 0; i < 50; i++) {
                const t = pickTarget(pools, "en", n, null, r);
                expect(t.length).toBeGreaterThanOrEqual(2);
                expect(t.length).toBeLessThanOrEqual(n);
                expect(all.has(t)).toBe(true);
            }
        }
    });

    test("draws CW jargon when the first roll is under CW_CHANCE", () => {
        // rng yields the CW roll first, then the index roll.
        const rolls = [CW_CHANCE / 2, 0.5];
        let i = 0;
        const t = pickTarget(pools, "en", 4, null, () => rolls[i++ % rolls.length]!);
        expect(pools.cw).toContain(t);
    });

    test("letters mode picks single characters", () => {
        const pool = new Set(letterPool("en"));
        const r = rng(5);
        for (let i = 0; i < 50; i++) {
            const t = pickTarget(pools, "en", 8, null, r, "letters");
            expect(t.length).toBe(1);
            expect(pool.has(t)).toBe(true);
        }
    });

    test("numbers mode picks 5-digit groups", () => {
        const r = rng(6);
        for (let i = 0; i < 50; i++) {
            expect(pickTarget(pools, "en", 1, null, r, "numbers")).toMatch(/^[0-9]{5}$/);
        }
    });

    test("groups mode picks 5-char alphanumeric groups", () => {
        const r = rng(7);
        for (let i = 0; i < 50; i++) {
            expect(pickTarget(pools, "en", 1, null, r, "groups")).toMatch(/^[A-Z0-9]{5}$/);
        }
    });

    test("callsigns mode picks plausible callsigns", () => {
        const r = rng(8);
        for (let i = 0; i < 50; i++) {
            expect(pickTarget(pools, "en", 1, null, r, "callsigns")).toMatch(/^[A-Z]{1,2}[0-9][A-Z]{1,3}$/);
        }
    });

    test("ru falls back to single letters for callsign/group modes", () => {
        const pool = new Set(letterPool("ru"));
        const r = rng(9);
        for (const mode of ["callsigns", "groups"] as const) {
            const t = pickTarget(pools, "ru", 1, null, r, mode);
            expect(t.length).toBe(1);
            expect(pool.has(t)).toBe(true);
        }
    });

    test("avoids repeating the previous target", () => {
        const r = rng(4);
        let prev = pickTarget(pools, "en", 3, null, r);
        for (let i = 0; i < 100; i++) {
            const t = pickTarget(pools, "en", 3, prev, r);
            expect(t).not.toBe(prev);
            prev = t;
        }
    });
});
