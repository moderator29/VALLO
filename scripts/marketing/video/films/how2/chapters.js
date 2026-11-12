/** Video One (Nov 2026): the chapter pill and the ground, from its own clock (films/how2/timeline.json). */
const T = await fetch("/video/films/how2/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;

/* Every chapter turns on the frame the film cuts on (a breath ahead of the
   sentence), so the pill rolls its text inside the transition. */
const cut = (i) => s(i) - 0.12;

export const CHAPTERS = [
  { start: cut(3) + 0.2, end: cut(4), parts: [["Search and ", false], ["filter", true]] },
  { start: cut(4), end: cut(7), parts: [["The whole cost, ", false], ["up front", true]] },
  { start: cut(7), end: cut(8), parts: [["Homes ", false], ["for sale", true]] },
  { start: cut(8), end: cut(9), parts: [["Save and ", false], ["compare", true]] },
  { start: cut(9), end: cut(10), parts: [["Split the ", false], ["cost", true]] },
  { start: cut(10), end: cut(11), parts: [["Ask the ", false], ["assistant", true]] },
  { start: cut(11), end: cut(12), parts: [["Book a ", false], ["stay", true]] },
  { start: cut(12), end: cut(13), parts: [["Reserve a ", false], ["table", true]] },
  { start: cut(13), end: cut(14), parts: [["Every ", false], ["detail", true]] },
  { start: cut(14), end: cut(15), parts: [["Vallo ", false], ["Circle", true]] },
  { start: cut(15), end: cut(17), parts: [["Vallo ", false], ["Roommates", true]] },
];

export const groundAt = () => "dark";
