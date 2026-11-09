import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { legacyReserveSentence } from "@/lib/money/copy";
import { bpsAsPercentText } from "@/lib/money/percent";
import { stringLiterals } from "./source-scan";

/**
 * THE LISTER'S RESERVE LINE IS A MONEY SENTENCE, SO IT LIVES IN copy.ts (A9).
 *
 * The agreement page wrote "Under the terms you agreed, X% of the total was
 * set aside from your share for the Vallo Guarantee reserve" inline. Money
 * sentences live in `lib/money/copy.ts`, so the Terms, the help centre and the
 * screens cannot drift. Same words, a function of the percentage, and drawn
 * only when the frozen rate is above zero (D51).
 */
const PAGE = "app/(app)/agreements/[id]/page.tsx";
/* The page's body moved into the shared agreement view; the line is drawn there, and the rate is still decided in the page. */
const BODY = "components/app/agreements/AgreementBody.tsx";
const page = () => readFileSync(join(process.cwd(), "src", PAGE), "utf8");
const body = () => readFileSync(join(process.cwd(), "src", BODY), "utf8");

describe("legacyReserveSentence", () => {
  it("says the sentence the page said, word for word", () => {
    expect(legacyReserveSentence(bpsAsPercentText(150))).toBe(
      "Under the terms you agreed, 1.5% of the total was set aside from your share for the Vallo Guarantee reserve.",
    );
    expect(legacyReserveSentence(bpsAsPercentText(200))).toContain(" 2% of the total ");
  });

  it("is no longer written in the agreement page", () => {
    const inline = [...stringLiterals(page()), ...stringLiterals(body())].filter(({ text }) => /set aside|Guarantee reserve/i.test(text));
    expect(inline).toEqual([]);
  });

  it("is drawn for the lister only while a contribution was frozen into the terms", () => {
    const source = body();
    const at = source.indexOf("legacyReserveSentence(");
    expect(at).toBeGreaterThan(-1);
    const guard = source.slice(source.lastIndexOf("{a.role", at), at);
    expect(guard).toContain('a.role === "owner" && legacyContribution');
    expect(page()).toMatch(/const legacyContribution = guaranteeBps !== null && guaranteeBps > 0;/);
  });
});
