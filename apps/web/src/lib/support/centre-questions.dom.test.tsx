import { describe, expect, it } from "vitest";
import { buildSupportEntries } from "./search-entries";
import { prepare, searchPrepared } from "./search";

/**
 * THE TEST OF DONE IS A REAL QUESTION, not a page count (the founder's
 * brief, section 12; the lead's brief of 14 November 2026).
 *
 * These are the questions a Nigerian renter, buyer, agent or host actually
 * arrives with, taken from the categories the FAQ already carries and the
 * money rules in `lib/money/copy.ts`. Each one must come back with an answer
 * from the centre's own content. The centre is one index over help, docs,
 * guides and the legal pages, so this is the whole centre and not one store.
 *
 * It asserts THAT an answer is found and from where, never the words of the
 * answer: the wording is the content's to change, and a test that pinned it
 * would make every correction a test failure.
 */
const ASKED: readonly { question: string; why: string }[] = [
  { question: "how do I pay for a stay", why: "the commonest money question a guest arrives with" },
  { question: "is there a fee for an inspection", why: "the scam this platform exists to prevent" },
  { question: "how do I know an agent is real", why: "the trust question, before any money moves" },
  { question: "what happens after I submit an offer", why: "the offers journey nobody is told about" },
  { question: "cancel a booking refund", why: "the question that arrives angry" },
  { question: "how do I list my property", why: "the supply side's first question" },
  { question: "delete my account", why: "a right, and it must never be hard to find" },
  { question: "someone asked me to pay outside Vallo", why: "the off-platform ask, the highest-harm moment" },
  { question: "how do I report a listing", why: "safety, and it must be two taps from anywhere" },
  { question: "what does verification do", why: "the passport, which the product leans on everywhere" },
];

describe("the help centre answers the questions people actually ask", () => {
  const prepared = prepare(buildSupportEntries());

  it("finds an answer for every real question, from the whole centre", () => {
    const missed: string[] = [];
    for (const { question } of ASKED) {
      const hits = searchPrepared(prepared, question);
      if (hits.length === 0) missed.push(question);
    }
    expect(missed).toEqual([]);
  });

  it("searches every section, not the help answers alone", () => {
    /* The in-app palette used to search the 64 help answers only, so a
       signed-in member found less than a stranger. The index is the whole
       centre; this is what keeps it that way. */
    const sections = new Set(buildSupportEntries().map((e) => e.section));
    expect([...sections].sort()).toEqual(["docs", "guides", "help", "legal"]);
  });

  it("puts a readable answer, not an empty row, behind each question", () => {
    for (const { question } of ASKED) {
      const [first] = searchPrepared(prepared, question);
      expect(first, question).toBeDefined();
      expect(first!.entry.title.length, question).toBeGreaterThan(3);
      expect(first!.entry.href.startsWith("/"), question).toBe(true);
    }
  });
});
