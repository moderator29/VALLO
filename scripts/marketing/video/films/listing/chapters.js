/** The listing film's chapter pill and ground, from its own clock (films/listing/timeline.json). */
const T = await fetch("/video/films/listing/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;
const e = (i) => T.sentences.find((x) => x.i === i).end;

/* Every chapter turns on the frame the film cuts on, so the pill rolls its
   text inside the transition rather than a beat after it. */
const cut = (i) => s(i) - 0.12;

export const CHAPTERS = [
  { start: cut(2), end: cut(3), parts: [["No agency ", false], ["fee", true]] },
  { start: cut(3), end: cut(4), parts: [["Put it ", false], ["up", true]] },
  { start: cut(4), end: cut(5), parts: [["The whole cost, ", false], ["shown", true]] },
  { start: cut(5), end: cut(6), parts: [["Inspect, then ", false], ["agree", true]] },
  { start: cut(6), end: cut(7), parts: [["Paid to your ", false], ["bank", true]] },
  /* Sentence seven's own words stand alone and big, so the pill stays away
     for it and comes back only for "Your place. Your price. Your account." */
  { start: s(8) - 0.45, end: e(8) + 0.3, parts: [["Listed by ", false], ["the owner", true]] },
];

export const groundAt = () => "dark";
