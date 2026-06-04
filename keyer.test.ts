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
function makeIambic(mode: "A" | "B" = "A") {
  const elements: string[] = [];
  const wpm = 60; // dit = 20ms
  const keyer = new IambicKeyer({
    ditMs: () => ditMs(wpm),
    toneOn: () => {},
    toneOff: () => {},
    onElement: (t) => elements.push(t),
  });
  keyer.setMode(mode);
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

// Squeeze both and release both midway through the second element (the dah,
// 40–100ms at this WPM — a wide, jitter-tolerant window). By then the initial
// paddle-press memories are spent and alternation is driven purely by the
// per-element latch, which is where Mode A and Mode B diverge.
//   Mode A: finish the dah and stop      -> di-dah
//   Mode B: append one trailing dit      -> di-dah-dit
test("Mode A sends no extra element on squeeze release", async () => {
  const { keyer, elements, dit } = makeIambic("A");
  keyer.setDit(true);
  keyer.setDah(true);
  await sleep(dit * 3.5); // inside the dah (40–100ms)
  keyer.setDit(false);
  keyer.setDah(false);
  await sleep(dit * 8);
  expect(elements).toEqual([".", "-"]);
});

test("Mode B sends one extra opposite element on squeeze release", async () => {
  const { keyer, elements, dit } = makeIambic("B");
  keyer.setDit(true);
  keyer.setDah(true);
  await sleep(dit * 3.5); // inside the dah (40–100ms)
  keyer.setDit(false);
  keyer.setDah(false);
  await sleep(dit * 8);
  expect(elements).toEqual([".", "-", "."]);
});

// Paddle state is read at element boundaries, not buffered mid-tone: a stroke
// pressed and released while a tone plays is dropped (you must hold it past the
// boundary to register).
test("a stroke tapped while a tone plays is not buffered", async () => {
  const { keyer, elements, dit } = makeIambic("A");
  keyer.setDah(true); // begin one dah (60ms tone)
  keyer.setDah(false);
  await sleep(dit); // now inside the dah tone
  keyer.setDit(true); // tap the other paddle mid-tone...
  keyer.setDit(false); // ...releasing before the tone ends
  await sleep(dit * 8);
  expect(elements).toEqual(["-"]);
});
