/** The sign-up film's chapter pill and ground, from its own clock (films/signup/timeline.json). */
const T = await fetch("/video/films/signup/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;
const e = (i) => T.sentences.find((x) => x.i === i).end;

export const CHAPTERS = [
  { start: s(2) - 0.1, end: s(3) - 0.1, parts: [["Three ", false], ["things", true]] },
  { start: s(3) - 0.1, end: s(4) - 0.1, parts: [["What you ", false], ["skip", true]] },
  { start: s(4) - 0.1, end: s(5) - 0.1, parts: [["Confirm your ", false], ["email", true]] },
  { start: s(5) - 0.1, end: s(6) - 0.1, parts: [["One account, ", false], ["everything", true]] },
  { start: s(6) - 0.1, end: s(7) - 0.1, parts: [["It stays ", false], ["with you", true]] },
  { start: s(7) - 0.1, end: s(8) - 0.15, parts: [["Or list your ", false], ["own place", true]] },
];

export const groundAt = () => "dark";
