import { formatDate, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import { proofDate, provableDate, type ProofLine } from "./proof-strip";

/**
 * A CHECK, AS SOMETHING A PERSON CAN OPEN (13 November 2026).
 *
 * The founder's ask: bring real "reasons to trust" to a space and to a person,
 * where each check opens to explain itself: what was checked, how, when and by
 * whom. This file turns the facts the platform already holds into rows a
 * screen can draw and a sheet can explain. It is the model; the components
 * (`components/app/trust/TrustChecks.tsx`) only decide how a row looks.
 *
 * ---------------------------------------------------------------------------
 * THE LAW IS THE PROOF STRIP'S, UNCHANGED: NO ROW WITHOUT ITS DATE.
 *
 * Every row built here comes from a timestamp the database set when something
 * happened (`provableDate`). A null, an empty string or a date that does not
 * parse is not a row. It is never "not yet", never a grey mark and never a
 * crossed-out line against a space or a person, because an absent check must
 * not read as an accusation. The one place a check appears WITHOUT a date is
 * the explainer (`spaceExplainer`), which is about Vallo, not about the space
 * in front of the reader: it lists the checks that exist and how each is
 * earned, and its rows carry `at: null` so the component draws them as plain
 * explanations with no value beside them.
 *
 * ---------------------------------------------------------------------------
 * TWO SUBJECTS, NEVER MIXED.
 *
 * The old page printed one strip. A reader could not tell whether "identity
 * seen" was about the flat or about the person. The rows are now split by what
 * was looked at: the SPACE (the right to let it, a visit, the address, the
 * owner's word, the photographs, the renters who went) and the LISTER (who
 * they are, and any register they are on). The order inside each group is
 * fixed and is the proof strip's own order; nothing here sorts by recency or
 * by strength, because an order that moves is a score.
 *
 * ---------------------------------------------------------------------------
 * NOTHING PRIVATE CAN PASS THROUGH. A row is a title, a date and four
 * sentences. `PersonCheckFacts` holds dates and a method only: there is no
 * field that could carry a phone number, an email address or a document
 * number, so no caller can hand one to a screen by mistake. A register entry
 * prints the name and number the PUBLIC register shows, which is the point of
 * that check and is already printed by the proof strip.
 *
 * Pure and client-safe: no reads, no clock.
 */

export type TrustCheckKind =
  | "identity"
  | "identityFirm"
  | "identityNimc"
  | "lasrera"
  | "esvarbon"
  | "cacDirector"
  | "ownership"
  | "mandate"
  | "inspected"
  | "address"
  | "availability"
  | "photographs"
  | "renters"
  | "personIdentity"
  | "personIdentityNimc"
  | "phone"
  | "email"
  | "promise"
  | "ownershipSeen";

/** One row, and everything its sheet says. Plain strings, so it crosses to a client component as it is. */
export type TrustCheck = {
  /** Unique within a list (two register entries of one kind keep apart). */
  id: string;
  kind: TrustCheckKind;
  title: string;
  /** A second line under the title: the name and number a register shows. */
  detail: string | null;
  /** The ISO timestamp, or null on an explainer row. */
  at: string | null;
  /** The date as the reader's locale prints it, or null on an explainer row. */
  date: string | null;
  who: string;
  what: string;
  notProof: string;
  /** How it is earned. Only on an explainer row. */
  earn: string | null;
};

type Copy = Dictionary["trustReasons"];
type ProofCopy = Dictionary["trustVisible"]["proof"];

/* ------------------------------------------------------------- the space */

function identityKind(line: Extract<ProofLine, { kind: "identity" }>): "identity" | "identityFirm" | "identityNimc" {
  return line.method === "nimc" ? "identityNimc" : line.forFirm ? "identityFirm" : "identity";
}

function fromProofLine(line: ProofLine, copy: Copy, proof: ProofCopy, locale: Locale): TrustCheck {
  const date = proofDate(line.at, locale);
  switch (line.kind) {
    case "identity": {
      const kind = identityKind(line);
      const explain = proof.explain[kind];
      return {
        id: kind,
        kind,
        title: copy.checks[kind].title,
        detail: null,
        at: line.at,
        date,
        who: kind === "identityNimc" ? copy.who.nimc : copy.who.staff,
        what: explain.is,
        notProof: explain.isNot,
        earn: null,
      };
    }
    case "credentials": {
      const kind = line.credential === "cac_director" ? "cacDirector" : line.credential;
      const words = copy.checks[kind];
      const detail = words.detail
        .replace("{name}", line.registerName ?? "")
        .replace("{company}", line.company ?? "")
        .replace("{number}", line.number);
      return {
        id: `${kind}-${line.number}`,
        kind,
        title: words.title,
        detail,
        at: line.at,
        date,
        who: copy.who.staffRegister,
        what: proof.explain.credential.is,
        notProof: proof.explain.credential.isNot,
        earn: null,
      };
    }
    case "authority": {
      const explain = proof.explain[line.basis];
      return {
        id: line.basis,
        kind: line.basis,
        title: copy.checks[line.basis].title,
        detail: null,
        at: line.at,
        date,
        who: copy.who.staff,
        what: explain.is,
        notProof: explain.isNot,
        earn: null,
      };
    }
    case "availability":
      return {
        id: "availability",
        kind: "availability",
        title: copy.checks.availability.title,
        detail: null,
        at: line.at,
        date,
        who: copy.who.owner,
        what: proof.explain.availability.is,
        notProof: proof.explain.availability.isNot,
        earn: null,
      };
    case "photographs":
      return {
        id: "photographs",
        kind: "photographs",
        title: copy.checks.photographs.title,
        detail: null,
        at: line.at,
        date,
        who: copy.who.camera,
        what: proof.explain.photographs.is,
        notProof: proof.explain.photographs.isNot,
        earn: null,
      };
    case "renters": {
      const count = formatNumber(line.attended, locale);
      const listed = formatNumber(line.asListed, locale);
      const title = (line.asListed === line.attended ? copy.checks.renters.titleAll : copy.checks.renters.title)
        .replace("{count}", count)
        .replace("{listed}", listed);
      return {
        id: "renters",
        kind: "renters",
        title,
        detail: null,
        at: line.at,
        /* The public count is dated to the month (the view truncates it), so
           it prints as a month and never as a day it cannot prove. */
        date: formatDate(new Date(line.at), locale, { month: "long", year: "numeric", timeZone: "UTC" }),
        who: copy.who.renters,
        what: proof.explain.renters.is,
        notProof: proof.explain.renters.isNot,
        earn: null,
      };
    }
  }
}

/** The kinds that are about the person who listed it, not about the space. */
function aboutTheLister(line: ProofLine): boolean {
  return line.kind === "identity" || line.kind === "credentials";
}

export type SpaceChecks = {
  /** What was looked at about the space itself. */
  space: TrustCheck[];
  /** What was looked at about the person who listed it. */
  lister: TrustCheck[];
};

/**
 * The dated checks of one listing, in two groups. `lines` is the proof strip's
 * own output (so an example row, which has none, has none here), and the two
 * staff dates are the ones `earnedTrust` already cleared on an example.
 */
export function spaceChecks(
  facts: { inspectedAt: string | null; addressCheckedAt: string | null; lines: readonly ProofLine[] },
  copy: Copy,
  proof: ProofCopy,
  locale: Locale,
): SpaceChecks {
  const space: TrustCheck[] = [];
  const lister: TrustCheck[] = [];
  for (const line of facts.lines) {
    if (provableDate(line.at) === null) continue;
    if (aboutTheLister(line)) lister.push(fromProofLine(line, copy, proof, locale));
  }
  /* The right to let it comes first among the space's own rows, then the two
     things staff did, then the owner, the pictures and the witnesses: the
     proof strip's order, with the two staff dates beside the authority they
     belong with. */
  const authority = facts.lines.find((line) => line.kind === "authority" && provableDate(line.at) !== null);
  if (authority) space.push(fromProofLine(authority, copy, proof, locale));
  const inspected = provableDate(facts.inspectedAt);
  if (inspected) {
    space.push({
      id: "inspected",
      kind: "inspected",
      title: copy.checks.inspected.title,
      detail: null,
      at: inspected,
      date: proofDate(inspected, locale),
      who: copy.who.staffVisit,
      what: copy.checks.inspected.what,
      notProof: copy.checks.inspected.not,
      earn: null,
    });
  }
  const address = provableDate(facts.addressCheckedAt);
  if (address) {
    space.push({
      id: "address",
      kind: "address",
      title: copy.checks.address.title,
      detail: null,
      at: address,
      date: proofDate(address, locale),
      who: copy.who.staff,
      what: copy.checks.address.what,
      notProof: copy.checks.address.not,
      earn: null,
    });
  }
  for (const line of facts.lines) {
    if (provableDate(line.at) === null) continue;
    if (line.kind === "availability" || line.kind === "photographs" || line.kind === "renters") {
      space.push(fromProofLine(line, copy, proof, locale));
    }
  }
  return { space, lister };
}

/**
 * THE EXPLAINER: the checks Vallo can record on a space and its lister, and
 * how each is earned. About the platform, never about one listing, so every
 * row has `at: null`.
 *
 * ONLY CHECKS THAT CAN BE EARNED TODAY ARE LISTED. "Owner confirmed
 * available" (V-31) and "Photographed at the property" (V-45) have no source
 * yet (`proof-strip.ts`), and a "how to earn it" line for a check nobody can
 * earn would be a promise. They join this list when their column exists.
 */
export function spaceExplainer(copy: Copy, proof: ProofCopy): TrustCheck[] {
  const row = (
    kind: TrustCheckKind,
    title: string,
    who: string,
    what: string,
    notProof: string,
    earn: string,
  ): TrustCheck => ({ id: `explain-${kind}`, kind, title, detail: null, at: null, date: null, who, what, notProof, earn });
  const c = copy.checks;
  const e = proof.explain;
  /* Each row is named for the thing looked at ("A title document"), never
     for the finished fact ("Title document seen"): on a page about a space
     that has none, a finished-sounding line would read as a claim. */
  return [
    row("ownership", c.ownership.name, copy.who.staff, e.ownership.is, e.ownership.isNot, c.ownership.earn),
    row("mandate", c.mandate.name, copy.who.staff, e.mandate.is, e.mandate.isNot, c.mandate.earn),
    row("inspected", c.inspected.name, copy.who.staffVisit, c.inspected.what, c.inspected.not, c.inspected.earn),
    row("address", c.address.name, copy.who.staff, c.address.what, c.address.not, c.address.earn),
    row("renters", c.renters.name, copy.who.renters, e.renters.is, e.renters.isNot, c.renters.earn),
    row("identity", c.identity.name, copy.who.staff, e.identity.is, e.identity.isNot, c.identity.earn),
    row("lasrera", c.lasrera.name, copy.who.staffRegister, e.credential.is, e.credential.isNot, c.lasrera.earn),
    row("esvarbon", c.esvarbon.name, copy.who.staffRegister, e.credential.is, e.credential.isNot, c.esvarbon.earn),
    row("cacDirector", c.cacDirector.name, copy.who.staffRegister, e.credential.is, e.credential.isNot, c.cacDirector.earn),
  ];
}

/* ------------------------------------------------------------ the person */

/**
 * What a person's page may be built from. Dates and one method, nothing else:
 * there is no field here a number, an address or a document could ride in on.
 */
export type PersonCheckFacts = {
  /** When their identity check passed, and how. */
  identitySeenAt?: string | null;
  identityMethod?: "seen" | "nimc" | null;
  /** When they entered the one-time code sent to their mobile. */
  phoneConfirmedAt?: string | null;
  /** When they confirmed the email address on the account. */
  emailConfirmedAt?: string | null;
  /** When they accepted the Community Promise (`promise-actions.ts`). A commitment, not a check Vallo made. */
  promiseAcceptedAt?: string | null;
  /** When a reviewer accepted their proof of ownership (`ownership-seen.ts`). */
  ownershipSeenAt?: string | null;
};

/**
 * A person's dated checks, in a fixed order: who they are, then how they can
 * be reached, then what they committed to, then what they own. An absent date
 * is an absent row.
 */
export function personChecks(facts: PersonCheckFacts, copy: Copy, locale: Locale): TrustCheck[] {
  const out: TrustCheck[] = [];
  const push = (
    kind: "personIdentity" | "personIdentityNimc" | "phone" | "email" | "promise" | "ownershipSeen",
    value: string | null | undefined,
    who: string,
  ) => {
    const at = provableDate(value);
    if (!at) return;
    const words = copy.checks[kind];
    out.push({
      id: kind,
      kind,
      title: words.title,
      detail: null,
      at,
      date: proofDate(at, locale),
      who,
      what: words.what,
      notProof: words.not,
      earn: null,
    });
  };
  if (facts.identityMethod === "nimc") push("personIdentityNimc", facts.identitySeenAt, copy.who.nimc);
  else push("personIdentity", facts.identitySeenAt, copy.who.staff);
  push("phone", facts.phoneConfirmedAt, copy.who.code);
  push("email", facts.emailConfirmedAt, copy.who.code);
  push("promise", facts.promiseAcceptedAt, copy.who.member);
  push("ownershipSeen", facts.ownershipSeenAt, copy.who.staff);
  return out;
}

/* ------------------------------------------------------------- the stats */

export type TrustStat = { key: "reviews" | "rating" | "since" | "lets" | "replies"; label: string; value: string };

/**
 * The numbers above a person's checks. REAL NUMBERS ONLY: a cell is built
 * when its fact is there and is left out when it is not. No zero, no dash, no
 * "new": a count of nothing is not a fact about a person, and a rating prints
 * only with the reviews behind it.
 */
export function personStats(
  facts: {
    reviewCount?: number | null;
    averageRating?: number | null;
    /** ISO. The day the account, or the handle, was made. */
    memberSince?: string | null;
    /** Lets through Vallo in the last 12 months, already gated by the database. */
    lets?: number | null;
    replyBand?: keyof Copy["person"]["replyBand"] | null;
  },
  copy: Copy,
  locale: Locale,
): TrustStat[] {
  const out: TrustStat[] = [];
  const words = copy.person.stats;
  const reviews = facts.reviewCount ?? 0;
  const rating = facts.averageRating ?? null;
  if (Number.isInteger(reviews) && reviews > 0) {
    out.push({ key: "reviews", label: words.reviews, value: formatNumber(reviews, locale) });
    if (rating !== null && Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      const figure = formatNumber(Math.round(rating * 10) / 10, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      out.push({ key: "rating", label: words.rating, value: figure });
    }
  }
  const lets = facts.lets ?? 0;
  if (Number.isInteger(lets) && lets > 0) out.push({ key: "lets", label: words.lets, value: formatNumber(lets, locale) });
  if (facts.replyBand) out.push({ key: "replies", label: words.replies, value: copy.person.replyBand[facts.replyBand] });
  const since = provableDate(facts.memberSince);
  if (since) {
    out.push({
      key: "since",
      label: words.since,
      value: formatDate(new Date(since), locale, { month: "short", year: "numeric", timeZone: "Africa/Lagos" }),
    });
  }
  return out;
}

/** The section's heading on a person's page: their first name when there is one to use. */
export function reasonsTitle(displayName: string | null | undefined, copy: Copy): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  /* A handle, an email-shaped label or a single character is not a first name. */
  if (first.length < 2 || /[@_\d]/.test(first)) return copy.person.titlePlain;
  return copy.person.title.replace("{name}", first);
}
