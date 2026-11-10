import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FEE_PERCENT,
  OTHER_PROCESSOR_FEE_BPS,
  OTHER_TOTAL_FEE_BPS,
  RENT_PARTNER_FEE_BPS,
  RENT_TOTAL_FEE_BPS,
  VALLO_FEE_BPS,
  feePercentText,
} from "./fee-schedule";
import { FEE_OTHER_LINE, FEE_PROVIDER_CHARGES, FEE_RENT_LINE, FEE_STATEMENT, FEE_WHO_PAYS, WHO_PAYS_SENTENCE } from "./copy";
import { MONEY_IN_BAND_ONE_BPS } from "./protected-fees";

/**
 * THE FEE SCHEDULE IS ONE SOURCE (founder, 10 November 2026): rent costs about
 * 3.5 percent (Vallo 2 plus the payment partner about 1.5), every other
 * payment about 3.5 percent (Vallo 2 plus the processor about 1.5). Every
 * statement reads it; a rate typed anywhere else is caught here.
 */
describe("the schedule", () => {
  it("is the founder's figures", () => {
    expect(VALLO_FEE_BPS).toBe(200);
    expect(RENT_PARTNER_FEE_BPS).toBe(150);
    expect(RENT_TOTAL_FEE_BPS).toBe(350);
    expect(OTHER_PROCESSOR_FEE_BPS).toBe(150);
    expect(OTHER_TOTAL_FEE_BPS).toBe(350);
  });

  it("prints basis points as the percentage a person reads, with integer maths", () => {
    expect(feePercentText(350)).toBe("3.5");
    expect(feePercentText(200)).toBe("2");
    expect(feePercentText(150)).toBe("1.5");
    expect(FEE_PERCENT.rentTotal).toBe("3.5");
  });

  it("feeds the protected rail's first fee band", () => {
    expect(MONEY_IN_BAND_ONE_BPS).toBe(RENT_PARTNER_FEE_BPS);
  });
});

describe("the statements", () => {
  it("say what each part is, and that the provider's charges are the provider's", () => {
    expect(FEE_RENT_LINE).toContain("3.5%");
    expect(FEE_RENT_LINE).toContain("Vallo's service fee of 2%");
    expect(FEE_RENT_LINE).toContain("payment partner's fee of about 1.5%");
    expect(FEE_OTHER_LINE).toContain("3.5%");
    expect(FEE_OTHER_LINE).toContain("payment processor's fee of about 1.5%");
    expect(FEE_PROVIDER_CHARGES).toMatch(/their charges/);
    expect(FEE_WHO_PAYS).toMatch(/Renters and guests pay exactly the listed price/);
  });

  it("reach the help, assistant and copilot sentence and the Terms, from the same constants", () => {
    expect(WHO_PAYS_SENTENCE).toContain(FEE_RENT_LINE);
    expect(WHO_PAYS_SENTENCE).toContain(FEE_OTHER_LINE);
    expect(FEE_STATEMENT).toContain(FEE_PROVIDER_CHARGES);
    /* The Terms are JSX; read the source, which must take the statement from copy.ts and type no rate. */
    const terms = readFileSync(join(__dirname, "..", "legal", "terms.tsx"), "utf8");
    expect(terms).toContain("{FEE_RENT_LINE}");
    expect(terms).toContain("{FEE_OTHER_LINE}");
    expect(terms).toContain("{FEE_PROVIDER_CHARGES}");
  });
});

const SRC = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("no second source", () => {
  it("types the total rate in no member-facing file", () => {
    const allowed = [/lib\/money\/fee-schedule\.ts$/, /\(dev\)\//, /app\/admin\//];
    const found: string[] = [];
    for (const file of files(SRC)) {
      const at = relative(SRC, file).split("\\").join("/");
      if (allowed.some((rule) => rule.test(at))) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
          if (/\b3\.5 ?(%|per ?cent|percent)/.test(line)) found.push(`${at}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
