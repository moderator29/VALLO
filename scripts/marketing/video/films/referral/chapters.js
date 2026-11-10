/**
 * The referral film's chapter pill and ground, from its own clock
 * (films/referral/timeline.json).
 *
 * Each chapter starts on the cut the film cuts on, which is the breath
 * between two sentences (s(i) - 0.2), so the pill turns over with the
 * picture rather than a beat after it.
 *
 * Sentence seven's pill USED TO READ "No limit, no catch". There is a limit,
 * it is 1,500 qualified referrals a month, it is printed on the product's own
 * "How it is counted" plate, and an earlier draft of the script that said "no
 * limit" was corrected. The pill says the figure.
 */
const T = await fetch("/video/films/referral/timeline.json", { cache: "no-store" }).then((r) => r.json());
const s = (i) => T.sentences.find((x) => x.i === i).start;
const cut = (i) => s(i) - 0.2;

export const CHAPTERS = [
  { start: cut(2), end: cut(3), parts: [["Share your ", false], ["link", true]] },
  { start: cut(3), end: cut(4), parts: [["Eighty naira ", false], ["a friend", true]] },
  { start: cut(4), end: cut(5), parts: [["A real ", false], ["person", true]] },
  { start: cut(5), end: cut(6), parts: [["Watch it ", false], ["climb", true]] },
  { start: cut(6), end: cut(7), parts: [["Withdraw at ", false], ["₦1,000", true]] },
  { start: cut(7), end: cut(8), parts: [["Up to ", false], ["1,500 a month", true]] },
  { start: cut(8), end: s(9) - 0.55, parts: [["Share it. ", false], ["Earn.", true]] },
];

export const groundAt = () => "dark";
