// Foundation mock exam runner: start screen -> quiz -> results.
//
// Structured as small "component" functions — pure(ish) `data in, DOM out`
// builders over the `h` helper (see ./dom.ts) — with a thin controller at the
// bottom that owns the run state and swaps screens via `show`.

import rsgbJson from "./questions.json";
import hamtrainJson from "./questions-hamtrain.json";
import "./styles.css";
import { imageFor } from "./images";
import { h, mount, type Child, type Children, type Props } from "./dom";
import {
    DEFAULTS,
    buildRun,
    grade,
    migratePaper,
    questionKey,
    type Paper,
    type Question,
    type RunQuestion,
    type Settings,
    type Tag,
} from "./quiz";

const POOL = [...(rsgbJson as Question[]), ...(hamtrainJson as Question[])];
/** Mock paper numbers per source tag, in display order. */
const PAPERS: [Tag, number[]][] = [
    ["rsgb", [1, 2, 3]],
    ["hamtrain", [1, 2, 3, 4, 5, 6, 7]],
];
const LETTERS = ["A", "B", "C", "D"];
const STORAGE_KEY = "morse-exam-settings";
const MISTAKES_KEY = "morse-exam-mistakes";

// --- Settings persistence --------------------------------------------------

function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        let paper = migratePaper(parsed.paper);
        // Legacy: the old "Combined" mode used a `combinedAll` flag for the
        // all-questions run, now its own "everything" mode.
        if (paper === "combined" && parsed.combinedAll === true) paper = "everything";
        return {
            paper,
            shuffleQuestions: parsed.shuffleQuestions === true,
            shuffleAnswers: parsed.shuffleAnswers === true,
            feedback: parsed.feedback === "end" ? "end" : "immediate",
        };
    } catch {
        return { ...DEFAULTS };
    }
}

function saveSettings(s: Settings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
        // storage unavailable (private mode, etc.) — ignore.
    }
}

// --- Mistakes set (the "workout" pool) -------------------------------------

/** Question keys answered wrong, persisted across Combined/Workout runs. */
function loadMistakes(): Set<string> {
    try {
        const arr = JSON.parse(localStorage.getItem(MISTAKES_KEY) ?? "[]");
        return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
    } catch {
        return new Set();
    }
}

function saveMistakes(set: Set<string>): void {
    try {
        localStorage.setItem(MISTAKES_KEY, JSON.stringify([...set]));
    } catch {
        // storage unavailable — ignore.
    }
}

/** After a Combined/Workout run, add questions answered wrong and drop ones now
 * answered right; unanswered questions are left as-is. */
function updateMistakes(): void {
    const set = loadMistakes();
    run.forEach((q, i) => {
        const key = questionKey(q.source);
        const pick = picks[i];
        if (pick === q.answer) set.delete(key);
        else if (pick !== null && pick !== undefined) set.add(key);
    });
    saveMistakes(set);
}

// --- Shared question pieces ------------------------------------------------

function origin(q: RunQuestion): string {
    return `${q.source.tag} Mock ${q.source.paper} · Q${q.source.n}`;
}

/** The question's illustration (block diagram etc.), if it has one. */
function questionImage(q: RunQuestion): Child {
    const src = imageFor(q.source.image);
    return src ? h("img", { class: "question-image", src, alt: "Question illustration" }) : null;
}

/** Inline markdown emphasis (`**bold**`, `*italic*`) -> nodes; everything else
 * stays plain text. Paragraph breaks survive via white-space: pre-line. */
function md(text: string): Child[] {
    return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/).map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) return h("strong", {}, part.slice(2, -2));
        if (part.startsWith("*") && part.endsWith("*")) return h("em", {}, part.slice(1, -1));
        return part;
    });
}

/** The answer explanation block (hamtrain papers only). */
function explanation(q: RunQuestion): Child {
    return q.source.explanation ? h("div", { class: "explanation" }, md(q.source.explanation)) : null;
}

// --- Reusable controls -----------------------------------------------------

function Field(label: Child, ...controls: Children[]): HTMLElement {
    const labelNode = typeof label === "string" ? h("span", { class: "label" }, label) : label;
    return h("div", { class: "field" }, labelNode, controls);
}

function Choice(label: string, active: boolean, onSelect: () => void, attrs: Props = {}): HTMLElement {
    return h("button", { class: active ? "choice selected" : "choice", on: { click: onSelect }, ...attrs }, label);
}

// --- Start screen ----------------------------------------------------------

function StartScreen(): HTMLElement {
    const mistakes = loadMistakes();
    // A workout is only offered once a Combined run has logged wrong answers;
    // if the persisted choice points at an empty set, fall back to the default.
    if (settings.paper === "mistakes" && mistakes.size === 0) {
        settings.paper = DEFAULTS.paper;
        saveSettings(settings);
    }

    const select = (paper: Paper) => {
        settings.paper = paper;
        saveSettings(settings);
        show(StartScreen);
    };
    const isPaper = (tag: Tag, n: number) =>
        typeof settings.paper === "object" && settings.paper.tag === tag && settings.paper.n === n;

    const paperRows = PAPERS.map(([tag, ns]) =>
        Field(tag, h("div", { class: "choices", "data-tag": tag },
            ns.map((n) => Choice(`Mock ${n}`, isPaper(tag, n), () => select({ tag, n }), { "data-paper": `${tag}-${n}` })))));

    // Cross-paper modes: a 26-question topic-mixed exam, or every question, plus
    // a "workout" on previously-wrong questions once any have been logged.
    const mixed = ([["combined", "26 questions"], ["everything", `Everything (${POOL.length})`]] as const).map(
        ([mode, label]) => Choice(label, settings.paper === mode, () => select(mode), { "data-paper": mode }));
    if (mistakes.size > 0) {
        mixed.push(Choice(`Mistakes (${mistakes.size})`, settings.paper === "mistakes",
            () => select("mistakes"), { "data-paper": "mistakes" }));
    }

    const toggle = (id: "shuffleQuestions" | "shuffleAnswers", label: string) =>
        h("label", { class: "toggle" },
            h("input", {
                type: "checkbox", id, checked: settings[id],
                on: { change: (e) => { settings[id] = (e.target as HTMLInputElement).checked; saveSettings(settings); } },
            }),
            label);

    const feedback = h("select", {
        id: "feedback", value: settings.feedback,
        on: { change: (e) => { settings.feedback = (e.target as HTMLSelectElement).value as Settings["feedback"]; saveSettings(settings); } },
    },
        h("option", { value: "immediate" }, "after each question"),
        h("option", { value: "end" }, "at the end"));

    return h("div", { class: "panel start" },
        paperRows,
        Field("Mixed", h("div", { class: "choices", id: "mixed" }, mixed)),
        Field("Shuffle", h("div", { class: "choices" }, toggle("shuffleQuestions", "questions"), toggle("shuffleAnswers", "answers"))),
        Field(h("label", { class: "label", for: "feedback" }, "Show answers"), feedback),
        h("button", { class: "primary", id: "start", on: { click: startRun } }, "Start"),
    );
}

// --- Quiz screen -----------------------------------------------------------

function Option(text: string, i: number, q: RunQuestion, pick: number | null, locked: boolean): HTMLElement {
    const cls = ["option"];
    if (pick === i) cls.push("selected");
    if (locked && i === q.answer) cls.push("correct");
    else if (locked && i === pick) cls.push("wrong");
    return h("button", {
        class: cls.join(" "),
        "data-i": i,
        disabled: locked,
        ...(locked ? {} : { on: { click: () => { picks[idx] = i; show(QuizScreen); } } }),
    }, h("span", { class: "letter" }, LETTERS[i]!), h("span", {}, md(text)));
}

function QuizScreen(): HTMLElement {
    const q = run[idx]!;
    const pick = picks[idx] ?? null;
    const immediate = settings.feedback === "immediate";
    const locked = immediate && pick !== null;
    const last = idx === run.length - 1;

    return h("div", { class: "panel quiz" },
        h("div", { class: "progress" },
            h("span", { id: "counter" }, `Question ${idx + 1} / ${run.length}`),
            typeof settings.paper === "string" ? h("span", { class: "origin" }, origin(q)) : null),
        h("div", { class: "question", id: "question" }, md(q.source.question)),
        questionImage(q),
        h("div", { class: "options" }, q.options.map((text, i) => Option(text, i, q, pick, locked))),
        locked ? explanation(q) : null,
        h("div", { class: "nav" },
            !immediate && idx > 0
                ? h("button", { id: "prev", on: { click: () => { idx--; show(QuizScreen); } } }, "Back")
                : null,
            h("button", {
                class: "primary", id: "next", disabled: immediate && pick === null,
                on: { click: () => { if (last) finishRun(); else { idx++; show(QuizScreen); } } },
            }, last ? "Finish" : "Next")),
    );
}

// --- Results screen --------------------------------------------------------

function ReviewItem(q: RunQuestion, i: number): HTMLElement {
    const pick = picks[i] ?? null;
    const ok = pick === q.answer;
    return h("div", { class: `review-item ${ok ? "ok" : "bad"}` },
        h("div", { class: "review-head" },
            h("span", { class: "mark" }, ok ? "✓" : "✗"),
            h("span", {}, `${i + 1}. `, md(q.source.question)),
            h("span", { class: "origin" }, origin(q))),
        questionImage(q),
        ok ? null : h("div", { class: "review-answer" },
            pick === null ? "Not answered." : [`Your answer: ${LETTERS[pick]!} — `, md(q.options[pick]!)]),
        h("div", { class: "review-answer correct-answer" }, `Correct: ${LETTERS[q.answer]} — `, md(q.options[q.answer]!)),
        explanation(q),
    );
}

function ResultsScreen(): HTMLElement {
    const g = grade(run, picks);
    return h("div", { class: "panel results" },
        h("div", { class: `score ${g.pass ? "pass" : "fail"}`, id: "score" },
            `${g.correct} / ${g.total} (${g.percent}%) — ${g.pass ? "PASS" : "FAIL"}`),
        h("div", { class: "passmark" },
            `Pass mark: ${g.passMark} of ${g.total}` + (g.unanswered ? ` · ${g.unanswered} unanswered` : "")),
        h("button", { class: "primary", id: "again", on: { click: () => show(StartScreen) } }, "New test"),
        h("div", { class: "review" }, run.map((q, i) => ReviewItem(q, i))),
    );
}

// --- Controller ------------------------------------------------------------

const app = document.getElementById("app")!;
let settings = loadSettings();
let run: RunQuestion[] = [];
let picks: (number | null)[] = [];
let idx = 0;

const show = (screen: () => HTMLElement) => mount(app, screen());

function startRun(): void {
    run = buildRun(POOL, settings, Math.random, loadMistakes());
    if (run.length === 0) return; // nothing to run (e.g. an emptied mistakes set)
    picks = run.map(() => null);
    idx = 0;
    show(QuizScreen);
}

/** Called once when a run finishes; refreshes the mistakes set for the modes
 * that own it. */
function finishRun(): void {
    if (settings.paper === "combined" || settings.paper === "mistakes") updateMistakes();
    show(ResultsScreen);
}

show(StartScreen);
