// Validate the committed question banks (rsgb PDFs + hamtrain markdown).

import { describe, expect, test } from "bun:test";
import rsgbJson from "./src/test/questions.json";
import hamtrainJson from "./src/test/questions-hamtrain.json";
import { imageFor } from "./src/test/images";
import type { Question } from "./src/test/quiz";

const rsgb = rsgbJson as Question[];
const hamtrain = hamtrainJson as Question[];
const pool = [...rsgb, ...hamtrain];

describe("question banks", () => {
    test("rsgb: three papers of 26 questions each", () => {
        expect(rsgb.length).toBe(78);
        for (const paper of [1, 2, 3]) {
            const qs = rsgb.filter((q) => q.paper === paper);
            expect(qs.length).toBe(26);
            expect(qs.every((q) => q.tag === "rsgb")).toBe(true);
            expect(qs.map((q) => q.n).sort((a, b) => a - b)).toEqual(
                Array.from({ length: 26 }, (_, i) => i + 1),
            );
        }
    });

    test("hamtrain: seven papers of 26 questions each", () => {
        expect(hamtrain.length).toBe(182);
        for (const paper of [1, 2, 3, 4, 5, 6, 7]) {
            const qs = hamtrain.filter((q) => q.paper === paper);
            expect(qs.length).toBe(26);
            expect(qs.every((q) => q.tag === "hamtrain")).toBe(true);
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

    test("rsgb syllabus refs are present and unique", () => {
        const refs = rsgb.map((q) => q.ref);
        for (const ref of refs) expect(ref).toMatch(/^\d[A-H]\d-\d{4}-\w+$/);
        expect(new Set(refs).size).toBe(refs.length);
    });

    test("mocks 1-6 carry explanations; any explanation present is non-empty", () => {
        // mock7 has no explanations; the other six papers do.
        for (const q of hamtrain.filter((q) => q.paper <= 6)) expect(q.explanation!.length).toBeGreaterThan(0);
        for (const q of pool) if (q.explanation !== undefined) expect(q.explanation.length).toBeGreaterThan(0);
    });

    test("every image reference resolves", () => {
        const withImages = pool.filter((q) => q.image);
        expect(withImages.length).toBe(15); // 4 rsgb + 11 hamtrain
        for (const q of withImages) expect(imageFor(q.image)).toBeDefined();
    });
});
