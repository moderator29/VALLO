/** Video Two's chapter pill and ground, from its own clock (films/vision2/timeline.json). */
const T = await fetch("/video/films/vision2/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;

export const CHAPTERS = [
  { start: s(3) - 0.1, end: s(5) - 0.1, parts: [["The full ", false], ["cost", true]] },
  { start: s(5) - 0.1, end: s(6) - 0.1, parts: [["Save and ", false], ["compare", true]] },
  { start: s(6) - 0.1, end: s(7) - 0.1, parts: [["Stays and ", false], ["tables", true]] },
  { start: s(8) - 0.1, end: s(11) - 0.1, parts: [["Vallo ", false], ["Circle", true]] },
  { start: s(11) - 0.1, end: s(14) - 0.1, parts: [["Vallo ", false], ["Roommates", true]] },
  { start: s(14) - 0.1, end: s(16) - 0.1, parts: [["What was ", false], ["confirmed", true]] },
  { start: s(16) - 0.1, end: s(18) - 0.1, parts: [["Your ", false], ["workspace", true]] },
  { start: s(18) - 0.1, end: s(19) - 0.1, parts: [["The AI ", false], ["assistant", true]] },
];

export const groundAt = () => "dark";
