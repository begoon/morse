// One-off extractor: foundation/hamtrain.co.uk/mock<N>.md (+ -answers.md) ->
// src/test/questions-hamtrain.json. The markdown layout is documented in
// foundation/hamtrain.co.uk/FORMAT.md. Run with: bun tools/extract-hamtrain.ts

type Question = {
    tag: "hamtrain";
    paper: number;
    n: number;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    image?: string;
};

const DIR = "foundation/hamtrain.co.uk";
const LETTERS = ["A", "B", "C", "D"];
const IMAGE_RE = /^!\[[^\]]*\]\(([^)]+)\)\s*$/;

function parsePaper(paper: number, questionsMd: string, answersMd: string): Question[] {
    // Answer key + explanations: "## Question <Q> — <LETTER>" headings.
    const answers = new Map<number, { letter: string; explanation: string }>();
    const answerBlocks = answersMd.split(/^## /m).slice(1);
    for (const block of answerBlocks) {
        const head = block.match(/^Question (\d+) — ([A-D])\n/);
        if (!head) throw new Error(`mock${paper}-answers.md: bad heading: ${block.slice(0, 40)}`);
        const explanation = block
            .slice(head[0].length)
            .split("\n")
            .filter((line) => !IMAGE_RE.test(line)) // mock1 Q15 embeds the question image
            .join("\n")
            .trim();
        answers.set(Number(head[1]), { letter: head[2]!, explanation });
    }

    const questions: Question[] = [];
    const blocks = questionsMd.split(/^## /m).slice(1);
    for (const block of blocks) {
        const head = block.match(/^Question (\d+)\n/);
        if (!head) throw new Error(`mock${paper}.md: bad heading: ${block.slice(0, 40)}`);
        const n = Number(head[1]);

        const stemLines: string[] = [];
        const options: string[] = [];
        let image: string | undefined;
        for (const line of block.slice(head[0].length).split("\n")) {
            const opt = line.match(/^- ([A-D])\. (.+)$/);
            if (opt) {
                if (opt[1] !== LETTERS[options.length])
                    throw new Error(`mock${paper}.md Q${n}: option ${opt[1]} out of order`);
                options.push(opt[2]!.trim());
                continue;
            }
            const img = line.match(IMAGE_RE);
            if (img) {
                image = img[1]!;
                continue;
            }
            if (options.length > 0 && line.trim())
                throw new Error(`mock${paper}.md Q${n}: text after options: ${line}`);
            if (options.length === 0) stemLines.push(line);
        }
        const question = stemLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        if (options.length !== 4) throw new Error(`mock${paper}.md Q${n}: ${options.length} options`);

        const ans = answers.get(n);
        if (!ans) throw new Error(`mock${paper}-answers.md: no answer for Q${n}`);
        questions.push({
            tag: "hamtrain",
            paper,
            n,
            question,
            options,
            answer: LETTERS.indexOf(ans.letter),
            explanation: ans.explanation,
            ...(image ? { image } : {}),
        });
    }

    if (questions.length !== 26) throw new Error(`mock${paper}.md: ${questions.length} questions`);
    return questions;
}

const all: Question[] = [];
for (let paper = 1; paper <= 6; paper++) {
    const questionsMd = await Bun.file(`${DIR}/mock${paper}.md`).text();
    const answersMd = await Bun.file(`${DIR}/mock${paper}-answers.md`).text();
    all.push(...parsePaper(paper, questionsMd, answersMd));
}

await Bun.write("src/test/questions-hamtrain.json", JSON.stringify(all, null, 2) + "\n");
console.log(`wrote src/test/questions-hamtrain.json (${all.length} questions)`);
const withImages = all.filter((q) => q.image);
console.log(`images: ${withImages.map((q) => `${q.paper}:${q.n}=${q.image}`).join(", ")}`);
