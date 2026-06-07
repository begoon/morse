// One-off fetcher: common English words + CW jargon -> src/play/words.json.
//
// Pulls the google-10000-english frequency list, keeps short clean words, and
// pairs them with a curated list of CW abbreviations, Q-codes and prosigns.
// Run with `bun tools/fetch-words.ts`; the output is committed.

const URL =
    "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt";
const COMMON_COUNT = 3000;

// prettier-ignore
const CW = [
    // Q-codes
    "QTH", "QRZ", "QRM", "QRN", "QRP", "QRS", "QRQ", "QSB", "QSL", "QSO", "QSY", "QRL", "QRT", "QRV", "QRX",
    // abbreviations
    "ABT", "AGN", "ANT", "BK", "BTU", "CFM", "CL", "CPI", "CQ", "CUL", "CUAGN", "DE", "DX", "ES", "FB",
    "GA", "GB", "GE", "GM", "GN", "GUD", "HI", "HPE", "HR", "HW", "LID", "MNI", "NIL", "NR", "NW",
    "OM", "OP", "PSE", "PWR", "RPT", "RST", "RIG", "RX", "SK", "SRI", "TNX", "TKS", "TU", "TX", "UR",
    "VY", "WX", "XYL", "YL",
    // numbers
    "73", "88", "599", "5NN",
];

const text = await (await fetch(URL)).text();
const common = text
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => /^[a-z]{2,8}$/.test(w))
    .slice(0, COMMON_COUNT)
    .map((w) => w.toUpperCase());

if (common.length < 1000) throw new Error(`only ${common.length} common words — list changed?`);
for (const w of CW) {
    if (!/^[A-Z0-9]{2,8}$/.test(w)) throw new Error(`bad CW entry: ${w}`);
}
// Every length 2..8 should be reachable so any cap N has candidates.
for (let len = 2; len <= 8; len++) {
    if (!common.some((w) => w.length === len)) throw new Error(`no common words of length ${len}`);
}

const out = `${import.meta.dir}/../src/play/words.json`;
await Bun.write(out, JSON.stringify({ common, cw: CW }, null, 2) + "\n");
console.log(`wrote ${common.length} common + ${CW.length} CW words to src/play/words.json`);
