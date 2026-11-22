

import { isSupplyRole, type WorkspaceKind } from "./roles";

/**
 * THE THREE REGISTRATION FORMS, AS DATA.
 *
 * `GOVERNING-03`, `04` and `05` draw three forms of four screens each: the
 * owner, the agent and the firm. This module is everything about them that is
 * not a pixel: which screens each one has, which answers each question
 * accepts, what the fee arithmetic is, and what the server will refuse.
 *
 * CLIENT SAFE. It imports only `roles.ts` (the schemas and Zod stay in
 * `registration.ts`), and nothing that touches the network, so the three form
 * components, the server action and the specs all read the same values. A
 * second copy of any of this anywhere is a defect, which is the rule `roles.ts`
 * sets at its head and this file inherits.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FORM DIFFERS, IN ONE SENTENCE, BECAUSE IT GOVERNS EVERY CHOICE BELOW
 *
 * The form differs because the proof differs, and the proof differs because
 * what can go wrong differs. An owner can let a property that is not theirs;
 * an agent can advertise a flat nobody instructed them about and collect four
 * inspection fees for it; a firm can be a letterhead. So the owner is asked
 * what they hold on the property, the agent is asked who they are and what
 * they charge, and the firm is asked for its registration and for proof that
 * this person speaks for it.
 *
 * ---------------------------------------------------------------------------
 * THE FACT THAT SHAPES THE OWNER FORM
 *
 * Most Nigerian land sits outside the formal register and most landlords hold
 * no title document at all. A form that requires a Certificate of Occupancy
 * therefore excludes the large majority of the owners this platform is trying
 * to reach, which would destroy the supply side the whole direction exists to
 * build.
 *
 * SO `none` IS A FIRST CLASS ANSWER. It is in the same list as the others, it
 * is accepted by the same schema, it reaches the same submitted application,
 * and the person who gives it finishes the form and is an ordinary lister. It
 * simply never earns the words "ownership verified". It is not a dead end, not
 * a lesser path and not a nag, and nothing in this module treats it as one:
 * there is no `requiresDocument` flag and no second chance screen, because
 * either of those would be the nag by another name.
 *
 * NEITHER FIGURE IS WRITTEN HERE AND NEITHER IS PRINTED IN THE PRODUCT. Both
 * reach us through a search index's summary rather than a primary source, and
 * they are held in `docs/archive/BUILD_07_LEDGER.md` section 5 for a lawyer. What ships is
 * the behaviour, which needs no citation.
 *
 * ---------------------------------------------------------------------------
 * AND WHAT IS NOT HERE
 *
 * No statutory figure, no penalty, no fee schedule and no percentage. LASRERA
 * is a FIELD a firm may fill in and a thing a reader may one day filter on,
 * and the copy never states what the law requires of whom or what ignoring it
 * costs, because the register was unreachable and every claim about it is
 * unconfirmed. `registration.test.ts` fails if a percentage, a naira figure or
 * a statutory claim reaches any of it.
 */

/* ---------------------------------------------------------------- the role */

/** The three doors that have a form behind them, in the chooser's order. */
export const REGISTER_ROLES = ["owner", "agent", "firm"] as const;

export type RegisterRole = (typeof REGISTER_ROLES)[number];

export function isRegisterRole(value: string | null | undefined): value is RegisterRole {
  return value === "owner" || value === "agent" || value === "firm";
}

/**
 * The workspace kind a finished registration is asking for.
 *
 * Stated as a function rather than left to the reader because `firm` is a
 * workspace kind and NOT a person role: `isSupplyRole('firm')` is false and
 * always will be, for the reason `roles.ts` gives at its head. Anything that
 * needs the person axis has to narrow deliberately, and this is where the
 * narrowing is written down.
 */
export function workspaceKindFor(role: RegisterRole): WorkspaceKind {
  return role;
}

/** True when this registration also describes a kind of PERSON. */
export function isPersonRole(role: RegisterRole): boolean {
  return isSupplyRole(role);
}

/* -------------------------------------------------------------- the screens */

/**
 * Four screens each, which is what the three governing images draw.
 *
 * The ids are the screens' own names and they are what the progress row
 * counts. Four and not seven: the research file sketches a seven screen owner
 * form, the founder's own target draws four, and a founder target beats a
 * generated sketch. The rest of what the research names, the bank account, the
 * consents and the document uploads, is the verification ladder's own work and
 * it already has surfaces.
 */
export const REGISTER_STEPS: Record<RegisterRole, readonly string[]> = {
  owner: ["you", "where", "proof", "done"],
  agent: ["you", "identity", "fees", "done"],
  firm: ["firm", "association", "team", "done"],
};

/** Which screen index is the confirmation, for every role. */
export function lastStepIndex(role: RegisterRole): number {
  return REGISTER_STEPS[role].length - 1;
}

/* --------------------------------------------------- what an owner holds */

/**
 * The documents an owner may hold, and the answer for holding none.
 *
 * The first three are spelled exactly as `public.land_tenure` spells them, so
 * the day an ownership document is filed against a LISTING the two
 * vocabularies already agree. A survey plan and a utility bill are in the list
 * because `GOVERNING-03` draws them and because an owner who has one should be
 * able to say so; neither is a tenure and neither is added to that enum, since
 * a survey plan describes a parcel and a utility bill shows occupation.
 */
export const OWNERSHIP_DOCUMENTS = [
  "certificate_of_occupancy",
  "deed_of_assignment",
  "governors_consent",
  "survey_plan",
  "utility_bill",
  /* An owner's representative letting the place on their behalf holds no
     title, only the owner's written authority to let it. */
  "letter_of_authority",
] as const;

export type OwnershipDocument = (typeof OWNERSHIP_DOCUMENTS)[number];

/** The value that means "I have none of these", and it is an answer. */
export const NO_OWNERSHIP_DOCUMENT = "none" as const;

/**
 * Every answer screen three accepts, with the honest one LAST in the list and
 * FIRST in importance.
 *
 * It is last because `GOVERNING-03` draws it last, under a gap, which is the
 * right order for a reader scanning for their own document. It is not
 * separated because it is lesser; it is separated because it is not a
 * document, and putting it inside the document list would be the only
 * confusing place to put it.
 */
export const OWNERSHIP_ANSWERS = [...OWNERSHIP_DOCUMENTS, NO_OWNERSHIP_DOCUMENT] as const;

export type OwnershipAnswer = (typeof OWNERSHIP_ANSWERS)[number];

export function isOwnershipAnswer(value: string | null | undefined): value is OwnershipAnswer {
  return (OWNERSHIP_ANSWERS as readonly string[]).includes(value ?? "");
}

/**
 * Whether this answer can ever earn the ownership mark.
 *
 * The ONLY thing `none` changes, and it changes nothing else anywhere in this
 * module or in the schema below. Publishing, the application, the review and
 * every other rung are identical either way.
 */
export function canEarnOwnershipMark(answer: OwnershipAnswer): boolean {
  return answer !== NO_OWNERSHIP_DOCUMENT;
}

/* ----------------------------------------------------- how long an agent */

/**
 * The bands `GOVERNING-04` offers for "how long have you been working as an
 * agent".
 *
 * Bands rather than a year, because a band is what somebody can answer
 * truthfully without thinking, and a derived start date would be a precision
 * they never gave. `unstated` is in the list because an agent who would rather
 * not say should not be forced to choose a lie, and it is stored as itself.
 */
export const EXPERIENCE_BANDS = ["under_1", "1_2", "3_5", "6_10", "over_10", "unstated"] as const;

export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];

export function isExperienceBand(value: string | null | undefined): value is ExperienceBand {
  return (EXPERIENCE_BANDS as readonly string[]).includes(value ?? "");
}

/* ------------------------------------------------------- how a firm proves */

/** The two routes `GOVERNING-05` screen two offers. */
export const ASSOCIATION_PROOFS = ["letter", "principal"] as const;

export type AssociationProof = (typeof ASSOCIATION_PROOFS)[number];

export function isAssociationProof(value: string | null | undefined): value is AssociationProof {
  return value === "letter" || value === "principal";
}

/** How many colleagues one application may declare before it is a roster. */
export const MAX_DECLARED_TEAM = 20;

/**
 * The address shape the server accepts for a principal, in one place, so the
 * firm form's second screen and `firmRegistrationRefined` cannot disagree.
 */
export const PRINCIPAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WHAT THE FIRM'S SECOND SCREEN NEEDS BEFORE IT LETS THE PERSON ON, which is
 * exactly what the server refuses without (22 November 2026). The screen
 * used to wait only for a route to be chosen, so a firm that chose the letter
 * and uploaded nothing, or chose the principal and typed a half address,
 * walked through the team screen, ticked both boxes, pressed Submit, and only
 * then was sent back to screen two. Each route now waits for its own field.
 */
export function associationReady(
  proof: AssociationProof | null,
  principalEmail: string,
  letterPath: string,
): boolean {
  if (proof === "principal") return PRINCIPAL_EMAIL_RE.test(principalEmail.trim());
  if (proof === "letter") return letterPath.trim() !== "";
  return false;
}

/* ------------------------------------------------------------- the fees */

/**
 * A FEE IS A SHARE, AND A SHARE IS AN INTEGER NUMBER OF BASIS POINTS.
 *
 * Money on this platform is integer kobo and a fee is not money: it is a
 * proportion of somebody else's rent, and it is stored as basis points for the
 * same reason kobo are stored as integers. 10000 basis points is the whole
 * rent; 1000 is a tenth of it; 50 is half of one per cent, which is the
 * smallest step the control offers.
 *
 * NULL IS NOT ZERO AND THE DIFFERENCE IS THE POINT OF THE SCREEN. "I charge no
 * agency fee" is a strong claim and a selling point; "I have not said" is not
 * a claim at all. Nobody is credited with the first by failing to answer, so
 * the control starts UNDECLARED and a person reaches zero only by deliberately
 * stepping down to it.
 *
 * THE PLATFORM CAPS NOBODY'S FEE. The bound below is not a cap, it is the
 * statement that a proportion is a proportion: an agent asking for more than
 * the entire rent has mistyped, and catching it here is cheaper than printing
 * it to a tenant.
 */
export const FEE_STEP_BPS = 50;

export const FEE_MIN_BPS = 0;

export const FEE_MAX_BPS = 10_000;

/**
 * One press of the minus or the plus.
 *
 * `null` in, `FEE_STEP_BPS` out on a step up: a person who has said nothing and
 * presses plus is declaring the first real fee rather than confirming a zero
 * they never typed. Stepping down from zero returns to undeclared, because a
 * mis-tap should be undoable and "not declared" has to be reachable or it is
 * not a state, only a starting position.
 */
export function stepFee(current: number | null, direction: 1 | -1): number | null {
  if (current === null) return direction === 1 ? FEE_STEP_BPS : null;
  const next = current + direction * FEE_STEP_BPS;
  if (next < FEE_MIN_BPS) return null;
  if (next > FEE_MAX_BPS) return FEE_MAX_BPS;
  return next;
}

/** Basis points as the fraction `Intl.NumberFormat` wants for a percentage. */
export function bpsAsFraction(bps: number): number {
  return bps / 10_000;
}

/**
 * What a share of a rent comes to, in kobo.
 *
 * Integer in, integer out, rounded once. Nothing downstream divides.
 */
export function shareOfMinor(rentMinor: number, bps: number): number {
  return Math.round((rentMinor * bps) / 10_000);
}

/**
 * WHAT A TENANT ACTUALLY PAYS TO MOVE IN, GIVEN WHAT THIS AGENT HAS DECLARED.
 *
 * THE UNDECLARED PARTS ARE NAMED, NOT ASSUMED. A fee the agent has not
 * declared is returned as `null` and listed in `undeclared`, and the caller
 * draws the words rather than a zero, because a zero here reads as "this agent
 * charges nothing" and that is a claim nobody made.
 *
 * AND THE TOTAL IS HONEST ABOUT ITS OWN SCOPE. The caution deposit, the
 * service charge and the agreement fee are properties of a PROPERTY and they
 * are set on a listing, so they are not in this sum and `perListing` says so.
 * A total that quietly omitted them while calling itself "what a tenant pays"
 * would be the same lie this screen exists to end.
 */
export type TenantTotal = {
  rentMinor: number;
  agencyMinor: number | null;
  legalMinor: number | null;
  /** Rent plus every part this agent HAS declared, and nothing else. */
  totalMinor: number;
  /** Which of the two the agent has not answered yet. */
  undeclared: readonly ("agency" | "legal")[];
  /** Costs this screen cannot know, which belong to a listing. */
  perListing: readonly ["caution", "service", "agreement"];
};

export function tenantTotal({
  rentMinor,
  agencyFeeBps,
  legalFeeBps,
}: {
  rentMinor: number;
  agencyFeeBps: number | null;
  legalFeeBps: number | null;
}): TenantTotal {
  const agencyMinor = agencyFeeBps === null ? null : shareOfMinor(rentMinor, agencyFeeBps);
  const legalMinor = legalFeeBps === null ? null : shareOfMinor(rentMinor, legalFeeBps);
  const undeclared: ("agency" | "legal")[] = [];
  if (agencyFeeBps === null) undeclared.push("agency");
  if (legalFeeBps === null) undeclared.push("legal");
  return {
    rentMinor,
    agencyMinor,
    legalMinor,
    totalMinor: rentMinor + (agencyMinor ?? 0) + (legalMinor ?? 0),
    undeclared,
    perListing: ["caution", "service", "agreement"],
  };
}

/**
 * The rent the fee screen works its example on, in kobo.
 *
 * IT IS A STARTING POINT FOR AN EDITABLE FIELD AND NEVER A PRINTED FACT. The
 * governing image draws a worked example on a fixed rent; a fixed number on
 * that screen would be the platform telling a tenant what Lagos costs, which
 * is an invented figure with a caption. The field is the agent's to change and
 * the total follows whatever they put in it.
 */
export const EXAMPLE_RENT_MINOR = 250_000_000;

/* ------------------------------------------------------------ the schemas */

/**
 * Which screen a field belongs to, so a refusal can send somebody back to it.
 *
 * `missingFrom`-style honesty, in the spirit `kyc.ts` argues for: "complete all
 * required fields" is the least useful sentence in software, and a form that
 * knows a field failed and not WHERE it is has only half the answer.
 */
export const FIELD_STEP: Record<string, number> = {
  fullName: 0,
  phone: 0,
  experience: 0,
  businessName: 0,
  rcNumber: 0,
  officeAddress: 0,
  lasreraNumber: 0,
  stateCode: 1,
  lgaCode: 1,
  area: 1,
  nin: 1,
  idPath: 1,
  selfiePath: 1,
  associationProof: 1,
  principalEmail: 1,
  letterPath: 1,
  ownershipDocument: 2,
  ownershipPath: 2,
  agencyFeeBps: 2,
  legalFeeBps: 2,
  team: 2,
  /* Ruling 6: the two ticks sit on the last screen of every form. */
  acceptTerms: 2,
  acceptPayOnVallo: 2,
};

/** The earliest screen carrying any of these refusals, for the walk back. */
/**
 * Where a field sits on one form when it is not where `FIELD_STEP` puts it.
 * The owner asks for the NIN on screen one, beside the name; the agent asks
 * on screen two. Walking an owner's NIN refusal back to screen two left the
 * person on a screen without the field and without the message.
 */
export const ROLE_FIELD_STEP: Partial<Record<RegisterRole, Record<string, number>>> = {
  owner: { nin: 0 },
};

export function earliestStep(
  fieldErrors: Record<string, string> | undefined,
  role?: RegisterRole,
): number | null {
  if (!fieldErrors) return null;
  const own = role ? (ROLE_FIELD_STEP[role] ?? {}) : {};
  let earliest: number | null = null;
  for (const key of Object.keys(fieldErrors)) {
    const field = key.split(".")[0] ?? "";
    const step = own[field] ?? FIELD_STEP[field];
    if (step === undefined) continue;
    if (earliest === null || step < earliest) earliest = step;
  }
  return earliest;
}
