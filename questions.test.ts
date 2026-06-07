// Validate the committed question bank extracted from the mock-exam PDFs.

import { describe, expect, test } from "bun:test";
import questions from "./src/test/questions.json";
import type { Question } from "./src/test/quiz";

const pool = questions as Question[];

describe("questions.json", () => {
    test("three papers of 26 questions each", () => {
        expect(pool.length).toBe(78);
        for (const paper of [1, 2, 3]) {
            const qs = pool.filter((q) => q.paper === paper);
            expect(qs.length).toBe(26);
            expect(qs.map((q) => q.n).sort((a, b) => a - b)).toEqual(
                Array.from({ length: 26 }, (_, i) => i + 1),
            );
        }
    });

    test("every question has 4 options and a valid answer", () => {
        for (const q of pool) {
            expect(q.options.length).toBe(4);
            expect(q.answer).toBeGreaterThanOrEqual(0);
            expect(q.answer).toBeLessThanOrEqual(3);
            expect(q.question.length).toBeGreaterThan(0);
            for (const o of q.options) expect(o.length).toBeGreaterThan(0);
        }
    });

    test("syllabus refs are present and unique", () => {
        const refs = pool.map((q) => q.ref);
        for (const ref of refs) expect(ref).toMatch(/^\d[A-H]\d-\d{4}-\w+$/);
        expect(new Set(refs).size).toBe(refs.length);
    });
});
