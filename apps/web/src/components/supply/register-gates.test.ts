import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY SCREEN WAITS ONLY FOR THE FIELDS IT DRAWS (22 November 2026).
 *
 * Agents could not get past "About you": screen one's Continue waited for an
 * 11-digit NIN whose box is on screen two, so it stayed greyed out with
 * nothing on the screen to fill. This reads each form's `blocked()` and
 * checks the screen-one rule names no field that screen does not draw.
 */
const read = (name: string) => readFileSync(join(__dirname, name), "utf8");

function screenOneRule(source: string): string {
  const match = source.match(/if \(step === 0\) return ([^;]*);/);
  if (!match?.[1]) throw new Error("no screen-one rule found");
  return match[1];
}

describe("registration screens wait only for their own fields", () => {
  it("the agent's first screen does not wait for the NIN, the second does", () => {
    const source = read("AgentRegisterForm.tsx");
    expect(screenOneRule(source)).not.toMatch(/\bnin\b/);
    expect(source).toMatch(/if \(step === 1\) return !\/\^\\d\{11\}\$\/\.test\(nin\.trim\(\)\);/);
  });

  it("the owner's NIN box is on the first screen, where its rule is", () => {
    const source = read("OwnerRegisterForm.tsx");
    expect(screenOneRule(source)).toMatch(/\bnin\b/);
    const ninBox = source.indexOf("setNin(e.target.value");
    const screenTwo = source.indexOf("heading: own.where.title");
    expect(ninBox).toBeGreaterThan(0);
    expect(ninBox).toBeLessThan(screenTwo);
  });
});

/**
 * EVERY GATE NAMES ONLY ITS OWN SCREEN'S FIELDS, FOR ALL THREE FORMS
 * (22 November 2026, the sweep after the NIN).
 *
 * For each form this reads `blocked()`, takes every `if (step === N)` rule,
 * finds the state each rule reads, and checks two things about it:
 *
 *   1. the field's input is drawn on screen N (its setter is called between
 *      screen N's heading and screen N + 1's), so Continue never waits for a
 *      box the person cannot see;
 *   2. `earliestStep` walks a server refusal of that field back to screen N,
 *      so a refusal lands where the box and its sentence are.
 */
import {
  ROLE_FIELD_STEP,
  FIELD_STEP,
  associationReady,
  earliestStep,
  type RegisterRole,
} from "@/lib/supply/registration-model";
import { normalisePhone } from "@/lib/phone";

type FormSpec = {
  role: RegisterRole;
  file: string;
  /** The heading line that opens each screen, in order. */
  screens: [string, string, string];
  /** state variable in the gate -> [its setter, the field the server names]. */
  fields: Record<string, [setter: string, field: string]>;
};

const FORMS: FormSpec[] = [
  {
    role: "agent",
    file: "AgentRegisterForm.tsx",
    screens: ["heading: mine.you.title", "heading: mine.identity.title", "heading: mine.fees.title"],
    fields: {
      fullName: ["setFullName(", "fullName"],
      phone: ["onChange={setPhone}", "phone"],
      experience: ["setExperience(", "experience"],
      nin: ["setNin(", "nin"],
      acceptTerms: ["onTerms={setAcceptTerms}", "acceptTerms"],
      acceptPay: ["onPay={setAcceptPay}", "acceptPayOnVallo"],
    },
  },
  {
    role: "owner",
    file: "OwnerRegisterForm.tsx",
    screens: ["heading: own.you.title", "heading: own.where.title", "heading: own.proof.title"],
    fields: {
      fullName: ["setFullName(", "fullName"],
      phone: ["onChange={setPhone}", "phone"],
      nin: ["setNin(", "nin"],
      stateCode: ["setStateCode(", "stateCode"],
      lgaCode: ["onChange={setLgaCode}", "lgaCode"],
      held: ["setHeld(", "ownershipDocument"],
      acceptTerms: ["onTerms={setAcceptTerms}", "acceptTerms"],
      acceptPay: ["onPay={setAcceptPay}", "acceptPayOnVallo"],
    },
  },
  {
    role: "firm",
    file: "FirmRegisterForm.tsx",
    screens: ["heading: mine.details.title", "heading: mine.association.title", "heading: mine.team.title"],
    fields: {
      fullName: ["setFullName(", "fullName"],
      businessName: ["setBusinessName(", "businessName"],
      rcNumber: ["setRcNumber(", "rcNumber"],
      officeAddress: ["setOfficeAddress(", "officeAddress"],
      proof: ["setProof(", "associationProof"],
      principalEmail: ["setPrincipalEmail(", "principalEmail"],
      letter: ["onChange={setLetter}", "letterPath"],
      acceptTerms: ["onTerms={setAcceptTerms}", "acceptTerms"],
      acceptPay: ["onPay={setAcceptPay}", "acceptPayOnVallo"],
    },
  },
];

/** The body of `blocked()`, up to its closing `return false;`. */
function gateBody(source: string): string {
  const start = source.indexOf("function blocked(): boolean {");
  const end = source.indexOf("return false;", start);
  if (start < 0 || end < 0) throw new Error("no blocked() found");
  return source.slice(start, end);
}

/** Each `if (step === N)` rule's text, by N (a rule may span lines). */
function rules(body: string): Map<number, string> {
  const out = new Map<number, string>();
  const re = /if \(step === (\d)\)\s*(?:\{\s*)?return([\s\S]*?);/g;
  for (const match of body.matchAll(re)) out.set(Number(match[1]), match[2] ?? "");
  return out;
}

/** Where the screen whose index is given is drawn (the JSX after the WorkspaceAcceptance counts as the last). */
function screenSlice(source: string, spec: FormSpec, index: number): string {
  const starts = spec.screens.map((heading) => source.indexOf(heading));
  for (const at of starts) expect(at).toBeGreaterThan(0);
  const from = starts[index]!;
  if (index < 2) return source.slice(from, starts[index + 1]);
  /* The last screen also carries the two ticks, drawn under the body. */
  return source.slice(from);
}

describe.each(FORMS)("the $role form's gates", (spec) => {
  const source = read(spec.file);
  const byStep = rules(gateBody(source));

  it("has a rule for each of its three screens", () => {
    expect([...byStep.keys()].sort()).toEqual([0, 1, 2]);
  });

  it.each([0, 1, 2])("screen %i waits only for fields drawn on it, and a refusal of each walks back to it", (step) => {
    const rule = byStep.get(step) ?? "";
    const used = Object.keys(spec.fields).filter((name) => new RegExp(`\\b${name}\\b`).test(rule));
    expect(used.length).toBeGreaterThan(0);
    const slice = screenSlice(source, spec, step);
    for (const name of used) {
      const [setter, field] = spec.fields[name]!;
      expect(slice, `${spec.file}: screen ${step} waits for ${name} but does not draw it`).toContain(setter);
      expect(earliestStep({ [field]: "refused" }, spec.role), `${field} walks back to the wrong screen`).toBe(step);
    }
  });
});

describe("the walk back knows every field the forms send", () => {
  it("every field a form's gate names has a screen in FIELD_STEP", () => {
    for (const spec of FORMS) {
      for (const [, field] of Object.values(spec.fields)) {
        const own = ROLE_FIELD_STEP[spec.role]?.[field];
        expect(own ?? FIELD_STEP[field], `${spec.role}.${field}`).toBeTypeOf("number");
      }
    }
  });

  it("the agent and firm forms pass their role to earliestStep, as the owner's does", () => {
    for (const spec of FORMS) {
      expect(read(spec.file)).toContain(`earliestStep(result.fieldErrors, "${spec.role}")`);
    }
  });
});

describe("the firm's second screen waits for the chosen route's own field", () => {
  it("a route alone is not enough", () => {
    expect(associationReady(null, "", "")).toBe(false);
    expect(associationReady("letter", "", "")).toBe(false);
    expect(associationReady("principal", "", "")).toBe(false);
    expect(associationReady("principal", "ade@firm", "")).toBe(false);
  });

  it("the form's screen-two rule is that helper, not a bare route check", () => {
    expect(rules(gateBody(read("FirmRegisterForm.tsx"))).get(1)).toContain("associationReady(proof, principalEmail, letter?.path");
  });

  it("the letter route waits for an uploaded letter, the principal route for an address", () => {
    expect(associationReady("letter", "", "uid/batch/association-1.pdf")).toBe(true);
    expect(associationReady("principal", " ade@firm.ng ", "")).toBe(true);
  });
});

describe("the phone gate is the server's own rule", () => {
  it("both forms hold Continue on normalisePhone, the function the schema refines with", () => {
    for (const file of ["AgentRegisterForm.tsx", "OwnerRegisterForm.tsx"]) {
      expect(rules(gateBody(read(file))).get(0)).toContain("normalisePhone(phone) === null");
    }
  });

  it("accepts what the phone field writes for a whole number and refuses a half one", () => {
    expect(normalisePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalisePhone("803 123 4567")).toBe("+2348031234567");
    expect(normalisePhone("0803 12")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});
