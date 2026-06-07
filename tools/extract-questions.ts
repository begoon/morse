// One-off extractor: foundation/rsgb.org/*.pdf -> src/test/questions.json.
//
// Uses macOS PDFKit (via osascript/JXA) to get plain text, then parses the
// regular mock-paper layout: "N. question…", a syllabus-ref line
// ("1A2-2025-Foundation2435"; one paper has a typo "…Foundatio3161"),
// options A–D (lines may wrap), and the answer table on the last page.
//
// Run with `bun tools/extract-questions.ts`; the output is committed, so this
// only needs re-running if the PDFs change.

import { $ } from "bun";

type Question = {
    tag: "rsgb";
    paper: number;
    n: number;
    ref: string;
    question: string;
    options: string[];
    answer: number; // index into options
    image?: string;
};

const PDFS = [
    "foundation/rsgb.org/260430_Foundation_Mock_01_V1.6b.pdf",
    "foundation/rsgb.org/260430_Foundation_Mock_02_V1.6b.pdf",
    "foundation/rsgb.org/260430_Foundation_Mock_03_V1.6b.pdf",
];

// The PDFs' diagrams aren't extractable as text; the question -> PNG mapping
// (foundation/rsgb.org/mock_<paper>_q<n>.png) is maintained by hand.
const IMAGES: Record<string, string> = {
    "1:11": "mock_01_q11.png",
    "2:12": "mock_02_q12.png",
    "2:14": "mock_02_q14.png",
    "3:12": "mock_03_q12.png",
};

async function pdfText(path: string): Promise<string> {
    const abs = `${import.meta.dir}/../${path}`;
    const jxa = `
        ObjC.import("Quartz");
        const url = $.NSURL.fileURLWithPath(${JSON.stringify(abs)});
        const doc = $.PDFDocument.alloc.initWithURL(url);
        doc.string.js`;
    return await $`osascript -l JavaScript -e ${jxa}`.text();
}

const HEADER = /^(Candidate:|Exam:|Centre:|Date:|Page \d+)/;
const REF = /^\d[A-H]\d-\d{4}-\w+$/;
const LETTERS = ["A", "B", "C", "D"];

function parsePaper(text: string, paper: number): Question[] {
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !HEADER.test(l));

    const split = lines.findIndex((l) => l.startsWith("Answers FOUNDATION"));
    if (split < 0) throw new Error(`paper ${paper}: no answers section`);
    const body = lines.slice(0, split);
    const tail = lines.slice(split + 1);

    // Answer table: rows of "1 D 14 B"-style pairs.
    const answers = new Map<number, number>();
    for (const line of tail) {
        for (const m of line.matchAll(/(\d+) ([A-D])\b/g)) {
            answers.set(Number(m[1]), LETTERS.indexOf(m[2]!));
        }
    }

    const questions: Question[] = [];
    let q: Question | undefined;
    for (const line of body) {
        const start = line.match(/^(\d+)\.\s+(.*)/);
        if (start) {
            q = { tag: "rsgb", paper, n: Number(start[1]), ref: "", question: start[2]!, options: [], answer: -1 };
            questions.push(q);
            continue;
        }
        if (!q) continue;
        if (!q.ref) {
            if (REF.test(line)) q.ref = line;
            else q.question += ` ${line}`; // wrapped question text
            continue;
        }
        // Options arrive in order; only the next expected letter starts a new
        // one, so a continuation line beginning with "A " can't be mistaken.
        const next = LETTERS[q.options.length];
        if (next && line.startsWith(`${next} `)) q.options.push(line.slice(2));
        else if (q.options.length) q.options[q.options.length - 1] += ` ${line}`;
        else throw new Error(`paper ${paper} Q${q.n}: unexpected line before options: ${line}`);
    }

    for (const question of questions) {
        const a = answers.get(question.n);
        if (a === undefined) throw new Error(`paper ${paper} Q${question.n}: no answer`);
        question.answer = a;
        const image = IMAGES[`${paper}:${question.n}`];
        if (image) question.image = image;
        if (!question.ref) throw new Error(`paper ${paper} Q${question.n}: no syllabus ref`);
        if (question.options.length !== 4)
            throw new Error(`paper ${paper} Q${question.n}: ${question.options.length} options`);
    }
    if (questions.length !== 26) throw new Error(`paper ${paper}: ${questions.length} questions`);
    return questions;
}

const all: Question[] = [];
for (const [i, pdf] of PDFS.entries()) {
    all.push(...parsePaper(await pdfText(pdf), i + 1));
}

const out = `${import.meta.dir}/../src/test/questions.json`;
await Bun.write(out, JSON.stringify(all, null, 2) + "\n");
console.log(`wrote ${all.length} questions to src/test/questions.json`);
