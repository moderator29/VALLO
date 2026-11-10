/** Video Two's chapter pill and ground, from its own clock (films/vision/timeline.json). */
const T = await fetch("/video/films/vision/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;
const e = (i) => T.sentences.find((x) => x.i === i).end;

export const CHAPTERS = [
  { start: s(6) - 0.1, end: s(9) - 0.2, parts: [["For owners and ", false], ["landlords", true]] },
  { start: s(9) - 0.1, end: s(11) - 0.1, parts: [["The host ", false], ["desk", true]] },
  { start: s(11) - 0.1, end: s(12) - 0.2, parts: [["Table ", false], ["deposits", true]] },
  { start: s(12) - 0.1, end: s(14) - 0.2, parts: [["Agents and ", false], ["firms", true]] },
  { start: s(14) - 0.1, end: s(16) - 0.2, parts: [["Fair for ", false], ["everyone", true]] },
  { start: s(16) - 0.1, end: s(17) - 0.1, parts: [["Your Vallo ", false], ["passport", true]] },
  { start: s(17) - 0.1, end: s(19) - 0.1, parts: [["Tenancy and ", false], ["rent", true]] },
  { start: s(19) - 0.1, end: s(21) - 0.2, parts: [["Wallet and ", false], ["escrow", true]] },
  { start: s(24) - 0.1, end: e(27) + 0.4, parts: [["Trust at every ", false], ["step", true]] },
  { start: s(28) - 0.1, end: e(30) + 0.5, parts: [["Local ", false], ["talk", true]] },
  { start: s(32) - 0.1, end: e(37) + 0.5, parts: [["Referral ", false], ["rewards", true]] },
];

export const groundAt = () => "dark";
