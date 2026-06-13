import { test, expect } from "bun:test";
import { farnsworth, ditMs } from "./src/timing";

test("farnsworth: equal speeds give standard PARIS spacing", () => {
  const t = farnsworth(20, 20);
  expect(t.ditMs).toBeCloseTo(60); // 1200/20
  expect(t.letterGapMs).toBeCloseTo(180); // 3 dits
  expect(t.wordGapMs).toBeCloseTo(420); // 7 dits
});

test("farnsworth: faster char speed keeps the dit but widens the gaps", () => {
  const t = farnsworth(20, 10);
  expect(t.ditMs).toBeCloseTo(60); // characters still at 20 wpm
  // Gaps are stretched well beyond the standard 3/7 dits (180/420).
  expect(t.letterGapMs).toBeGreaterThan(180);
  expect(t.wordGapMs).toBeGreaterThan(420);
});

test("farnsworth: a whole PARIS word lasts ~60000/effWpm ms", () => {
  const c = 25,
    s = 8;
  const t = farnsworth(c, s);
  // PARIS = 31 character units (at char dit) + 19 spacing units.
  // spacing unit = letterGapMs/3 = wordGapMs/7.
  const unit = t.letterGapMs / 3;
  const wordMs = 31 * t.ditMs + 19 * unit;
  expect(wordMs).toBeCloseTo(60000 / s, 0);
});

test("farnsworth: char speed never slower than effective", () => {
  // charWpm < effWpm clamps to effWpm (no negative spacing) → standard at effWpm
  const t = farnsworth(5, 15);
  expect(t.ditMs).toBeCloseTo(ditMs(15));
  expect(t.letterGapMs).toBeCloseTo(3 * ditMs(15));
});
