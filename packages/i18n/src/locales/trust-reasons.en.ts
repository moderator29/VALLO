/**
 * REASONS TO TRUST (13 November 2026): the words for the checks a space and a
 * person carry, the sheet each check opens, and the explainer that says how a
 * check is earned.
 *
 * THE RULE THESE WORDS LIVE UNDER. A check is printed only with the date it
 * happened (`apps/web/src/lib/trust/checks.ts`), so every `title` below is
 * written to stand beside a date, and none of them is a tick. The sheet says
 * four things about a check: when, who did it, what was looked at, and what
 * it does not prove. The last one is the point: a mark that never says what
 * it leaves out is a promise, and this page only prints facts.
 *
 * The sentences that explain a proof strip line (identity, ownership,
 * mandate, the registers, availability, photographs, renters) are NOT
 * repeated here: they stay in `trust-visible.en.ts` (`proof.explain`), which
 * is where the claims rule already backs them, and the model reads them from
 * there. This module adds only what that one has no words for.
 *
 * A promising word is used here only where `apps/web/src/lib/trust/claims.ts`
 * names the mechanism behind it.
 */
export const trustReasonsEn = {
  /* "Why trust this space?" */
  space: {
    lede: "Vallo shows a check only after it has happened, with the day it happened. Tap one to see what was looked at and what it does not prove.",
    spaceGroup: "Checks on this space",
    listerGroup: "Checks on the lister",
    /** `{count}` is how many dated checks the page draws. */
    onRecordOne: "1 on record",
    onRecord: "{count} on record",
    emptyTitle: "No check is on record for this space yet",
    emptyBody:
      "Each check appears here on the day it happens, with its date. Until then, ask the lister what you need to know and see the place yourself before you pay anything.",
    emptyAction: "Ask the lister a question",
    earnTitle: "How a space earns each check",
    earnLede: "These are the checks Vallo can record. None can be bought, and none is shown without its date.",
    /** The closed disclosure under a list of dated checks. */
    earnMore: "Every check Vallo can record",
    earnMoreHint: "What each one is, and how a space earns it",
    /* The listing page's summary, which ends on the door to the full page. */
    summaryNone: "No check is on record for this space yet. Each one appears here on the day it happens, with its date.",
    summaryDoor: "See every check, with its date",
    summaryDoorNone: "See how a space earns each check",
  },
  /* A person's page. `{name}` is their first name. */
  person: {
    title: "Reasons to trust {name}",
    titlePlain: "Reasons to trust this member",
    lede: "Each line is something Vallo recorded, with its date. Tap one to see what it means.",
    stats: {
      reviews: "Reviews",
      rating: "Rating out of 5",
      /** Printed as a month and a year. */
      since: "On Vallo since",
      lets: "Let through Vallo",
      replies: "Usually replies within",
    },
    /** A reply band as one or two words, the figure of its stat cell. */
    replyBand: {
      hour: "1 hour",
      twoHours: "2 hours",
      fewHours: "A few hours",
      day: "1 day",
      threeDays: "3 days",
    },
  },
  /* A member's own view: the checks they can still add, and the promise. */
  own: {
    title: "Your trust checks",
    lede: "What other members see on your profile, each with its date. Tap one to see what it tells them.",
    addTitle: "Checks you can still add",
    addLede: "Only you see these. Each one appears on your profile with its date once it is done.",
    add: "Add",
    identity: { title: "Have your identity document seen", how: "Send a government identity document. A member of Vallo staff compares it with your account." },
    phone: { title: "Confirm your mobile number", how: "We send a six-digit code to it. The number is never shown on your profile." },
    promise: { title: "Accept the Community Promise", how: "Read the promise and accept it. The date shows on your profile." },
    promiseSheetTitle: "The Community Promise",
    promiseSheetLede: "What Vallo asks of every member, in short.",
    promisePoints: [
      "Be honest in your listings and in your messages.",
      "View with care: in daylight, with someone, and keep the conversation on Vallo.",
      "Treat the people you deal with the way you expect to be treated.",
      "Report what does not belong here.",
    ],
    promiseRead: "Read the full promise",
    promiseAccept: "I accept the Community Promise",
    /** `{date}` is the day it was accepted. */
    promiseAccepted: "You accepted the Community Promise on {date}.",
    promiseDone: "Thanks. Your acceptance is on your profile, with today's date.",
    promiseFailed: "Your acceptance could not be recorded. Nothing was changed. Try again in a moment.",
    promiseSignedOut: "Sign in again to accept the Community Promise.",
    promiseNote: "Accepting adds one dated line to your profile. It is your commitment to the people you deal with here, not a check Vallo carries out.",
  },
  /* The sheet a check opens. */
  sheet: {
    when: "When",
    who: "Who",
    what: "What was checked",
    means: "What it is",
    earn: "How it is earned",
    notProof: "What it does not prove",
    close: "Close",
    /** The row's hint for a screen reader. */
    open: "What this check is",
  },
  /* Who did it, one phrase each. */
  who: {
    staff: "A member of Vallo staff",
    staffRegister: "A member of Vallo staff, against the public register",
    staffVisit: "Somebody from Vallo, at the property",
    owner: "The owner of the property",
    renters: "Renters whose viewing the lister confirmed through Vallo",
    nimc: "NIMC, through Vallo's identity provider",
    code: "The member, with a one-time code Vallo sent",
    camera: "The lister, through Vallo's camera at the property",
    member: "The member, from their own account",
  },
  /*
   * One entry per check. `title` is the row; `earn` is the explainer's line.
   * `what` and `not` are here only for the checks `trust-visible.en.ts` has no
   * explanation for.
   */
  checks: {
    identity: {
      title: "Identity document seen by Vallo",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "The lister's identity document",
      earn: "The lister sends a government identity document and a member of Vallo staff compares it with their application.",
    },
    identityFirm: {
      title: "Identity document seen for the person who listed this",
      earn: "The person who lists for the firm sends a government identity document and a member of Vallo staff compares it with their application.",
    },
    identityNimc: {
      title: "Identity matched with NIMC",
      earn: "The lister gives a National Identification Number and NIMC confirms the name on it.",
    },
    ownership: {
      title: "Title document seen in the lister's name",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "A title document",
      earn: "The lister sends a title document in their own name for this address and a member of Vallo staff reads it.",
    },
    mandate: {
      title: "Owner's instruction seen, owner spoken to",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "The owner's instruction",
      earn: "The lister sends the owner's written instruction and a member of Vallo staff speaks to the owner named on it.",
    },
    lasrera: {
      title: "On the LASRERA register",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "The LASRERA register",
      /** `{name}` is the name on the register, `{number}` the registration number. */
      detail: "{name}, number {number}",
      earn: "A lister registered with LASRERA gives the number and a member of Vallo staff looks it up on the public register. Not required to list.",
    },
    esvarbon: {
      title: "On the ESVARBON register",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "The ESVARBON register",
      detail: "{name}, number {number}",
      earn: "A registered estate surveyor and valuer gives the number and a member of Vallo staff looks it up on the public register. Not required to list.",
    },
    cacDirector: {
      title: "A director of a company at the CAC",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "A company at the CAC",
      /** `{company}` is the company, `{number}` its registration number. */
      detail: "{company}, {number}",
      earn: "A lister who is a director of a registered company gives its number and a member of Vallo staff looks it up at the CAC. Not required to list.",
    },
    inspected: {
      title: "Inspected by Vallo",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "A visit by Vallo",
      what: "Somebody from Vallo stood in this property on this date.",
      not: "It is not a structural survey, and it does not say what the place would fetch or what its rent should be. It does not say the place is in the same condition today.",
      earn: "Somebody from Vallo visits and stands in the property.",
    },
    address: {
      title: "Address confirmed",
      /** The explainer's name for it: the thing looked at, never a finished fact. */
      name: "The address",
      what: "A member of Vallo staff confirmed that this address exists and matches the listing, from documents, a map pin or a utility bill.",
      not: "Nobody from Vallo went to the property for this one. It says nothing about who owns it or what state it is in.",
      earn: "A member of Vallo staff confirms the address exists and matches the listing.",
    },
    availability: {
      title: "Owner confirmed it is available",
    },
    photographs: {
      title: "Photographed at the property",
    },
    renters: {
      /** `{listed}` of `{count}` renters. */
      title: "{listed} of {count} renters said it was as listed",
      titleAll: "All {count} renters said it was as listed",
      earn: "Renters whose viewing the lister confirmed through Vallo answer four short questions afterwards. Nothing is shown until five have answered.",
      name: "What renters who viewed it said",
    },
    /* A person's own checks, on their page. */
    personIdentity: {
      title: "Identity document seen by Vallo",
      what: "A member of Vallo staff looked at a government identity document for this person, and it matched their account.",
      not: "It says who they are, not how they will treat you. It is not a check of any property or price.",
    },
    personIdentityNimc: {
      title: "Identity matched with NIMC",
      what: "This person's National Identification Number was confirmed with NIMC, and the name on it matched their Vallo account.",
      not: "It says who they are, not how they will treat you. Vallo never stores the number itself.",
    },
    phone: {
      title: "Mobile number confirmed",
      what: "This person entered a one-time code that Vallo sent to their mobile number.",
      not: "It does not say who they are. Vallo never shows the number on a profile.",
    },
    email: {
      title: "Email address confirmed",
      what: "This person confirmed the email address on their account with a code or a link that Vallo sent to it.",
      not: "It does not say who they are. Vallo never shows the address on a profile.",
    },
    /* A lister's register entry on their own page. The row's name is the
       register's (`lasrera`, `esvarbon`, `cacDirector` above); the line under
       it is the name the register shows, and never the number. */
    personRegister: {
      what: "A member of Vallo staff looked this registration up on the public register on this date. Entries older than a year are not shown.",
      not: "It is not required to list on Vallo. It says nothing about any property or price, or about how they will treat you.",
    },
    promise: {
      title: "Accepted the Community Promise",
      what: "This person read Vallo's Community Promise and accepted it: honest listings and messages, careful viewings, respect for the people they deal with, and reporting what does not belong here.",
      not: "It is a commitment they made, not a check Vallo carried out. It does not prove they have kept it.",
    },
    ownershipSeen: {
      title: "Proof of ownership seen",
      what: "A reviewer at Vallo read a document this person sent as proof that they own a property they list, and accepted it.",
      not: "We are not a land registry. It does not say the title is good, or that nobody else claims the property.",
    },
  },
};
