// Pure-logic tests for the mock exam runner.

import { describe, expect, test } from "bun:test";
import rsgbJson from "./src/test/questions.json";
import hamtrainJson from "./src/test/questions-hamtrain.json";
import { buildRun, grade, migratePaper, type Question, type Settings } from "./src/test/quiz";

const pool = [...(rsgbJson as Question[]), ...(hamtrainJson as Question[])];

/** Unique identity of a pool question. */
const key = (q: Question) => `${q.tag}:${q.paper}:${q.n}`;

/** Deterministic LCG so shuffle-dependent tests are reproducible. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

const settings = (over: Partial<Settings>): Settings => ({
    paper: { tag: "rsgb", n: 1 },
    combinedAll: false,
    shuffleQuestions: false,
    shuffleAnswers: false,
    feedback: "immediate",
    ...over,
});

describe("buildRun", () => {
    test("single rsgb paper, no shuffles: paper order, original options", () => {
        const run = buildRun(pool, settings({ paper: { tag: "rsgb", n: 2 } }));
        expect(run.length).toBe(26);
        expect(run.map((q) => q.source.tag)).toEqual(Array(26).fill("rsgb"));
        expect(run.map((q) => q.source.paper)).toEqual(Array(26).fill(2));
        expect(run.map((q) => q.source.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
        for (const q of run) {
            expect(q.options).toEqual(q.source.options);
            expect(q.answer).toBe(q.source.answer);
        }
    });

    test("single hamtrain paper selects only that paper", () => {
        const run = buildRun(pool, settings({ paper: { tag: "hamtrain", n: 4 } }));
        expect(run.length).toBe(26);
        expect(run.map((q) => q.source.tag)).toEqual(Array(26).fill("hamtrain"));
        expect(run.map((q) => q.source.paper)).toEqual(Array(26).fill(4));
        expect(run.map((q) => q.source.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    });

    test("question shuffle keeps the same 26 questions", () => {
        const run = buildRun(pool, settings({ paper: { tag: "hamtrain", n: 1 }, shuffleQuestions: true }), rng(7));
        expect(run.length).toBe(26);
        const keys = run.map((q) => key(q.source)).sort();
        const expected = pool.filter((q) => q.tag === "hamtrain" && q.paper === 1).map(key).sort();
        expect(keys).toEqual(expected);
    });

    test("answer shuffle preserves the correct option text", () => {
        const run = buildRun(pool, settings({ paper: { tag: "rsgb", n: 3 }, shuffleAnswers: true }), rng(42));
        for (const q of run) {
            expect(q.options[q.answer]).toBe(q.source.options[q.source.answer]!);
            expect([...q.options].sort()).toEqual([...q.source.options].sort());
        }
    });

    test("combined sample: 26 distinct questions mixed across tags, stable order", () => {
        const run = buildRun(pool, settings({ paper: "combined" }), rng(1));
        expect(run.length).toBe(26);
        const keys = run.map((q) => key(q.source));
        expect(new Set(keys).size).toBe(26);
        // A 26-question sample from all 9 papers should span both sources.
        expect(new Set(run.map((q) => q.source.tag)).size).toBe(2);
        // Without question shuffle the sample is sorted by tag, paper, number.
        const order = run.map((q) =>
            `${q.source.tag}:${String(q.source.paper).padStart(2, "0")}:${String(q.source.n).padStart(2, "0")}`,
        );
        expect(order).toEqual([...order].sort());
    });

    test("combined all: every question from all 9 papers once", () => {
        const run = buildRun(pool, settings({ paper: "combined", combinedAll: true }));
        expect(run.length).toBe(234);
        expect(new Set(run.map((q) => key(q.source))).size).toBe(234);
    });
});

describe("migratePaper", () => {
    test("old numeric papers map to rsgb", () => {
        expect(migratePaper(2)).toEqual({ tag: "rsgb", n: 2 });
    });
    test("combined and tagged papers pass through", () => {
        expect(migratePaper("combined")).toBe("combined");
        expect(migratePaper({ tag: "hamtrain", n: 5 })).toEqual({ tag: "hamtrain", n: 5 });
    });
    test("garbage falls back to the default", () => {
        expect(migratePaper(undefined)).toEqual({ tag: "rsgb", n: 1 });
        expect(migratePaper({ tag: "nope", n: 1 })).toEqual({ tag: "rsgb", n: 1 });
    });
});

describe("grade", () => {
    test("scores correct picks and counts unanswered as wrong", () => {
        const run = buildRun(pool, settings({ paper: { tag: "rsgb", n: 1 } }));
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
        const run = buildRun(pool, settings({ paper: { tag: "hamtrain", n: 6 } }));
        const g = grade(run, run.map((q) => (q.answer + 1) % 4));
        expect(g.correct).toBe(0);
        expect(g.pass).toBe(false);
    });

    test("pass mark scales to the all-questions run", () => {
        const run = buildRun(pool, settings({ paper: "combined", combinedAll: true }));
        const g = grade(run, run.map((q) => q.answer));
        expect(g.total).toBe(234);
        expect(g.passMark).toBe(171); // ceil(234 * 19/26)
        expect(g.pass).toBe(true);
        expect(g.percent).toBe(100);
    });
});
