// The CW "error" / correction convention: a run of eight dits — sent here as
// HH (two H's, since H = ....) — means "scrub that, the correct word follows".
// We flag HH in the operator's copy so the convention is visible.

export const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Escape `text` to HTML and wrap any HH (the error prosign) in a red span. */
export function markErrors(text: string): string {
  return esc(text).replace(/HH/g, '<span class="cw-err">HH</span>');
}
