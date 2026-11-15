import { businessNamesMatch, namesMatch } from "../name-match";
import { plainDay, type MrzFields } from "./mrz";
import { finding, type Finding } from "./signals";

/**
 * DO THE FACTS ON ONE PERSON AGREE WITH EACH OTHER? (15 November 2026.)
 *
 * Four questions, each answered from what the desk already holds and nothing
 * else:
 *   - does the date of birth make an adult (18 or more)?
 *   - has the ID expired, when it carries an expiry at all?
 *   - do the name on the ID, the name on the account and the name the bank
 *     holds for the payout account agree? (`name-match.ts` decides, so a
 *     different order, a missing middle name and a title never count.)
 *   - does what the passport's bottom lines carry agree with the names on
 *     record, and with any dates the desk holds?
 *
 * A forger usually changes one thing: the photo, or the name, or a date. The
 * rest of the record then stops agreeing with it, and that disagreement is
 * what these rules surface. Agreement is never proof.
 *
 * PURE: no I/O, no logging, and the words name the rule, never the person.
 */

export const ADULT_AGE = 18;

/** Whole years between a date of birth and a day, or null when either is not a date. */
export function ageOn(dateOfBirthIso: string, now: Date): number | null {
  const born = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirthIso);
  if (!born || Number.isNaN(now.getTime())) return null;
  const today = now.toISOString().slice(0, 10);
  const [year, month, day] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)), Number(today.slice(8, 10))];
  let age = year - Number(born[1]);
  if (month < Number(born[2]) || (month === Number(born[2]) && day < Number(born[3]))) age -= 1;
  return age;
}

/** Is the person an adult by this date of birth? */
export function ageFinding(dateOfBirthIso: string | null, now: Date): Finding | null {
  if (!dateOfBirthIso) return null;
  const age = ageOn(dateOfBirthIso, now);
  if (age === null) return null;
  if (age < 0 || age > 120) {
    return finding(
      "age",
      "look",
      "The date of birth cannot be right",
      `It gives an age of ${age}. Read the date on the document again; a date that makes no sense is a reason to look closer.`,
    );
  }
  if (age < ADULT_AGE) {
    return finding(
      "age",
      "stop",
      `The date of birth gives an age of ${age}`,
      `Only an adult (${ADULT_AGE} or older) can list property or be paid on Vallo. Do not approve; if the photo shows an older person than the date allows, escalate.`,
    );
  }
  return finding("age", "ok", `The date of birth gives an age of ${age}`, "An adult. Make sure the face in the photo is believable for that age.");
}

/** Has the document expired? Null when no expiry is known (a NIN slip has none). */
export function expiryFinding(expiryIso: string | null, now: Date): Finding | null {
  if (!expiryIso || !/^\d{4}-\d{2}-\d{2}$/.test(expiryIso)) return null;
  const today = now.toISOString().slice(0, 10);
  if (expiryIso < today) {
    return finding(
      "expiry",
      "look",
      `The ID expired on ${plainDay(expiryIso)}`,
      "An expired ID is not accepted. Send it back and ask for one that is still in date.",
    );
  }
  return finding("expiry", "ok", `The ID is in date until ${plainDay(expiryIso)}`, "Compare this with the expiry date printed on the document.");
}

export type NamesOnRecord = {
  /** The name printed on the ID, as a reviewer typed it. */
  onId: string | null;
  /** The legal name given at sign-up. */
  account: string | null;
  /** The name on their application, when they filed one. */
  application: string | null;
  /** The holder name the bank returned for the payout account. */
  bank: string | null;
  /** The registered business name, when they verify as a business. */
  business: string | null;
};

function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The names side by side. One finding per pair that can be compared; a pair
 * with a side missing produces nothing, because nothing was compared.
 */
export function nameFindings(names: NamesOnRecord): Finding[] {
  const onId = present(names.onId);
  const account = present(names.account);
  const application = present(names.application);
  const bank = present(names.bank);
  const business = present(names.business);
  const out: Finding[] = [];

  if (onId && account) {
    const result = namesMatch(onId, account);
    out.push(
      result.match
        ? finding("names.id_account", "ok", "The name on the ID matches the account name", "A different order, a missing middle name and titles are allowed for.")
        : finding(
            "names.id_account",
            "look",
            "The name on the ID differs from the account name",
            "A different person's ID is not accepted. A changed name needs a document that explains it (marriage, deed poll).",
          ),
    );
  }

  if (account && application && !namesMatch(account, application).match) {
    out.push(
      finding(
        "names.account_application",
        "look",
        "The account name differs from the name on their application",
        "The same person gave two different names. Ask which is the name on their ID before you decide.",
      ),
    );
  }

  const person = onId ?? application ?? account;
  if (bank && (person || business)) {
    const asPerson = person ? namesMatch(bank, person).match : false;
    const asBusiness = business ? businessNamesMatch(bank, business).match : false;
    const against = onId ? "the ID" : "the name on record";
    if (asPerson) {
      out.push(finding("names.bank", "ok", `The bank account name matches ${against}`, "The bank looked at this person's own identity when it opened the account, so a matching name is a strong sign."));
    } else if (asBusiness) {
      out.push(finding("names.bank", "ok", "The bank account is in the registered business name", "A business paid into its own business account is expected."));
    } else {
      out.push(
        finding(
          "names.bank",
          "look",
          `The bank account name differs from ${against}`,
          "Money would be paid to somebody else. A different person's account is not accepted: refuse the payout account with a reason.",
        ),
      );
    }
  }

  return out;
}

export type MrzComparison = {
  /** What the passport's bottom lines carry. */
  mrz: MrzFields;
  /** The names the desk holds for this person. */
  names: Pick<NamesOnRecord, "onId" | "account" | "application">;
  /** A date of birth the desk holds from elsewhere, as YYYY-MM-DD. */
  dateOfBirth?: string | null;
  /** An expiry the desk holds from elsewhere, as YYYY-MM-DD. */
  expiry?: string | null;
  /** The passport number as typed elsewhere, when there is one. */
  documentNumber?: string | null;
};

/**
 * What the passport's bottom lines carry, against what the desk holds, plus
 * the age and expiry the zone itself gives.
 */
export function mrzAgreementFindings(input: MrzComparison, now: Date): Finding[] {
  const { mrz } = input;
  const out: Finding[] = [];
  const zoneName = `${mrz.givenNames} ${mrz.surname}`.trim();
  const candidates: [label: string, value: string | null][] = [
    ["the name typed from the ID", present(input.names.onId)],
    ["the account name", present(input.names.account)],
    ["the name on their application", present(input.names.application)],
  ];

  let compared = 0;
  for (const [label, value] of candidates) {
    if (!value || zoneName === "") continue;
    compared += 1;
    /* The zone states which part is the surname, so it must be in both. */
    const result = namesMatch(zoneName, value, mrz.nameTruncated ? null : mrz.surname);
    const key = `mrz.name.${compared}`;
    out.push(
      result.match
        ? finding(key, "ok", `The name in the bottom lines matches ${label}`, "The zone and the record name the same person.")
        : finding(
            key,
            "look",
            `The name in the bottom lines differs from ${label}`,
            mrz.nameTruncated
              ? "A very long name is cut short in the zone, which can cause this. Compare the zone with the name printed on the page by eye."
              : "Compare the zone with the name printed on the page. If the printed name and the zone disagree, the page has been edited: do not approve, and escalate.",
          ),
    );
  }

  const zoneBirth = mrz.dateOfBirth.iso;
  const heldBirth = present(input.dateOfBirth);
  if (zoneBirth && heldBirth) {
    out.push(
      zoneBirth === heldBirth
        ? finding("mrz.birth", "ok", "The date of birth in the bottom lines matches the one on record", "Both give the same day.")
        : finding("mrz.birth", "stop", "The date of birth in the bottom lines differs from the one on record", "Two different dates of birth for one person. Do not approve, and escalate."),
    );
  }

  const zoneExpiry = mrz.expiry.iso;
  const heldExpiry = present(input.expiry);
  if (zoneExpiry && heldExpiry) {
    out.push(
      zoneExpiry === heldExpiry
        ? finding("mrz.expiry", "ok", "The expiry date in the bottom lines matches the one on record", "Both give the same day.")
        : finding("mrz.expiry", "look", "The expiry date in the bottom lines differs from the one on record", "Compare both with the date printed on the page."),
    );
  }

  const heldNumber = present(input.documentNumber)?.replace(/[\s-]+/g, "").toUpperCase() ?? null;
  if (heldNumber && mrz.documentNumber) {
    out.push(
      heldNumber === mrz.documentNumber
        ? finding("mrz.number", "ok", "The passport number in the bottom lines matches the number typed", "The zone and the top of the page carry the same number.")
        : finding("mrz.number", "stop", "The passport number in the bottom lines differs from the number typed", "On a genuine passport they are the same. Retype both; if they still differ, do not approve, and escalate."),
    );
  }

  const age = ageFinding(zoneBirth, now);
  if (age) out.push(age);
  const expiry = expiryFinding(zoneExpiry, now);
  if (expiry) out.push(expiry);
  return out;
}
