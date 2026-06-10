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
  lines.push(parts.join("  "));
  if (lines.length > 1000) lines.shift();
  n++;
  countEl.textContent = String(n);
  logEl.value = lines.join("\n");
  logEl.scrollTop = logEl.scrollHeight;
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
