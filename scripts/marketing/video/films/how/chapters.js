/**
 * Video One's chapter pill and ground, from its own clock (films/how/timeline.json).
 * Times are the voice's sentence starts (films/plan.py places them on the beat).
 */
const T = await fetch("/video/films/how/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;
const e = (i) => T.sentences.find((x) => x.i === i).end;

export const CHAPTERS = [
  { start: s(5) - 0.2, end: s(7) - 0.1, parts: [["Search and ", false], ["filter", true]] },
  { start: s(7) - 0.1, end: s(9) - 0.1, parts: [["The full cost, ", false], ["up front", true]] },
  { start: s(9) - 0.1, end: s(11) - 0.1, parts: [["Price ", false], ["check", true]] },
  { start: s(11) - 0.1, end: s(14) - 0.1, parts: [["Talk straight to the ", false], ["lister", true]] },
  { start: s(14) - 0.1, end: s(15) - 0.2, parts: [["Safe in ", false], ["chat", true]] },
  { start: s(15) - 0.1, end: s(18) - 0.1, parts: [["Protected ", false], ["payment", true]] },
  { start: s(18) - 0.1, end: s(20) - 0.1, parts: [["Book a ", false], ["room", true]] },
  { start: s(20) - 0.1, end: s(22) - 0.2, parts: [["Reserve a ", false], ["table", true]] },
  { start: s(22) - 0.1, end: s(24) - 0.2, parts: [["Your ", false], ["wallet", true]] },
  { start: s(27) - 0.1, end: s(28) - 0.2, parts: [["Checked by a ", false], ["person", true]] },
  { start: s(28) - 0.1, end: s(31) - 0.2, parts: [["Ask ", false], ["anything", true]] },
  { start: s(31) - 0.1, end: e(32) + 0.6, parts: [["Speaks your ", false], ["language", true]] },
];

export const groundAt = () => "dark";
