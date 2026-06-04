// Common ham-radio abbreviations, prosigns and Q-codes, shown as a rotating
// hint so operators pick them up while practising.

export type Abbr = { abbr: string; meaning: string };

export const ABBREVIATIONS: Abbr[] = [
  // Conversational
  { abbr: "CUL", meaning: "See you later" },
  { abbr: "DE", meaning: "From / this is" },
  { abbr: "ES", meaning: "And" },
  { abbr: "FB", meaning: "Fine business (excellent)" },
  { abbr: "HI", meaning: "Laughter (often HI HI)" },
  { abbr: "HR", meaning: "Here" },
  { abbr: "HW", meaning: "How do you copy?" },
  { abbr: "OM", meaning: "Old man (any male operator)" },
  { abbr: "PSE", meaning: "Please" },
  { abbr: "R", meaning: "Received / roger" },
  { abbr: "TNX", meaning: "Thanks" },
  { abbr: "TU", meaning: "Thank you" },
  { abbr: "UR", meaning: "Your / you are" },
  { abbr: "YL", meaning: "Young lady (female operator)" },
  { abbr: "XYL", meaning: "Wife" },
  // Prosigns
  { abbr: "AR", meaning: "End of message" },
  { abbr: "AS", meaning: "Wait / stand by" },
  { abbr: "BK", meaning: "Break / invitation to transmit" },
  { abbr: "BT", meaning: "Break / separator" },
  { abbr: "K", meaning: "Over / go ahead" },
  { abbr: "KN", meaning: "Go ahead, named station only" },
  { abbr: "SK", meaning: "End of work / out" },
  // Numeric
  { abbr: "73", meaning: "Best regards" },
  { abbr: "88", meaning: "Love and kisses" },
  // Q-codes
  { abbr: "QRZ?", meaning: "Who is calling me?" },
  { abbr: "QSL", meaning: "I acknowledge receipt" },
  { abbr: "QSY", meaning: "Change frequency" },
  { abbr: "QTH", meaning: "What is your location?" },
];

/** Pick a random abbreviation, optionally avoiding the previous one. */
export function randomAbbr(exclude?: Abbr): Abbr {
  if (ABBREVIATIONS.length === 1) return ABBREVIATIONS[0]!;
  let pick: Abbr;
  do {
    pick = ABBREVIATIONS[Math.floor(Math.random() * ABBREVIATIONS.length)]!;
  } while (pick === exclude);
  return pick;
}
