// Regenerate the "extra" question bank from foundation/extra/RSGB-addon.tsv.
//
// The TSV (tab-separated, first row = column names) has one question per row:
//   col 5 ("Mock Question") = the stem with the four options inline as
//     "<stem> A. <a> B. <b> C. <c> D. <d>" (marker dots/spacing are a bit
//     inconsistent in the source — see the tolerant regex below).
//   col 9 ("Correct Answer") = the answer letter (A–D), used verbatim.
// Question illustrations are foundation/extra/q<L>.png where <L> is the TSV
// file-line number (1-based, header = line 1); q30.png → line 30.
//
// Writes src/test/questions-extra.json (the bank, tag "extra", paper 1) and
// foundation/extra/extra.md (a human-readable review of every Q + answers).
// Re-run only if the TSV or images change.

import { readdirSync } from "node:fs";

const TSV = "foundation/extra/RSGB-addon.tsv";
const OUT_JSON = "src/test/questions-extra.json";
const OUT_MD = "foundation/extra/extra.md";

// A/B always carry a dot in the source; C/D sometimes don't, and spacing varies.
const OPTION_RE = /^(.*?)\s+A\.\s+(.*?)\s+B\.\s+(.*?)\s+C\.?\s+(.*?)\s+D\.?\s*(.*)$/;
const LETTERS = ["A", "B", "C", "D"] as const;

type Question = {
  tag: "extra";
  paper: 1;
  n: number;
  question: string;
  options: string[];
  answer: number;
  image?: string;
};

// Map TSV file-line number -> image filename, from the q<L>.png files present.
const imageByLine = new Map<number, string>();
for (const f of readdirSync("foundation/extra")) {
  const m = f.match(/^q(\d+)\.png$/);
  if (m) imageByLine.set(Number(m[1]), f);
}

const lines = (await Bun.file(TSV).text()).split("\n");
const questions: Question[] = [];
let n = 0;

for (let i = 1; i < lines.length; i++) {
  const fileLine = i + 1; // 1-based, header is line 1
  const cols = lines[i]!.split("\t");
  const q5 = (cols[4] ?? "").trim();
  if (!q5) continue; // trailing blank rows
  n++;

  const m = q5.match(OPTION_RE);
  if (!m) throw new Error(`line ${fileLine}: could not parse options from: ${q5}`);
  const question = m[1]!.trim();
  const options = [m[2]!, m[3]!, m[4]!, m[5]!].map((s) => s.trim());

  const letter = (cols[8] ?? "").trim().toUpperCase();
  const answer = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  if (answer < 0) throw new Error(`line ${fileLine}: bad correct-answer letter ${JSON.stringify(letter)}`);

  const q: Question = { tag: "extra", paper: 1, n, question, options, answer };
  const image = imageByLine.get(fileLine);
  if (image) q.image = image;
  questions.push(q);
}

await Bun.write(OUT_JSON, JSON.stringify(questions, null, 2) + "\n");

// Human-readable review document.
const md: string[] = [
  "# Extra mock — questions & answers",
  "",
  `Generated from \`${TSV}\` (col 5 = question, col 9 = correct answer). ${questions.length} questions.`,
  "Questions with an illustration are noted; verify those answers against the image.",
  "",
];
for (const q of questions) {
  md.push(`## Q${q.n}${q.image ? ` — image: ${q.image}` : ""}`);
  md.push("");
  md.push(q.question);
  md.push("");
  q.options.forEach((opt, i) => {
    md.push(`- ${LETTERS[i]}. ${opt}${i === q.answer ? "  ✅" : ""}`);
  });
  md.push("");
}
await Bun.write(OUT_MD, md.join("\n"));

const withImages = questions.filter((q) => q.image).map((q) => `Q${q.n}=${q.image}`);
console.log(`wrote ${questions.length} questions -> ${OUT_JSON} and ${OUT_MD}`);
console.log(`images: ${withImages.join(", ")}`);
