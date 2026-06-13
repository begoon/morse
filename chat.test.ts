import { test, expect } from "bun:test";
import { detectSend } from "./src/chat/trigger";
import { buildRequest, parseReply } from "./src/chat/ai";

// --- send-trigger detection --------------------------------------------------

test("a single trailing K does NOT send", () => {
  expect(detectSend("HELLO K")).toEqual({ send: false, body: "HELLO K" });
});

test("KK as the final token sends the preceding message", () => {
  expect(detectSend("HW CPY KK")).toEqual({ send: true, body: "HW CPY" });
});

test("a trailing period sends (no space needed)", () => {
  expect(detectSend("GM OM.")).toEqual({ send: true, body: "GM OM" });
});

test("a bare KK does not send (empty body)", () => {
  expect(detectSend("KK")).toEqual({ send: false, body: "" });
});

test("a bare K does not send", () => {
  expect(detectSend("K")).toEqual({ send: false, body: "K" });
});

test("mid-message K (no trailing trigger) does not send", () => {
  expect(detectSend("KENT")).toEqual({ send: false, body: "KENT" });
});

test("word ending in K (letter gap, no space before K) does not send", () => {
  expect(detectSend("BACK")).toEqual({ send: false, body: "BACK" });
});

// --- request building --------------------------------------------------------

test("buildRequest: OpenAI endpoint, bearer auth, messages in body", () => {
  const { url, init } = buildRequest("openai", "gpt-4o-mini", "sk-test", [
    { role: "system", content: "sys" },
    { role: "user", content: "HI" },
  ]);
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe("gpt-4o-mini");
  expect(body.messages).toHaveLength(2);
  expect(body.messages[1]).toEqual({ role: "user", content: "HI" });
});

test("buildRequest: Gemini URL carries key, system→systemInstruction, roles mapped", () => {
  const { url, init } = buildRequest("gemini", "gemini-2.0-flash", "AIza-test", [
    { role: "system", content: "sys" },
    { role: "user", content: "HI" },
    { role: "assistant", content: "GM" },
  ]);
  expect(url).toContain("/models/gemini-2.0-flash:generateContent?key=AIza-test");
  const body = JSON.parse(init.body as string);
  expect(body.systemInstruction.parts[0].text).toBe("sys");
  expect(body.contents).toEqual([
    { role: "user", parts: [{ text: "HI" }] },
    { role: "model", parts: [{ text: "GM" }] },
  ]);
});

test("buildRequest: Anthropic Messages API — x-api-key, system top-level, turns only", () => {
  const { url, init } = buildRequest("anthropic", "claude-opus-4-8", "sk-ant-test", [
    { role: "system", content: "sys" },
    { role: "user", content: "HI" },
    { role: "assistant", content: "GM" },
  ]);
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  const headers = init.headers as Record<string, string>;
  expect(headers["x-api-key"]).toBe("sk-ant-test");
  expect(headers["anthropic-version"]).toBe("2023-06-01");
  expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe("claude-opus-4-8");
  expect(body.system).toBe("sys");
  expect(body.messages).toEqual([
    { role: "user", content: "HI" },
    { role: "assistant", content: "GM" },
  ]);
});

// --- reply parsing -----------------------------------------------------------

test("parseReply: OpenAI shape", () => {
  const json = { choices: [{ message: { content: " 73 OM " } }] };
  expect(parseReply("openai", json)).toBe("73 OM");
});

test("parseReply: Gemini shape", () => {
  const json = { candidates: [{ content: { parts: [{ text: "TNX FB" }] } }] };
  expect(parseReply("gemini", json)).toBe("TNX FB");
});

test("parseReply: Anthropic shape (text blocks joined)", () => {
  const json = { content: [{ type: "text", text: "73 OM" }], stop_reason: "end_turn" };
  expect(parseReply("anthropic", json)).toBe("73 OM");
});

test("parseReply: Anthropic refusal throws", () => {
  expect(() => parseReply("anthropic", { stop_reason: "refusal", content: [] })).toThrow();
});

test("parseReply: throws on empty", () => {
  expect(() => parseReply("openai", { choices: [] })).toThrow();
});
