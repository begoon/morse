// Pure quiz logic: building a run from settings, shuffling, grading.

/** Which source a mock paper comes from. */
export type Tag = "rsgb" | "hamtrain";

export type Question = {
    tag: Tag;
    paper: number;
    n: number;
    /** Syllabus reference (rsgb papers only). */
    ref?: string;
    question: string;
    options: string[];
    answer: number; // index into options
    /** Answer explanation (hamtrain papers only). */
    explanation?: string;
    /** Illustration filename, resolved via src/test/images.ts. */
    image?: string;
};

export type Paper = { tag: Tag; n: number } | "combined";

export type Settings = {
    paper: Paper;
    /** Combined mode length: a 26-question sample or all of them. */
    combinedAll: boolean;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    /** Show the correct answer immediately, or only on the results screen. */
    feedback: "immediate" | "end";
};

export const DEFAULTS: Settings = {
    paper: { tag: "rsgb", n: 1 },
    combinedAll: false,
    shuffleQuestions: false,
    shuffleAnswers: false,
    feedback: "immediate",
};

/** Accept settings persisted by older versions (paper was 1 | 2 | 3). */
export function migratePaper(paper: unknown): Paper {
    if (paper === "combined") return "combined";
    if (typeof paper === "number") return { tag: "rsgb", n: paper };
    if (typeof paper === "object" && paper !== null) {
        const p = paper as { tag?: unknown; n?: unknown };
        if ((p.tag === "rsgb" || p.tag === "hamtrain") && typeof p.n === "number")
            return { tag: p.tag, n: p.n };
    }
    return DEFAULTS.paper;
}

/** A question as presented: options possibly reordered, answer remapped. */
export type RunQuestion = {
    source: Question;
    options: string[];
    answer: number;
};

export const EXAM_LENGTH = 26;
/** RSGB Foundation pass mark: 19 out of 26. */
export const PASS_FRACTION = 19 / 26;

type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
}

/** Assemble the question sequence for one run. */
export function buildRun(pool: readonly Question[], s: Settings, rng: Rng = Math.random): RunQuestion[] {
    let picked: Question[];
    if (s.paper === "combined") {
        picked = s.combinedAll ? [...pool] : shuffle(pool, rng).slice(0, EXAM_LENGTH);
        // The sample comes out in random order; restore source/paper order
        // unless the user asked for shuffled questions.
        if (!s.shuffleQuestions)
            picked.sort(
                (a, b) => a.tag.localeCompare(b.tag) || a.paper - b.paper || a.n - b.n,
            );
    } else {
        const { tag, n } = s.paper;
        picked = pool.filter((q) => q.tag === tag && q.paper === n);
    }
    if (s.shuffleQuestions) picked = shuffle(picked, rng);

    return picked.map((source) => {
        if (!s.shuffleAnswers) return { source, options: source.options, answer: source.answer };
        const order = shuffle([0, 1, 2, 3], rng);
        return {
            source,
            options: order.map((i) => source.options[i]!),
            answer: order.indexOf(source.answer),
        };
    });
}

export type Grade = {
    correct: number;
    total: number;
    percent: number;
    passMark: number;
    pass: boolean;
    unanswered: number;
};

/** Score a run; `picks[i]` is the chosen option index or null if unanswered. */
export function grade(run: readonly RunQuestion[], picks: readonly (number | null)[]): Grade {
    const total = run.length;
    const correct = run.filter((q, i) => picks[i] === q.answer).length;
    const unanswered = picks.filter((p) => p === null).length;
    const passMark = Math.ceil(total * PASS_FRACTION);
    return {
        correct,
        total,
        percent: Math.round((correct / total) * 100),
        passMark,
        pass: correct >= passMark,
        unanswered,
    };
}
