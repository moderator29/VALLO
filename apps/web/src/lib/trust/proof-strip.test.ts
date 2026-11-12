import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDictionary } from "@vallo/i18n";

import {
  PROOF_LINE_ORDER,
  compactProofLines,
  proofExplainKey,
  proofFactsOf,
  proofLineText,
  proofLines,
  provableDate,
  type ProofFacts,
} from "./proof-strip";
import type { Listing } from "@/lib/listings/types";

const copy = getDictionary("en").trustVisible.proof;

/** Every source filled, the shape the strip will have once V-31, V-45 and V-05 land. */
const FULL: ProofFacts = {
  isDemo: false,
  identitySeenAt: "2026-08-12T10:00:00Z",
  identityMethod: "seen",
  credentials: [
    { kind: "lasrera", number: "LASRERA/AG/12345", company: null, registerName: "Chidi Okeke", checkedAt: "2026-09-03T09:00:00Z" },
  ],
  mandateVerifiedAt: "2026-08-14T09:00:00Z",
  ownerConfirmedAvailableAt: "2026-09-20T09:00:00Z",
  photographedAt: "2026-09-04T09:00:00Z",
  renters: { attended: 6, asListed: 6, lastAt: "2026-09-21T09:00:00Z" },
};

describe("the proof strip model", () => {
  it("prints every line in the fixed order when every fact is dated", () => {
    expect(proofLines(FULL).map((l) => l.kind)).toEqual([...PROOF_LINE_ORDER]);
  });

  it("prints nothing for a listing with nothing dated: no placeholder, no cross", () => {
    expect(proofLines({ isDemo: false })).toEqual([]);
  });

  it("prints nothing at all for an example listing, whatever its row says", () => {
    expect(proofLines({ ...FULL, isDemo: true })).toEqual([]);
  });

  it("leaves out exactly the null lines and keeps the order of the rest", () => {
    const lines = proofLines({ isDemo: false, identitySeenAt: FULL.identitySeenAt, photographedAt: FULL.photographedAt });
    expect(lines.map((l) => l.kind)).toEqual(["identity", "photographs"]);
  });

  it("treats a date that does not parse exactly as a null", () => {
    expect(provableDate("not a date")).toBeNull();
    expect(provableDate("")).toBeNull();
    expect(provableDate(null)).toBeNull();
    expect(provableDate(undefined)).toBeNull();
    expect(proofLines({ isDemo: false, mandateVerifiedAt: "garbage" })).toEqual([]);
  });

  it("never prints two authorities, and prefers the title document", () => {
    const lines = proofLines({
      isDemo: false,
      ownershipVerifiedAt: "2026-08-01T00:00:00Z",
      mandateVerifiedAt: "2026-08-02T00:00:00Z",
    });
    expect(lines).toEqual([{ kind: "authority", at: "2026-08-01T00:00:00Z", basis: "ownership" }]);
  });

  it("keeps the two identity methods apart", () => {
    const seen = proofLines({ isDemo: false, identitySeenAt: FULL.identitySeenAt })[0]!;
    const nimc = proofLines({ isDemo: false, identitySeenAt: FULL.identitySeenAt, identityMethod: "nimc" })[0]!;
    expect(proofLineText(seen, copy, "en")).toContain("identity document seen by Vallo");
    expect(proofLineText(nimc, copy, "en")).toContain("matched with NIMC");
    expect(proofExplainKey(seen)).toBe("identity");
    expect(proofExplainKey(nimc)).toBe("identityNimc");
  });

  it("refuses a renters line with no witnesses or an impossible count", () => {
    expect(proofLines({ isDemo: false, renters: { attended: 0, asListed: 0, lastAt: FULL.renters!.lastAt } })).toEqual([]);
    expect(proofLines({ isDemo: false, renters: { attended: 6, asListed: 7, lastAt: FULL.renters!.lastAt } })).toEqual([]);
    expect(proofLines({ isDemo: false, renters: { attended: 6, asListed: 1, lastAt: "nope" } })).toEqual([]);
    /* Four renters is below the public minimum of five. */
    expect(proofLines({ isDemo: false, renters: { attended: 4, asListed: 4, lastAt: FULL.renters!.lastAt } })).toEqual([]);
  });

  it("gives the card at most two lines, the first two, in order", () => {
    expect(compactProofLines(proofLines(FULL)).map((l) => l.kind)).toEqual(["identity", "credentials"]);
  });
});

describe("the proof strip's words", () => {
  it("prints a date on every line", () => {
    for (const line of proofLines(FULL)) {
      expect(proofLineText(line, copy, "en")).toMatch(/2026/);
    }
    const mandate = proofLines({ isDemo: false, mandateVerifiedAt: "2026-08-14T09:00:00Z" })[0]!;
    expect(proofLineText(mandate, copy, "en")).toBe("Owner's instruction seen and owner spoken to, 14 Aug 2026");
  });

  it("dates in Lagos time, so a stamp just before midnight UTC is still that Lagos day", () => {
    const late = proofLines({ isDemo: false, ownershipVerifiedAt: "2026-08-14T23:30:00Z" })[0]!;
    expect(proofLineText(late, copy, "en")).toBe("Title document seen in the lister's name, 15 Aug 2026");
  });

  it("counts renters honestly: all, some, never below five, and dated to the month", () => {
    const at = "2026-09-01T00:00:00Z";
    const all = proofLines({ isDemo: false, renters: { attended: 6, asListed: 6, lastAt: at } })[0]!;
    const some = proofLines({ isDemo: false, renters: { attended: 6, asListed: 4, lastAt: at } })[0]!;
    const one = proofLines({ isDemo: false, renters: { attended: 1, asListed: 1, lastAt: at } });
    expect(proofLineText(all, copy, "en")).toBe(
      "6 renters with a viewing the lister confirmed answered afterwards. All 6 said the agent and the flat were as listed, as of September 2026.",
    );
    expect(proofLineText(some, copy, "en")).toBe(
      "6 renters with a viewing the lister confirmed answered afterwards. 4 of 6 said the agent and the flat were as listed, as of September 2026.",
    );
    /* One renter is never a public line: the lister would know whose answer it was. */
    expect(one).toEqual([]);
  });

  it("has an is and an is-not for every line, and names the land registry where it matters", () => {
    for (const line of proofLines(FULL)) {
      const e = copy.explain[proofExplainKey(line)];
      expect(e.is.length).toBeGreaterThan(20);
      expect(e.isNot.length).toBeGreaterThan(20);
    }
    expect(copy.explain.ownership.isNot).toContain("not a land registry");
  });

  it("carries no em dash and no banned word", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toMatch(/—/);
    expect(all.toLowerCase()).not.toMatch(/\b(demo|sample|preview|coming soon|lorem|guaranteed|secure)\b/);
  });
});

describe("the facts a listing carries", () => {
  it("gathers only what the listing has", () => {
    const listing = {
      isDemo: false,
      listerIdentitySeenAt: "2026-08-12T10:00:00Z",
      mandateVerifiedAt: "2026-08-14T09:00:00Z",
    } as Listing;
    expect(proofFactsOf(listing)).toEqual({
      isDemo: false,
      identitySeenAt: "2026-08-12T10:00:00Z",
      mandateVerifiedAt: "2026-08-14T09:00:00Z",
    });
  });
});

describe("the strip is mounted where the entry says", () => {
  /* Components cannot render under this vitest config (see
     lister-role-read.test.ts), so the mount is held by source. */
  const root = join(__dirname, "..", "..");
  it("on the card, compact", () => {
    const src = readFileSync(join(root, "components/app/ListingCard.tsx"), "utf8");
    expect(src).toMatch(/<ProofStrip[\s\S]*?variant="compact"/);
  });
  it("on the listing page, full", () => {
    const src = readFileSync(join(root, "app/(app)/listing/[id]/page.tsx"), "utf8");
    expect(src).toMatch(/<ProofStrip[\s\S]*?variant="full"/);
  });
  it("and the component draws nothing when it has no lines", () => {
    const src = readFileSync(join(root, "components/app/listing/ProofStrip.tsx"), "utf8");
    expect(src).toContain("if (shown.length === 0) return null;");
  });
});

describe("a firm's listing says whose identity was seen", () => {
  it("names the person who listed it for the firm, and explains it is not a CAC check", () => {
    const line = proofLines({ isDemo: false, identitySeenAt: "2026-08-12T10:00:00Z", listedForFirm: true })[0]!;
    expect(proofLineText(line, copy, "en")).toBe(
      "The identity document of the person who listed this for the firm seen by Vallo, 12 Aug 2026",
    );
    expect(proofExplainKey(line)).toBe("identityFirm");
    expect(copy.explain.identityFirm.isNot).toContain("CAC");
  });
});

describe("dated credentials (V-87)", () => {
  it("prints a register entry with the name the register shows, and a CAC line only with its company", () => {
    const lines = proofLines({
      isDemo: false,
      credentials: [
        { kind: "lasrera", number: "LASRERA/AG/12345", company: null, registerName: "Chidi Okeke", checkedAt: "2026-09-03T09:00:00Z" },
        { kind: "cac_director", number: "RC 1234567", company: "Acme Properties Ltd", checkedAt: "2026-09-03T09:00:00Z" },
        { kind: "cac_director", number: "RC 1", company: null, checkedAt: "2026-09-03T09:00:00Z" },
        { kind: "esvarbon", number: "ESV/1", company: null, registerName: "Chidi Okeke", checkedAt: "not a date" },
      ],
    });
    expect(lines.map((l) => proofLineText(l, copy, "en"))).toEqual([
      "Registered with LASRERA as Chidi Okeke, number LASRERA/AG/12345, checked on the LASRERA register 3 Sep 2026",
      "A director of Acme Properties Ltd (RC 1234567), checked with the CAC 3 Sep 2026",
    ]);
    expect(proofExplainKey(lines[0]!)).toBe("credential");
  });

  it("prints nothing for a register entry with no name on it", () => {
    const lines = proofLines({
      isDemo: false,
      credentials: [{ kind: "esvarbon", number: "ESV/1", company: null, registerName: null, checkedAt: "2026-09-03T09:00:00Z" }],
    });
    expect(lines).toEqual([]);
  });
});
