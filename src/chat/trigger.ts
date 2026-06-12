// Detects the CW "over/end" signal that sends the keyed message to the AI.
//
// The operator keys their message then signals it's the AI's turn with the
// prosign K, KK, or a period ("." — pattern ".-.-.-"). We watch the decoded
// text and, when it ends with one of those, send everything before it.

export type SendDetection = { send: boolean; body: string };

export function detectSend(text: string): SendDetection {
  // Period: send everything up to the trailing "." (any trailing spaces too).
  if (text.trimEnd().endsWith(".")) {
    const body = text.trimEnd().replace(/\.+$/, "").trim();
    return { send: body.length > 0, body };
  }
  // K / KK as the final whitespace-delimited token.
  const tokens = text.trim().split(/\s+/);
  const last = tokens[tokens.length - 1];
  if (last === "K" || last === "KK") {
    const body = tokens.slice(0, -1).join(" ").trim();
    return { send: body.length > 0, body };
  }
  return { send: false, body: text };
}
