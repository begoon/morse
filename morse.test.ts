import { test, expect } from "bun:test";
import { MORSE_EN, MORSE_RU, lookup, encode } from "./src/morse";

test("english round-trips every character", () => {
  for (const [char, pattern] of Object.entries(MORSE_EN)) {
    expect(encode(char, "en")).toBe(pattern);
    expect(lookup(pattern, "en")).toBe(char);
  }
});

test("russian round-trips every character", () => {
  for (const [char, pattern] of Object.entries(MORSE_RU)) {
    expect(encode(char, "ru")).toBe(pattern);
    expect(lookup(pattern, "ru")).toBe(char);
  }
});

test("same pattern decodes differently per language", () => {
  // .-- is W in English, В in Russian
  expect(lookup(".--", "en")).toBe("W");
  expect(lookup(".--", "ru")).toBe("В");
});

test("unknown pattern returns '?'", () => {
  expect(lookup("........", "en")).toBe("?");
});

test("empty pattern returns empty string", () => {
  expect(lookup("", "en")).toBe("");
});
