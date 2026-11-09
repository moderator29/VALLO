import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_SECTIONS,
  CONSENTS,
  MAX_FILE_BYTES,
  addressDateProblem,
  backRuleFor,
  idTypesFor,
  isSubtypeOf,
  lagosToday,
  missingFrom,
  missingItems,
  progressLabel,
  rejectFile,
  stepsFor,
  type KycSubmission,
} from "./kyc";

const ID = { name: "id.jpg", size: 1024, type: "image/jpeg", path: "u/kyc-b/identity-1.jpg", subtype: "passport", issuedOn: null };
const BILL = { name: "bill.pdf", size: 1024, type: "application/pdf", path: "u/kyc-b/address-1.pdf", subtype: "utility_bill", issuedOn: lagosToday() };

const SELFIE = { path: "u/kyc-b/selfie-1.jpg", size: 2048, type: "image/jpeg" };

function submission(over: Partial<KycSubmission> = {}): KycSubmission {
  return {
    documents: { identity: ID, address: BILL },
    selfie: SELFIE,
    business: false,
    businessDetails: {},
    consents: ["accuracy", "terms", "processing"],
    ...over,
  };
}

describe("stepsFor", () => {
  /* The branch is the only hard thing in this flow, so it is the thing tested. */
  it("is eight steps before the business question is answered: the ID's country, its type and photos, then the face, then the address", () => {
    expect(stepsFor(null).map((s) => s.id)).toEqual([
      "id-country",
      "id-type",
      "identity-document",
      "selfie",
      "address-document",
      "business-question",
      "consent",
      "review",
    ]);
  });

  it("stays eight when they say they do not run a business", () => {
    expect(stepsFor(false)).toHaveLength(8);
  });

  it("grows to nine, with business details in the middle, when they say yes", () => {
    const ids = stepsFor(true).map((s) => s.id);
    expect(ids).toHaveLength(9);
    expect(ids[6]).toBe("business-details");
  });

  it("never puts review anywhere but last", () => {
    for (const answer of [null, true, false] as const) {
      const steps = stepsFor(answer);
      expect(steps[steps.length - 1]?.id).toBe("review");
    }
  });

  it("is seven steps, with no business question, when the answers could not be filed", () => {
    for (const answer of [null, true, false] as const) {
      expect(stepsFor(answer, false).map((s) => s.id)).toEqual([
        "id-country",
        "id-type",
        "identity-document",
        "selfie",
        "address-document",
        "consent",
        "review",
      ]);
    }
  });
});

describe("the business answers", () => {
  /* A field the flow asks for and the action never files is lost data: the
     website was asked, shown on the review step and dropped. */
  it("are each filed onto the application by submitVerification", () => {
    const action = readFileSync(join(process.cwd(), "src/app/(app)/verification/actions.ts"), "utf8");
    for (const field of BUSINESS_SECTIONS.flatMap((section) => section.fields)) {
      expect(action, field.name).toContain(`value("${field.name}")`);
    }
  });
});

describe("progressLabel", () => {
  it("counts from one, not from zero", () => {
    expect(progressLabel(0, 6)).toBe("Step 1 of 6");
    expect(progressLabel(3, 6)).toBe("Step 4 of 6");
  });
});

describe("rejectFile", () => {
  it("accepts the four stated types", () => {
    for (const type of ["image/jpeg", "image/png", "image/heic", "application/pdf"]) {
      expect(rejectFile({ type, size: 1000 })).toBeNull();
    }
  });

  it("names the accepted types when it refuses one", () => {
    const message = rejectFile({ type: "image/gif", size: 1000 });
    expect(message).toContain("JPG, PNG, HEIC or PDF");
  });

  it("names the ceiling when the file is too big", () => {
    expect(rejectFile({ type: "image/jpeg", size: MAX_FILE_BYTES + 1 })).toContain("8MB");
  });

  it("accepts a file exactly on the limit", () => {
    expect(rejectFile({ type: "image/jpeg", size: MAX_FILE_BYTES })).toBeNull();
  });
});

describe("missingFrom", () => {
  it("is empty for a complete personal submission", () => {
    expect(missingFrom(submission())).toEqual([]);
  });

  it("names the document rather than saying something is missing", () => {
    const gaps = missingFrom(submission({ documents: { address: BILL } }));
    expect(gaps).toEqual(["Government issued ID"]);
  });

  it("asks for the selfie, by name, when there is none", () => {
    expect(missingFrom(submission({ selfie: null }))).toEqual(["A selfie"]);
  });

  it("files the selfie beside the ID in one insert, under the caller's own folder", () => {
    const action = readFileSync(join(process.cwd(), "src/app/(app)/verification/actions.ts"), "utf8");
    expect(action).toContain('kind: "selfie"');
    expect(action).toContain("selfie.path.startsWith(prefix)");
    expect(action).toContain("insert([...rows, selfieRow])");
  });

  it("never asks anyone to hold their ID up to the camera", () => {
    const step = readFileSync(join(process.cwd(), "src/components/verification/SelfieCapture.tsx"), "utf8");
    expect(step).toContain('facingMode: "user"');
    expect(step).toContain('capture="user"');
  });

  it("names every unticked consent separately", () => {
    expect(missingFrom(submission({ consents: ["terms"] }))).toEqual([
      CONSENTS[0]!.label,
      CONSENTS[2]!.label,
    ]);
  });

  it("asks for the required business fields only once the answer is yes", () => {
    expect(missingFrom(submission({ business: false }))).toEqual([]);
    const required = BUSINESS_SECTIONS.flatMap((s) =>
      s.fields.filter((f) => !f.optional).map((f) => f.label),
    );
    expect(missingFrom(submission({ business: true }))).toEqual(required);
  });

  it("never asks for an optional business field", () => {
    const filled: Record<string, string> = {};
    for (const section of BUSINESS_SECTIONS) {
      for (const field of section.fields) {
        if (!field.optional) filled[field.name] = "x";
      }
    }
    expect(missingFrom(submission({ business: true, businessDetails: filled }))).toEqual([]);
  });

  it("treats whitespace as empty", () => {
    const filled: Record<string, string> = {};
    for (const section of BUSINESS_SECTIONS) {
      for (const field of section.fields) filled[field.name] = "   ";
    }
    expect(missingFrom(submission({ business: true, businessDetails: filled })).length).toBeGreaterThan(0);
  });
});

describe("the two answers about each document", () => {
  it("asks which ID and which proof of address it is", () => {
    const gaps = missingFrom(
      submission({ documents: { identity: { ...ID, subtype: null }, address: { ...BILL, subtype: "passport" } } }),
    );
    expect(gaps).toEqual(["Which ID you uploaded", "Which proof of address you uploaded"]);
  });

  it("refuses a proof of address older than three months, or undated, or in the future", () => {
    expect(addressDateProblem("2026-09-01", "2026-09-28")).toBeNull();
    expect(addressDateProblem("2026-06-01", "2026-09-28")).toMatch(/three months/);
    expect(addressDateProblem("2026-10-02", "2026-09-28")).toMatch(/future/);
    expect(addressDateProblem(null, "2026-09-28")).toMatch(/date printed/);
    expect(addressDateProblem("28/09/2026", "2026-09-28")).toMatch(/date printed/);
  });

  it("names the stale date as a gap", () => {
    const gaps = missingFrom(submission({ documents: { identity: ID, address: { ...BILL, issuedOn: "2026-01-01" } } }), "2026-09-28");
    expect(gaps).toEqual(["The date on your proof of address, within the last three months"]);
  });
});

describe("Grade 1: the country and the sides of an ID", () => {
  it("offers Nigeria's four documents, and three everywhere else", () => {
    expect(idTypesFor("NG").map((t) => t.value)).toEqual(["nin_card", "passport", "drivers_licence", "voters_card"]);
    expect(idTypesFor("GH").map((t) => t.value)).toEqual(["passport", "national_id", "drivers_licence"]);
    expect(isSubtypeOf("identity", "national_id")).toBe(true);
  });

  it("asks for the back of a card, never of a passport, optionally of a NIN slip", () => {
    expect(backRuleFor("passport")).toBe("none");
    expect(backRuleFor("nin_card")).toBe("optional");
    for (const card of ["drivers_licence", "voters_card", "national_id"]) expect(backRuleFor(card)).toBe("required");
  });

  it("names the missing back and the missing country, and leaves older callers alone", () => {
    const base = { name: "id.jpg", size: 1, type: "image/jpeg", path: "u/kyc-1/identity-front-x.jpg", issuedOn: null };
    const gaps = (identity: Record<string, unknown>) =>
      missingItems({ documents: { identity: identity as never }, selfie: null, business: false, businessDetails: {}, consents: [] }).map((g) => g.kind);
    expect(gaps({ ...base, subtype: "drivers_licence", country: "NG", backPath: null })).toContain("back");
    expect(gaps({ ...base, subtype: "passport", country: "NG", backPath: null })).not.toContain("back");
    expect(gaps({ ...base, subtype: "passport", country: null })).toContain("country");
    expect(gaps({ ...base, subtype: "passport" })).not.toContain("country");
  });
});
