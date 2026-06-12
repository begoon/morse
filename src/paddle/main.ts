// Paddle test page: logs raw mouse/pointer events so we can see exactly what a
// USB "keyer" (mouse-emulating) device emits. Not part of the trainer — a
// diagnostic page.

import "../styles.css";

const padEl = document.getElementById("pad")!;
const logEl = document.getElementById("log") as HTMLTextAreaElement;
const countEl = document.getElementById("count")!;
const copyBtn = document.getElementById("copy") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;

const BUTTON = ["left(0)", "middle(1)", "right(2)", "back(3)", "fwd(4)"];

let t0 = 0;
let n = 0;
const lines: string[] = [];

function targetDesc(t: EventTarget | null): string {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return String(t);
  let s = el.tagName.toLowerCase();
  if (el.id) s += "#" + el.id;
  return s;
}

function emit(parts: string[]) {
  lines.push(parts.join("  "));
  if (lines.length > 1000) lines.shift();
  n++;
  countEl.textContent = String(n);
  logEl.value = lines.join("\n");
  logEl.scrollTop = logEl.scrollHeight;
}

function log(e: MouseEvent | PointerEvent) {
  if (t0 === 0) t0 = e.timeStamp;
  const dt = Math.round(e.timeStamp - t0);
  const btn = BUTTON[(e as MouseEvent).button] ?? String((e as MouseEvent).button);
  const parts = [
    `+${String(dt).padStart(6)}ms`,
    e.type.padEnd(12),
    `button=${btn}`,
    `buttons=${(e as MouseEvent).buttons}`,
  ];
  if ("pointerType" in e && (e as PointerEvent).pointerType) {
    parts.push(`ptr=${(e as PointerEvent).pointerType}`);
  }
  parts.push(`detail=${e.detail}`);
  parts.push(`trusted=${e.isTrusted}`);
  parts.push(`target=${targetDesc(e.target)}`);
  emit(parts);
}

function logKey(e: KeyboardEvent) {
  if (t0 === 0) t0 = e.timeStamp;
  const dt = Math.round(e.timeStamp - t0);
  emit([
    `+${String(dt).padStart(6)}ms`,
    e.type.padEnd(12),
    `code=${e.code}`,
    `key=${JSON.stringify(e.key)}`,
    `repeat=${e.repeat}`,
    `trusted=${e.isTrusted}`,
    `target=${targetDesc(e.target)}`,
  ]);
}

// Some USB keyers signal the paddle as relative mouse MOVEMENT rather than a
// button or key (e.g. the 0x413D:0x2107 composite device reports one lever as
// movementY=+10 and the other as -10, streaming ~every 75ms while held). Log
// nonzero moves so those devices aren't invisible. Zero-delta moves are skipped
// to avoid flooding from an ordinary trackpad/mouse hovering the page.
function logMove(e: MouseEvent) {
  if (e.movementX === 0 && e.movementY === 0) return;
  if (t0 === 0) t0 = e.timeStamp;
  const dt = Math.round(e.timeStamp - t0);
  emit([
    `+${String(dt).padStart(6)}ms`,
    e.type.padEnd(12),
    `dx=${e.movementX}`,
    `dy=${e.movementY}`,
    `trusted=${e.isTrusted}`,
    `target=${targetDesc(e.target)}`,
  ]);
}
for (const ty of ["pointermove", "mousemove"]) {
  window.addEventListener(ty, (e) => logMove(e as MouseEvent), { capture: true });
}

// Capture every relevant event type on the window so we see the full sequence
// (and ordering) the device produces. preventDefault on contextmenu/mousedown
// keeps the right-click menu and text selection from interfering.
const TYPES = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "auxclick",
  "contextmenu",
  "dblclick",
];
for (const ty of TYPES) {
  window.addEventListener(
    ty,
    (e) => {
      if (ty === "contextmenu" || ty === "mousedown") e.preventDefault();
      log(e as MouseEvent);
    },
    { capture: true },
  );
}

// The device enumerates as a composite keyboard+mouse, so a paddle lever may
// arrive as a keystroke rather than a mouse button. Capture those too, else the
// page looks dead when you press that lever.
for (const ty of ["keydown", "keyup"]) {
  window.addEventListener(
    ty,
    (e) => {
      (e as KeyboardEvent).preventDefault();
      logKey(e as KeyboardEvent);
    },
    { capture: true },
  );
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(logEl.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1000);
  } catch {
    logEl.focus();
    logEl.select();
  }
});

clearBtn.addEventListener("click", () => {
  lines.length = 0;
  n = 0;
  t0 = 0;
  countEl.textContent = "0";
  logEl.value = "";
});

void padEl;
