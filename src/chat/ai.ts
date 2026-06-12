// AI chat backends. The browser calls OpenAI or Gemini directly with the user's
// own API key (entered in Settings, stored in localStorage). Request building
// and reply parsing are pure functions so they can be unit-tested without a
// network; `complete()` is the thin fetch wrapper around them.

import type { AiProvider } from "../settings";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// CW ragchew persona: terse, common words, ham abbreviations.
export const SYSTEM_PROMPT =
  "You are a friendly amateur-radio operator chatting in Morse code (CW) on the " +
  "air. ALWAYS reply with just 2 to 5 words. Use common, short words and " +
  "standard CW abbreviations where natural (e.g. 73, GM, GE, GA, TNX, FB, OM, " +
  "UR, RST, QTH, HW, CUL, R, ES, HI, WX, RIG, ANT). Write in UPPERCASE. Avoid " +
  "punctuation other than a trailing K. Never explain yourself or add notes.";

export type BuiltRequest = { url: string; init: RequestInit };

/** Build the provider-specific HTTP request. Pure (no fetch). `messages`
 * includes the system message first. */
export function buildRequest(
  provider: AiProvider,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): BuiltRequest {
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 32,
          temperature: 0.8,
        }),
      },
    };
  }

  if (provider === "anthropic") {
    // Anthropic Messages API: system is a top-level field; messages are the
    // user/assistant turns only. `anthropic-dangerous-direct-browser-access`
    // opts into CORS so the browser can call the API directly.
    const sys = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 64,
          ...(sys ? { system: sys } : {}),
          messages: turns,
        }),
      },
    };
  }

  // Gemini: system goes in systemInstruction; roles map user→user, assistant→model.
  const system = messages.find((m) => m.role === "system")?.content;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  return {
    url:
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: 32, temperature: 0.8 },
      }),
    },
  };
}

/** Extract the reply text from a provider response payload. Pure. */
export function parseReply(provider: AiProvider, json: unknown): string {
  const j = json as Record<string, any>;
  if (provider === "anthropic" && j?.stop_reason === "refusal") {
    throw new Error("The AI declined to respond.");
  }
  const text =
    provider === "openai"
      ? j?.choices?.[0]?.message?.content
      : provider === "anthropic"
        ? j?.content?.filter((b: any) => b?.type === "text").map((b: any) => b?.text).join("")
        : j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("");
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty response from the AI.");
  }
  return text.trim();
}

/** Call the AI and return its reply text. Throws a friendly Error on failure. */
export async function complete(
  provider: AiProvider,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  if (!apiKey) {
    const label =
      provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Gemini";
    throw new Error(`Set your ${label} API key in Settings.`);
  }
  const { url, init } = buildRequest(provider, model, apiKey, messages);
  // Bound the request so a hung connection can't wedge the chat (it would leave
  // the caller's "awaiting" flag stuck and block further sends).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new Error("Network error or timeout reaching the AI.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI error ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return parseReply(provider, await res.json());
}
