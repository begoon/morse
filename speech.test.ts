import { test, expect } from "bun:test";
import { speechFor } from "./src/speech";

test("a real word is pronounced (lower-cased) in en-US", () => {
  expect(speechFor("THANKS", true, "en")).toEqual({
    text: "thanks",
    lang: "en-US",
  });
});

test("abbreviations are spelled letter by letter, no 'capital'", () => {
  expect(speechFor("TNX", false, "en").text).toBe("t, n, x");
});

test("numbers are spelled digit by digit", () => {
  expect(speechFor("73", false, "en").text).toBe("7, 3");
});

test("punctuation is mapped to spoken names", () => {
  expect(speechFor(".", false, "en").text).toBe("period");
  expect(speechFor(",", false, "en").text).toBe("comma");
  expect(speechFor("?", false, "en").text).toBe("question mark");
});

test("russian uses the ru-RU voice", () => {
  expect(speechFor("Ж", false, "ru").lang).toBe("ru-RU");
});
