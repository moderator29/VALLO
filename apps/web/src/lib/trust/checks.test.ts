import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { personChecks, personStats, reasonsTitle, spaceChecks, spaceExplainer } from "./checks";
import { personFactsFrom } from "./person-checks-read";
import { proofDate, proofLines, type ProofLine } from "./proof-strip";

const t = getDictionary("en");
const copy = t.trustReasons;
const proof = t.trustVisible.proof;

const LINES: ProofLine[] = proofLines({
  isDemo: false,
  identitySeenAt: "2026-08-14T09:00:00Z",
  ownershipVerifiedAt: "2026-08-20T09:00:00Z",
  credentials: [
    { kind: "lasrera", number: "LAS-4411", company: null, registerName: "Ada Okafor", checkedAt: "2026-09-01T09:00:00Z" },
  ],
  renters: { attended: 6, asListed: 5, lastAt: "2026-10-01T00:00:00Z" },
});

describe("the checks on a space", () => {
  const checks = spaceChecks(
    { inspectedAt: "2026-09-12T10:00:00Z", addressCheckedAt: "2026-08-03T09:00:00Z", lines: LINES },
    copy,
    proof,
    "en",
  );

  it("splits what was looked at: the space, and the person who listed it", () => {
    expect(checks.space.map((c) => c.kind)).toEqual(["ownership", "inspected", "address", "renters"]);
    expect(checks.lister.map((c) => c.kind)).toEqual(["identity", "lasrera"]);
  });

  it("gives every row its date, who did it, what was looked at and what it does not prove", () => {
    for (const row of [...checks.space, ...checks.lister]) {
      expect(row.at, row.kind).toBeTruthy();
      expect(row.date, row.kind).toBeTruthy();
      expect(row.who.length, row.kind).toBeGreaterThan(5);
      expect(row.what.length, row.kind).toBeGreaterThan(20);
      expect(row.notProof.length, row.kind).toBeGreaterThan(20);
      expect(row.earn, row.kind).toBeNull();
    }
    expect(checks.space[1]?.date).toBe(proofDate("2026-09-12T10:00:00Z", "en"));
  });

  it("prints a register entry with the name and number the register shows", () => {
    expect(checks.lister[1]?.detail).toBe("Ada Okafor, number LAS-4411");
  });

  it("dates the renters' answers to the month, never to a day it cannot prove", () => {
    const renters = checks.space.find((c) => c.kind === "renters");
    expect(renters?.date).toBe("October 2026");
    expect(renters?.title).toBe("5 of 6 renters said it was as listed");
  });

  it("draws nothing for a date that is missing or does not parse", () => {
    const none = spaceChecks({ inspectedAt: null, addressCheckedAt: "not a date", lines: [] }, copy, proof, "en");
    expect(none.space).toEqual([]);
    expect(none.lister).toEqual([]);
  });

  it("an example listing has no lines, so it has no rows", () => {
    const demo = proofLines({ isDemo: true, identitySeenAt: "2026-08-14T09:00:00Z", ownershipVerifiedAt: "2026-08-20T09:00:00Z" });
    const out = spaceChecks({ inspectedAt: null, addressCheckedAt: null, lines: demo }, copy, proof, "en");
    expect(out.space.length + out.lister.length).toBe(0);
  });
});

describe("the explainer", () => {
  const rows = spaceExplainer(copy, proof);

  it("is about Vallo, not a space: no row carries a date", () => {
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.at).toBeNull();
      expect(row.date).toBeNull();
      expect(row.earn?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("lists only checks a space can earn today", () => {
    const kinds = rows.map((row) => row.kind);
    expect(kinds).not.toContain("availability");
    expect(kinds).not.toContain("photographs");
  });

  it("never says a negative about anything", () => {
    const text = rows.map((row) => `${row.title} ${row.earn}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/not yet|unverified|not verified|missing|pending/);
  });
});

describe("a person's checks", () => {
  it("draws only what carries a date, in a fixed order", () => {
    const rows = personChecks(
      {
        emailConfirmedAt: "2026-11-12T08:00:00Z",
        identitySeenAt: "2026-11-03T08:00:00Z",
        identityMethod: "seen",
        phoneConfirmedAt: null,
        ownershipSeenAt: "2026-11-05T08:00:00Z",
      },
      copy,
      "en",
    );
    expect(rows.map((r) => r.kind)).toEqual(["personIdentity", "email", "ownershipSeen"]);
    expect(rows.every((r) => r.at && r.date)).toBe(true);
  });

  it("nothing dated is nothing drawn", () => {
    expect(personChecks({}, copy, "en")).toEqual([]);
    expect(personChecks({ identitySeenAt: "", phoneConfirmedAt: "soon" }, copy, "en")).toEqual([]);
  });

  it("the row of the read keeps dates and nothing else", () => {
    const facts = personFactsFrom([
      {
        identity_seen_at: "2026-11-03T08:00:00Z",
        phone_confirmed_at: "2026-11-12T08:00:00Z",
        email_confirmed_at: "never",
        phone: "+2348030000000",
        email: "a@b.c",
      },
    ]);
    expect(facts).toEqual({
      identitySeenAt: "2026-11-03T08:00:00Z",
      identityMethod: "seen",
      phoneConfirmedAt: "2026-11-12T08:00:00Z",
    });
    expect(JSON.stringify(facts)).not.toMatch(/\+234|@/);
    expect(personFactsFrom(null)).toEqual({});
    expect(personFactsFrom("x")).toEqual({});
  });
});

describe("a person's numbers", () => {
  it("builds a cell only for a fact that exists", () => {
    expect(personStats({}, copy, "en")).toEqual([]);
    expect(personStats({ reviewCount: 0, averageRating: 4.8, lets: 0 }, copy, "en")).toEqual([]);
  });

  it("prints a rating only with the reviews behind it", () => {
    const cells = personStats({ reviewCount: 12, averageRating: 4.66, memberSince: "2026-03-02T00:00:00Z" }, copy, "en");
    expect(cells.map((c) => c.key)).toEqual(["reviews", "rating", "since"]);
    expect(cells[1]?.value).toBe("4.7");
    expect(cells[2]?.value).toBe("Mar 2026");
  });
});

describe("the section's heading", () => {
  it("uses a first name, and falls back when there is none to use", () => {
    expect(reasonsTitle("Sophia Duru", copy)).toBe("Reasons to trust Sophia");
    expect(reasonsTitle("", copy)).toBe(copy.person.titlePlain);
    expect(reasonsTitle("@spaces", copy)).toBe(copy.person.titlePlain);
    expect(reasonsTitle("user_42", copy)).toBe(copy.person.titlePlain);
  });
});
