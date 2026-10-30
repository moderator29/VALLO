import { describe, expect, it } from "vitest";
import { LOCALES, getDictionary } from "@vallo/i18n";
import { NO_DOCUMENT_ANSWER } from "./roles";
import {
  ASSOCIATION_PROOFS,
  EXPERIENCE_BANDS,
  FEE_MAX_BPS,
  FEE_STEP_BPS,
  NO_OWNERSHIP_DOCUMENT,
  OWNERSHIP_ANSWERS,
  OWNERSHIP_DOCUMENTS,
  REGISTER_ROLES,
  REGISTER_STEPS,
  agentRegistrationSchema,
  bpsAsFraction,
  canEarnOwnershipMark,
  earliestStep,
  firmRegistrationRefined,
  isOwnershipAnswer,
  isPersonRole,
  ownerRegistrationSchema,
  shareOfMinor,
  stepFee,
  tenantTotal,
  workspaceKindFor,
} from "./registration";

/**
 * The specs for the three registration forms.
 *
 * Most of these exist to make ONE claim checkable: that "I have none of these"
 * is treated exactly like every other answer everywhere except the one place
 * where it honestly differs. A comment promising that drifts; a test that
 * asserts parity fails the day somebody adds a special case.
 */

describe("the three forms", () => {
  it("has four screens each, which is what the three governing images draw", () => {
    for (const role of REGISTER_ROLES) {
      expect(REGISTER_STEPS[role]).toHaveLength(4);
    }
  });

  it("ends every one of them on its own confirmation screen", () => {
    expect(REGISTER_STEPS.owner[3]).toBe("done");
    expect(REGISTER_STEPS.agent[3]).toBe("done");
    expect(REGISTER_STEPS.firm[3]).toBe("done");
  });

  it("keeps the firm a workspace and not a person role", () => {
    expect(workspaceKindFor("firm")).toBe("firm");
    expect(isPersonRole("owner")).toBe(true);
    expect(isPersonRole("agent")).toBe(true);
    expect(isPersonRole("firm")).toBe(false);
  });
});

describe("I have none of these", () => {
  it("is one of the answers rather than an escape from them", () => {
    expect(OWNERSHIP_ANSWERS).toContain(NO_OWNERSHIP_DOCUMENT);
    expect(OWNERSHIP_ANSWERS).toHaveLength(OWNERSHIP_DOCUMENTS.length + 1);
    expect(isOwnershipAnswer("none")).toBe(true);
  });

  /*
   * THE PARITY TEST, AND IT IS THE ONE THAT MATTERS.
   *
   * The same submission, twice, differing only in the answer to screen three.
   * If somebody ever adds a required field, an extra step or a refusal on the
   * honest answer, these two stop matching and this fails.
   */
  it("reaches a filed application on exactly the same terms as a Certificate of Occupancy", () => {
    const base = {
      role: "owner" as const,
      fullName: "Oluwaseyi Omojuni",
      phone: "08031234567",
      nin: "12345678901",
      stateCode: "LA",
      lgaCode: "LA-ETI",
      area: "Lekki Phase 1",
      acceptTerms: true,
      acceptPayOnVallo: true,
    };
    const withDocument = ownerRegistrationSchema.safeParse({
      ...base,
      ownershipDocument: "certificate_of_occupancy",
    });
    const withNothing = ownerRegistrationSchema.safeParse({
      ...base,
      ownershipDocument: "none",
    });

    expect(withDocument.success).toBe(true);
    expect(withNothing.success).toBe(true);
    expect(Object.keys(withNothing.success ? withNothing.data : {}).sort()).toEqual(
      Object.keys(withDocument.success ? withDocument.data : {}).sort(),
    );
  });

  it("withholds the ownership mark and nothing else", () => {
    expect(canEarnOwnershipMark("none")).toBe(false);
    for (const doc of OWNERSHIP_DOCUMENTS) {
      expect(canEarnOwnershipMark(doc)).toBe(true);
    }
  });

  it("says the same thing the door said, so the promise cannot drift", () => {
    const en = getDictionary("en").supply.register.owner.proof;
    expect(en.docs.none).toBe(NO_DOCUMENT_ANSWER.label);
    expect(en.stillListBody).toBe(NO_DOCUMENT_ANSWER.reassurance);
  });

  it("offers it in every locale rather than falling back to English on the one answer that matters", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale).supply.register.owner.proof.docs.none).toBeTruthy();
    }
  });
});

describe("the fee control", () => {
  it("starts undeclared, because zero is a claim and silence is not", () => {
    expect(stepFee(null, 1)).toBe(FEE_STEP_BPS);
  });

  it("lets a person reach a real zero deliberately, and step back out of it", () => {
    expect(stepFee(FEE_STEP_BPS, -1)).toBe(0);
    expect(stepFee(0, -1)).toBeNull();
  });

  it("refuses to run past the whole rent", () => {
    expect(stepFee(FEE_MAX_BPS, 1)).toBe(FEE_MAX_BPS);
  });

  it("reads basis points as the fraction a percentage formatter wants", () => {
    expect(bpsAsFraction(1000)).toBeCloseTo(0.1, 10);
    expect(bpsAsFraction(50)).toBeCloseTo(0.005, 10);
  });

  it("keeps a share of a rent in whole kobo", () => {
    expect(shareOfMinor(250_000_000, 1000)).toBe(25_000_000);
    expect(Number.isInteger(shareOfMinor(333_333_333, 333))).toBe(true);
  });
});

describe("what a tenant actually pays", () => {
  const rent = 250_000_000;

  it("adds only what the agent has declared", () => {
    const total = tenantTotal({ rentMinor: rent, agencyFeeBps: 1000, legalFeeBps: 500 });
    expect(total.agencyMinor).toBe(25_000_000);
    expect(total.legalMinor).toBe(12_500_000);
    expect(total.totalMinor).toBe(287_500_000);
    expect(total.undeclared).toEqual([]);
  });

  /* A cost the lister has not declared is NOT DECLARED and never zero. */
  it("names an undeclared fee instead of counting it as nothing", () => {
    const total = tenantTotal({ rentMinor: rent, agencyFeeBps: null, legalFeeBps: 500 });
    expect(total.agencyMinor).toBeNull();
    expect(total.undeclared).toEqual(["agency"]);
    expect(total.totalMinor).toBe(262_500_000);
  });

  it("declares a real zero as a real zero", () => {
    const total = tenantTotal({ rentMinor: rent, agencyFeeBps: 0, legalFeeBps: 0 });
    expect(total.agencyMinor).toBe(0);
    expect(total.undeclared).toEqual([]);
    expect(total.totalMinor).toBe(rent);
  });

  it("is honest about the costs it cannot know, which belong to a listing", () => {
    const total = tenantTotal({ rentMinor: rent, agencyFeeBps: 1000, legalFeeBps: 500 });
    expect(total.perListing).toEqual(["caution", "service", "agreement"]);
  });
});

describe("the agent and firm schemas", () => {
  it("accepts an agent who has declared no fee at all", () => {
    const parsed = agentRegistrationSchema.safeParse({
      role: "agent",
      fullName: "Adebayo Tunde",
      phone: "08031234567",
      nin: "12345678901",
      experience: "1_2",
      agencyFeeBps: null,
      legalFeeBps: null,
      acceptTerms: true,
      acceptPayOnVallo: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a fee larger than the whole rent, which is a typing mistake and not a price", () => {
    const parsed = agentRegistrationSchema.safeParse({
      role: "agent",
      fullName: "Adebayo Tunde",
      phone: "08031234567",
      experience: "1_2",
      agencyFeeBps: FEE_MAX_BPS + 1,
      legalFeeBps: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("offers an agent a band for every honest answer, including declining to say", () => {
    expect(EXPERIENCE_BANDS).toContain("unstated");
  });

  it("never makes LASRERA a condition of filing a firm", () => {
    const parsed = firmRegistrationRefined.safeParse({
      role: "firm",
      fullName: "Tunde Adebayo",
      businessName: "Acme Properties Ltd",
      rcNumber: "RC 1234567",
      officeAddress: "1 Admiralty Way, Lekki",
      lasreraNumber: "",
      associationProof: "principal",
      principalEmail: "principal@acmeproperties.test",
      team: [],
      acceptTerms: true,
      acceptPayOnVallo: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("asks for the one thing the chosen route actually needs", () => {
    const base = {
      role: "firm" as const,
      fullName: "Tunde Adebayo",
      businessName: "Acme Properties Ltd",
      rcNumber: "RC 1234567",
      officeAddress: "1 Admiralty Way, Lekki",
      team: [],
      acceptTerms: true,
      acceptPayOnVallo: true,
    };
    expect(
      firmRegistrationRefined.safeParse({ ...base, associationProof: "principal" }).success,
    ).toBe(false);
    expect(firmRegistrationRefined.safeParse({ ...base, associationProof: "letter" }).success).toBe(
      false,
    );
    expect(
      firmRegistrationRefined.safeParse({
        ...base,
        associationProof: "letter",
        letterPath: "uid/batch/letter.pdf",
      }).success,
    ).toBe(true);
  });

  it("has exactly two routes onto the firm, because a third would be a third form", () => {
    expect([...ASSOCIATION_PROOFS]).toEqual(["letter", "principal"]);
  });
});

describe("the walk back", () => {
  it("sends somebody to the earliest screen carrying a refusal, not the last", () => {
    expect(earliestStep({ ownershipDocument: "x", phone: "y" })).toBe(0);
    expect(earliestStep({ ownershipDocument: "x" })).toBe(2);
    expect(earliestStep({ "team.0.name": "x" })).toBe(2);
    expect(earliestStep(undefined)).toBeNull();
    expect(earliestStep({ somethingUnmapped: "x" })).toBeNull();
  });
});

/**
 * THE COPY LAW FOR THIS TRACK, AND IT IS A GATE RATHER THAN A HABIT.
 *
 * The LASRERA penalties, the two titling percentages and the ESVARBON section
 * number are held in `docs/archive/BUILD_07_LEDGER.md` section 5 for a lawyer,
 * because
 * every one of them reaches this repository through a search index's summary
 * rather than through a primary source. Not one of them may be printed until
 * that closes. `roles.ts` already holds the door copy to this rule; this holds
 * the forms to it.
 */
describe("what the forms may not say", () => {
  function everyString(value: unknown, into: string[] = []): string[] {
    if (typeof value === "string") into.push(value);
    else if (Array.isArray(value)) value.forEach((v) => everyString(v, into));
    else if (value && typeof value === "object") {
      Object.values(value).forEach((v) => everyString(v, into));
    }
    return into;
  }

  it("prints no percentage, no naira figure and no penalty, in any locale", () => {
    for (const locale of LOCALES) {
      const text = everyString(getDictionary(locale).supply.register).join(" \n ");
      expect(text, `${locale} prints a figure a lawyer has not confirmed`).not.toMatch(
        /%|per cent|percent|₦|NGN\s?\d|250,000|1,000,000/,
      );
    }
  });

  it("names no regulator except LASRERA, and names that one only as a field", () => {
    for (const locale of LOCALES) {
      const dictionary = getDictionary(locale).supply.register;
      const text = everyString(dictionary).join(" \n ");
      expect(text).not.toMatch(/ESVARBON|NIESV|REDAN|Land Use Act|Tenancy Law/i);

      /* ONCE, and only as the name of the field. The hint beside it says what
         the field is for without naming the regulator again, and a second
         mention anywhere would be prose about a body whose register nobody
         here has read. */
      const mentions = text.match(/LASRERA/g) ?? [];
      expect(mentions.length, `${locale} mentions LASRERA ${mentions.length} times`).toBe(1);
      expect(dictionary.firm.details.lasrera).toMatch(/LASRERA/);
    }
  });

  it("states no legal requirement beside the LASRERA field", () => {
    const hint = getDictionary("en").supply.register.firm.details.lasreraHint;
    expect(hint).not.toMatch(/required|mandatory|must|law|fine|penalty|offence/i);
  });

  it("promises no verification the platform has not performed", () => {
    const done = getDictionary("en").supply.register.owner.done;
    const all = [done.title, done.sub, done.nextOne, done.nextTwo, done.nextThree].join(" ");
    /* The render reads "Your details are verified" on a screen reached the
       instant a form is submitted. Nothing has been verified at that moment
       and this is the assertion that keeps it out. */
    expect(all).not.toMatch(/verified|approved already|you are set up/i);
  });

  it("uses none of the words this platform has banned from its interface", () => {
    for (const locale of LOCALES) {
      const text = everyString(getDictionary(locale).supply.register).join(" \n ");
      expect(text).not.toMatch(/\bdemo\b|\bsample\b|coming soon|not live|lorem/i);
    }
  });

  it("has no em dash anywhere in it, in any locale", () => {
    for (const locale of LOCALES) {
      const text = everyString(getDictionary(locale).supply.register).join(" \n ");
      expect(text).not.toContain("—");
    }
  });
});

describe("the NIN is compulsory (30 October 2026)", () => {
  const owner = {
    role: "owner" as const,
    fullName: "Ada Obi",
    phone: "08031234567",
    stateCode: "LA",
    lgaCode: "LA-ETI",
    ownershipDocument: "none" as const,
    acceptTerms: true as const,
    acceptPayOnVallo: true as const,
  };
  it("refuses an owner with no NIN or a short one, in words that do not echo the number", () => {
    for (const nin of ["", "123"]) {
      const result = ownerRegistrationSchema.safeParse({ ...owner, nin });
      expect(result.success).toBe(false);
      if (!result.success) expect(JSON.stringify(result.error.issues)).not.toContain("123\"");
    }
    expect(ownerRegistrationSchema.safeParse({ ...owner, nin: "12345678901" }).success).toBe(true);
  });
});
