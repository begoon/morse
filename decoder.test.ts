import { test, expect } from "bun:test";
import { Decoder, type DecoderTimers } from "./src/decoder";

// A controllable fake clock: scheduled callbacks fire only when `advance` is
// called past their delay.
function fakeTimers() {
  let nextId = 1;
  let now = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: DecoderTimers = {
    set: (fn, ms) => {
      const id = nextId++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (id) => pending.delete(id),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...pending.entries()]) {
      if (t.at <= now) {
        pending.delete(id);
        t.fn();
      }
    }
  };
  return { timers, advance };
}

function makeDecoder(extra?: Partial<ConstructorParameters<typeof Decoder>[0]>) {
  const { timers, advance } = fakeTimers();
  const decoder = new Decoder({
    language: "en",
    letterGapMs: 720, // 3 dits @ 5wpm
    wordGapMs: 1680, // 7 dits @ 5wpm
    maxChars: 10,
    timers,
    ...extra,
  });
  return { decoder, advance };
}

test("flushes a letter after the letter gap", () => {
  const { decoder, advance } = makeDecoder();
  decoder.element("."); // E
  expect(decoder.state.pattern).toBe(".");
  advance(720);
  expect(decoder.state.text).toBe("E");
  expect(decoder.state.pattern).toBe("");
});

test("decodes a multi-element letter", () => {
  const { decoder, advance } = makeDecoder();
  decoder.element("-");
  decoder.element(".");
  decoder.element("-");
  decoder.element("."); // -.-. = C
  advance(720);
  expect(decoder.state.text).toBe("C");
});

test("emits a space after the word gap", () => {
  const { decoder, advance } = makeDecoder();
  decoder.element("."); // E
  advance(720); // letter flush -> "E"
  expect(decoder.state.text).toBe("E");
  advance(1680 - 720); // remaining silence -> word gap
  expect(decoder.state.text).toBe("E ");
});

test("keeps only the last maxChars characters", () => {
  const { decoder, advance } = makeDecoder({ maxChars: 3 });
  for (const _ of [0, 1, 2, 3, 4]) {
    decoder.element("."); // E each time
    advance(720);
  }
  expect(decoder.state.text.length).toBe(3);
  expect(decoder.state.text).toBe("EEE");
});

test("intra-element gaps do not split a letter (keyer start/stop)", () => {
  // Simulate a paddle keying ".-" (A) at 5 wpm: dit=240ms, intra-gap=240ms.
  // The decoder must see the tone-starts so it only counts real silence.
  const { decoder, advance } = makeDecoder({ letterGapMs: 480, wordGapMs: 1200 });
  decoder.elementStart(); // dit tone on
  advance(240); // dit tone duration
  decoder.element("."); // dit ends, arms letter timer
  advance(240); // intra-element gap (silence) — under the 480ms threshold
  decoder.elementStart(); // dah tone on — must cancel the pending flush
  advance(720); // dah tone duration (3 dits)
  decoder.element("-"); // dah ends
  advance(480); // letter gap of real silence
  expect(decoder.state.text).toBe("A");
});

test("holding dits produces one multi-dit letter, not many Es", () => {
  const { decoder, advance } = makeDecoder({ letterGapMs: 480, wordGapMs: 1200 });
  for (let i = 0; i < 4; i++) {
    decoder.elementStart();
    advance(240); // dit tone
    decoder.element(".");
    advance(240); // intra gap
  }
  advance(480); // letter gap
  expect(decoder.state.text).toBe("H"); // .... = H
});

test("language switch affects subsequent decoding", () => {
  const { decoder, advance } = makeDecoder();
  decoder.setLanguage("ru");
  decoder.element(".");
  decoder.element("-");
  decoder.element("-"); // .-- = В in Russian
  advance(720);
  expect(decoder.state.text).toBe("В");
});
