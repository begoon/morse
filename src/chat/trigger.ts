// Detects the CW "over/end" signal that sends the keyed message to the AI.
//
// The operator keys their message then signals it's the AI's turn with KK or a
// period ("." — pattern ".-.-.-"). A single K does NOT send — it's too easy to
// hit by accident and many words end in K. We watch the decoded text and, when
// it ends with one of those, send everything before it.

export type SendDetection = { send: boolean; body: string };

export function detectSend(text: string): SendDetection {
  // Period: send everything up to the trailing "." (any trailing spaces too).
  if (text.trimEnd().endsWith(".")) {
    const body = text.trimEnd().replace(/\.+$/, "").trim();
    return { send: body.length > 0, body };
  }
  // "KK" as the final whitespace-delimited token (a lone "K" is not a trigger).
  const tokens = text.trim().split(/\s+/);
  if (tokens[tokens.length - 1] === "KK") {
    const body = tokens.slice(0, -1).join(" ").trim();
    return { send: body.length > 0, body };
  }
  return { send: false, body: text };
}
