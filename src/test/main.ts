// Foundation mock exam runner: start screen -> quiz -> results.

import rsgbJson from "./questions.json";
import hamtrainJson from "./questions-hamtrain.json";
import "./styles.css";
import { imageFor } from "./images";
import {
    DEFAULTS,
    buildRun,
    grade,
    migratePaper,
    type Question,
    type RunQuestion,
    type Settings,
    type Tag,
} from "./quiz";

const POOL = [...(rsgbJson as Question[]), ...(hamtrainJson as Question[])];
/** Mock paper numbers per source tag, in display order. */
const PAPERS: [Tag, number[]][] = [
    ["rsgb", [1, 2, 3]],
    ["hamtrain", [1, 2, 3, 4, 5, 6]],
];
const LETTERS = ["A", "B", "C", "D"];
const STORAGE_KEY = "morse-exam-settings";

function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const s = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
        s.paper = migratePaper(s.paper);
        return s;
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

const app = document.getElementById("app")!;
let settings = loadSettings();

// Run state.
let run: RunQuestion[] = [];
let picks: (number | null)[] = [];
let idx = 0;

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.append(...children);
    return node;
}

// --- Start screen ---------------------------------------------------------

function renderStart(): void {
    // One row of Mock buttons per source tag.
    const paperRows = PAPERS.map(([tag, ns]) => {
        const row = el("div", { class: "choices", "data-tag": tag });
        for (const n of ns) {
            const btn = el("button", { class: "choice", "data-paper": `${tag}-${n}` }, `Mock ${n}`);
            if (typeof settings.paper === "object" && settings.paper.tag === tag && settings.paper.n === n)
                btn.classList.add("selected");
            btn.onclick = () => {
                settings.paper = { tag, n };
                saveSettings(settings);
                renderStart();
            };
            row.append(btn);
        }
        return el("div", { class: "field" }, el("span", { class: "label" }, tag), row);
    });

    // Combined mode mixes questions from every paper; picking a length
    // selects it.
    const combinedRow = el("div", { class: "choices", id: "combined" });
    for (const [all, label] of [
        [false, "26 random questions"],
        [true, `All ${POOL.length} questions`],
    ] as const) {
        const btn = el("button", { class: "choice", "data-all": String(all) }, label);
        if (settings.paper === "combined" && settings.combinedAll === all) btn.classList.add("selected");
        btn.onclick = () => {
            settings.paper = "combined";
            settings.combinedAll = all;
            saveSettings(settings);
            renderStart();
        };
        combinedRow.append(btn);
    }

    const toggle = (id: "shuffleQuestions" | "shuffleAnswers", label: string) => {
        const input = el("input", { type: "checkbox", id }) as HTMLInputElement;
        input.checked = settings[id];
        input.onchange = () => {
            settings[id] = input.checked;
            saveSettings(settings);
        };
        return el("label", { class: "toggle" }, input, label);
    };

    const feedback = el("select", { id: "feedback" }) as HTMLSelectElement;
    feedback.append(
        el("option", { value: "immediate" }, "after each question"),
        el("option", { value: "end" }, "at the end"),
    );
    feedback.value = settings.feedback;
    feedback.onchange = () => {
        settings.feedback = feedback.value as Settings["feedback"];
        saveSettings(settings);
    };

    const start = el("button", { class: "primary", id: "start" }, "Start");
    start.onclick = () => {
        run = buildRun(POOL, settings);
        picks = run.map(() => null);
        idx = 0;
        renderQuiz();
    };

    app.replaceChildren(
        el("div", { class: "panel start" },
            ...paperRows,
            el("div", { class: "field" }, el("span", { class: "label" }, "Combined"), combinedRow),
            el("div", { class: "field" },
                el("span", { class: "label" }, "Shuffle"),
                el("div", { class: "choices" },
                    toggle("shuffleQuestions", "questions"),
                    toggle("shuffleAnswers", "answers"))),
            el("div", { class: "field" },
                el("label", { class: "label", for: "feedback" }, "Show answers"), feedback),
            start,
        ),
    );
}

// --- Quiz screen -----------------------------------------------------------

function origin(q: RunQuestion): string {
    return `${q.source.tag} Mock ${q.source.paper} · Q${q.source.n}`;
}

/** The question's illustration (block diagram etc.), if it has one. */
function questionImage(q: RunQuestion): HTMLElement[] {
    const src = imageFor(q.source.image);
    return src ? [el("img", { class: "question-image", src, alt: "Question illustration" })] : [];
}

/** Inline markdown emphasis (`**bold**`, `*italic*`) -> DOM nodes; everything
 * else stays plain text. Paragraph breaks survive via white-space: pre-line. */
function md(text: string): (Node | string)[] {
    return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/).map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) return el("strong", {}, part.slice(2, -2));
        if (part.startsWith("*") && part.endsWith("*")) return el("em", {}, part.slice(1, -1));
        return part;
    });
}

/** The answer explanation block (hamtrain papers only). */
function explanation(q: RunQuestion): HTMLElement[] {
    return q.source.explanation
        ? [el("div", { class: "explanation" }, ...md(q.source.explanation))]
        : [];
}

function renderQuiz(): void {
    const q = run[idx]!;
    const pick = picks[idx] ?? null;
    const immediate = settings.feedback === "immediate";
    const locked = immediate && pick !== null;

    const options = el("div", { class: "options" });
    q.options.forEach((text, i) => {
        const btn = el("button", { class: "option", "data-i": String(i) },
            el("span", { class: "letter" }, LETTERS[i]!), el("span", {}, ...md(text)));
        if (pick === i) btn.classList.add("selected");
        if (locked) {
            if (i === q.answer) btn.classList.add("correct");
            else if (i === pick) btn.classList.add("wrong");
            (btn as HTMLButtonElement).disabled = true;
        } else {
            btn.onclick = () => {
                picks[idx] = i;
                renderQuiz();
            };
        }
        options.append(btn);
    });

    const nav = el("div", { class: "nav" });
    if (!immediate && idx > 0) {
        const prev = el("button", { id: "prev" }, "Back");
        prev.onclick = () => {
            idx--;
            renderQuiz();
        };
        nav.append(prev);
    }
    const last = idx === run.length - 1;
    const next = el("button", { class: "primary", id: "next" }, last ? "Finish" : "Next");
    (next as HTMLButtonElement).disabled = immediate && pick === null;
    next.onclick = () => {
        if (last) renderResults();
        else {
            idx++;
            renderQuiz();
        }
    };
    nav.append(next);

    app.replaceChildren(
        el("div", { class: "panel quiz" },
            el("div", { class: "progress" },
                el("span", { id: "counter" }, `Question ${idx + 1} / ${run.length}`),
                settings.paper === "combined" ? el("span", { class: "origin" }, origin(q)) : ""),
            el("div", { class: "question", id: "question" }, ...md(q.source.question)),
            ...questionImage(q),
            options,
            ...(locked ? explanation(q) : []),
            nav,
        ),
    );
}

// --- Results screen --------------------------------------------------------

function renderResults(): void {
    const g = grade(run, picks);

    const review = el("div", { class: "review" });
    run.forEach((q, i) => {
        const pick = picks[i] ?? null;
        const ok = pick === q.answer;
        const item = el("div", { class: `review-item ${ok ? "ok" : "bad"}` },
            el("div", { class: "review-head" },
                el("span", { class: "mark" }, ok ? "✓" : "✗"),
                el("span", {}, `${i + 1}. `, ...md(q.source.question)),
                el("span", { class: "origin" }, origin(q))),
            ...questionImage(q),
        );
        if (!ok)
            item.append(el("div", { class: "review-answer" },
                ...(pick === null
                    ? ["Not answered."]
                    : [`Your answer: ${LETTERS[pick]!} — `, ...md(q.options[pick]!)])));
        item.append(el("div", { class: "review-answer correct-answer" },
            `Correct: ${LETTERS[q.answer]} — `, ...md(q.options[q.answer]!)));
        item.append(...explanation(q));
        review.append(item);
    });

    const again = el("button", { class: "primary", id: "again" }, "New test");
    again.onclick = renderStart;

    app.replaceChildren(
        el("div", { class: "panel results" },
            el("div", { class: `score ${g.pass ? "pass" : "fail"}`, id: "score" },
                `${g.correct} / ${g.total} (${g.percent}%) — ${g.pass ? "PASS" : "FAIL"}`),
            el("div", { class: "passmark" },
                `Pass mark: ${g.passMark} of ${g.total}` +
                (g.unanswered ? ` · ${g.unanswered} unanswered` : "")),
            again,
            review,
        ),
    );
}

renderStart();
