import { test, expect } from "bun:test";
import { classifyPress } from "./src/keyer-straight";
import { IambicKeyer } from "./src/keyer-iambic";
import { ditMs } from "./src/timing";

test("straight key classifies short press as dit", () => {
  // 5 wpm => dit 240ms, threshold 480ms
  expect(classifyPress(100, 5)).toBe(".");
  expect(classifyPress(479, 5)).toBe(".");
  expect(classifyPress(480, 5)).toBe("-");
  expect(classifyPress(900, 5)).toBe("-");
});

// Drive the iambic keyer with real timers but a fast WPM so tests are quick.
function makeIambic() {
  const elements: string[] = [];
  const wpm = 60; // dit = 20ms
  const keyer = new IambicKeyer({
    ditMs: () => ditMs(wpm),
    toneOn: () => {},
    toneOff: () => {},
    onElement: (t) => elements.push(t),
  });
  return { keyer, elements, dit: ditMs(wpm) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a single dit tap produces one dit", async () => {
  const { keyer, elements, dit } = makeIambic();
  keyer.setDit(true);
  keyer.setDit(false);
  await sleep(dit * 4);
  expect(elements).toEqual(["."]);
});

test("holding dit produces repeating dits", async () => {
  const { keyer, elements, dit } = makeIambic();
  keyer.setDit(true);
  await sleep(dit * 8); // room for several dit+gap cycles (40ms each)
  keyer.setDit(false);
  await sleep(dit * 4);
  expect(elements.length).toBeGreaterThanOrEqual(3);
  expect(elements.every((e) => e === ".")).toBe(true);
});

test("squeezing both paddles alternates di-dah", async () => {
  const { keyer, elements, dit } = makeIambic();
  keyer.setDit(true);
  keyer.setDah(true);
  // dit(20)+gap(20)+dah(60)+gap(20)+dit(20)+gap(20) ~ 160ms for 3 elements
  await sleep(dit * 12);
  keyer.setDit(false);
  keyer.setDah(false);
  await sleep(dit * 8);
  expect(elements.length).toBeGreaterThanOrEqual(3);
  // alternating sequence starting with a dit
  for (let i = 0; i < elements.length; i++) {
    expect(elements[i]).toBe(i % 2 === 0 ? "." : "-");
  }
});
