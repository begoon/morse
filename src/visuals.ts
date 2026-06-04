// SVG schematics for the two key types. Each returns markup; an `active` class
// toggled on the moving parts animates the keying (driven via CSS).

import type { KeyType } from "./settings";

/**
 * Straight key: a lever pivoting on a post, with a knob and a contact below.
 * The `.lever` group tilts down when active; `.contact` lights up.
 */
function straightKeySvg(): string {
  return `
<svg class="schematic straight" viewBox="0 34 240 92" role="img"
     aria-label="Straight key schematic">
  <line class="base" x1="20" y1="120" x2="220" y2="120" />
  <rect class="pivot" x="150" y="78" width="10" height="42" />
  <g class="lever-group">
    <line class="lever" x1="30" y1="60" x2="170" y2="82" />
    <circle class="knob" cx="40" cy="58" r="16" />
    <line class="contact-arm" x1="60" y1="64" x2="60" y2="92" />
  </g>
  <circle class="contact" cx="60" cy="100" r="6" />
</svg>`;
}

/**
 * Iambic paddle: two paddles (dit left, dah right) pivoting toward a centre
 * contact post. `.paddle-dit` / `.paddle-dah` light when their element fires.
 */
function paddleSvg(): string {
  return `
<svg class="schematic paddle" viewBox="0 34 240 92" role="img"
     aria-label="Iambic paddle schematic">
  <line class="base" x1="20" y1="120" x2="220" y2="120" />
  <rect class="post" x="116" y="50" width="8" height="70" />
  <g class="paddle-dit">
    <rect class="finger" x="40" y="60" width="14" height="44" rx="3" />
    <line class="arm" x1="54" y1="82" x2="116" y2="82" />
    <text class="lbl" x="47" y="120">•</text>
  </g>
  <g class="paddle-dah">
    <rect class="finger" x="186" y="60" width="14" height="44" rx="3" />
    <line class="arm" x1="186" y1="82" x2="124" y2="82" />
    <text class="lbl" x="190" y="120">—</text>
  </g>
</svg>`;
}

export function renderSchematic(container: HTMLElement, keyType: KeyType) {
  container.innerHTML = keyType === "straight" ? straightKeySvg() : paddleSvg();
}

/**
 * Toggle the active visual state. For paddle, `el` selects which paddle lights;
 * for straight key, any non-null element presses the lever.
 */
export function setActive(
  container: HTMLElement,
  keyType: KeyType,
  el: "." | "-" | null,
) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  if (keyType === "straight") {
    svg.classList.toggle("active", el !== null);
    return;
  }
  svg
    .querySelector(".paddle-dit")
    ?.classList.toggle("active", el === ".");
  svg
    .querySelector(".paddle-dah")
    ?.classList.toggle("active", el === "-");
}
