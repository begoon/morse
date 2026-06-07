// Pure-logic tests for the mock exam runner.

import { describe, expect, test } from "bun:test";
import questions from "./src/test/questions.json";
import { buildRun, grade, shuffle, type Question, type Settings } from "./src/test/quiz";

const pool = questions as Question[];

/** Deterministic LCG so shuffle-dependent tests are reproducible. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

const settings = (over: Partial<Settings>): Settings => ({
    paper: 1,
    combinedAll: false,
    shuffleQuestions: false,
    shuffleAnswers: false,
    feedback: "immediate",
    ...over,
});

describe("buildRun", () => {
    test("single paper, no shuffles: paper order, original options", () => {
        const run = buildRun(pool, settings({ paper: 2 }));
        expect(run.length).toBe(26);
        expect(run.map((q) => q.source.paper)).toEqual(Array(26).fill(2));
        expect(run.map((q) => q.source.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
        for (const q of run) {
            expect(q.options).toEqual(q.source.options);
            expect(q.answer).toBe(q.source.answer);
        }
    });

    test("question shuffle keeps the same 26 questions", () => {
        const run = buildRun(pool, settings({ paper: 1, shuffleQuestions: true }), rng(7));
        expect(run.length).toBe(26);
        const refs = run.map((q) => q.source.ref).sort();
        const expected = pool.filter((q) => q.paper === 1).map((q) => q.ref).sort();
        expect(refs).toEqual(expected);
    });

    test("answer shuffle preserves the correct option text", () => {
        const run = buildRun(pool, settings({ paper: 3, shuffleAnswers: true }), rng(42));
        for (const q of run) {
            expect(q.options[q.answer]).toBe(q.source.options[q.source.answer]!);
            expect([...q.options].sort()).toEqual([...q.source.options].sort());
        }
    });

    test("combined sample: 26 distinct questions across papers, stable order", () => {
        const run = buildRun(pool, settings({ paper: "combined" }), rng(1));
        expect(run.length).toBe(26);
        const refs = run.map((q) => q.source.ref);
        expect(new Set(refs).size).toBe(26);
        // Without question shuffle the sample is sorted by paper then number.
        const order = run.map((q) => q.source.paper * 100 + q.source.n);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    test("combined all: every question once", () => {
        const run = buildRun(pool, settings({ paper: "combined", combinedAll: true }));
        expect(run.length).toBe(78);
        expect(new Set(run.map((q) => q.source.ref)).size).toBe(78);
    });
});

describe("grade", () => {
    test("scores correct picks and counts unanswered as wrong", () => {
        const run = buildRun(pool, settings({ paper: 1 }));
        const picks = run.map((q, i) => (i < 20 ? q.answer : i < 23 ? (q.answer + 1) % 4 : null));
        const g = grade(run, picks);
        expect(g.correct).toBe(20);
        expect(g.total).toBe(26);
        expect(g.unanswered).toBe(3);
        expect(g.passMark).toBe(19);
        expect(g.pass).toBe(true);
        expect(g.percent).toBe(77);
    });

    test("fail below the pass mark", () => {
        const run = buildRun(pool, settings({ paper: 1 }));
        const g = grade(run, run.map((q) => (q.answer + 1) % 4));
        expect(g.correct).toBe(0);
        expect(g.pass).toBe(false);
    });

    test("pass mark scales to the 78-question run", () => {
        const run = buildRun(pool, settings({ paper: "combined", combinedAll: true }));
        const g = grade(run, run.map((q) => q.answer));
        expect(g.total).toBe(78);
        expect(g.passMark).toBe(57); // ceil(78 * 19/26)
        expect(g.pass).toBe(true);
        expect(g.percent).toBe(100);
    });
});
