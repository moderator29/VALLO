/**
 * Host onboarding, as a model rather than as ten screens.
 *
 * The twin of components/verification/kyc.ts, for the same reason: the flow
 * branches. A restaurant answers a service-and-seating step that a hotel
 * never sees, a CAC-registered business answers a registration step an
 * individual never sees, so "step 4 of 9" is not a constant. Everything
 * about which steps exist, in what order, and what is still missing lives
 * here, pure, and the screens render it.
 *
 * WHAT THIS FILE KNOWS THAT kyc.ts DID NOT: where it is stored. The
 * businesses row is the application (docs/research/HOST_ONBOARDING_RESEARCH.md
 * section 3.2), created as DRAFT at step two and written onto under owner
 * RLS by lib/host/actions.ts. `HostDraft` is the read-back of that row and
 * its children, shaped for `missingFrom`, and `missingFrom` is the one
 * function that decides whether the review step may submit. It returns the
 * list rather than a boolean so the review screen can PRINT what is absent.
 *
 * Client-safe: imports nothing server-only, so the wizard and the server
 * action read the same rules.
 */

import type { Database } from "../supabase/database.types";
import { pathInOwnFolder } from "@/lib/security/own-folder";
import type { ArrivalCharges } from "../stays/arrival-charges";
import { HOST_AGREEMENT_VERSION, PAY_ON_VALLO_VERSION } from "../legal/versions";

export type BusinessKind = Database["public"]["Enums"]["business_kind"];

/* -------------------------------------------------------------- host types */

/** The three shapes a host can be. Decides everything after step one. */
export type HostType = "individual" | "business" | "restaurant";

export const HOST_TYPES: readonly HostType[] = ["individual", "business", "restaurant"] as const;

export type HostTypeDefinition = {
  id: HostType;
  title: string;
  /** Who this is for, in one sentence somebody can recognise themselves in. */
  meaning: string;
  /** The business kinds this branch may pick from at step one. */
  kinds: readonly BusinessKind[];
};

export const HOST_TYPE_DEFINITIONS: Record<HostType, HostTypeDefinition> = {
  individual: {
    id: "individual",
    title: "I let a place I own",
    meaning: "A shortlet, a guest house or a few serviced apartments, in your own name.",
    kinds: ["shortlet_operator", "guest_house", "serviced_apartments"],
  },
  business: {
    id: "business",
    title: "I run a registered hospitality business",
    meaning: "A hotel, resort or apartment operator registered with the CAC.",
    kinds: ["hotel", "serviced_apartments", "guest_house", "resort", "shortlet_operator"],
  },
  restaurant: {
    id: "restaurant",
    title: "I run a restaurant",
    meaning: "A venue that takes table reservations.",
    kinds: ["restaurant"],
  },
};

/** True when the branch has rooms and rates, false when it has tables and windows. */
export function hostsAccommodation(hostType: HostType): boolean {
  return hostType !== "restaurant";
}

/* -------------------------------------------------------------- documents */

/**
 * The bucket's own limits, stated once and rendered inline under every
 * uploader. Identical to storage.buckets 'host-documents' (M14).
 */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;
export const ACCEPTED_LABEL = "JPG, PNG, WEBP, HEIC or PDF";
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_LABEL = "8MB";

/** Mirrors the CHECK on business_documents.kind. */
export type HostDocumentKind = "identity" | "registration" | "association" | "licence" | "hygiene";

export const HOST_DOCUMENT_KINDS: readonly HostDocumentKind[] = [
  "identity",
  "registration",
  "association",
  "licence",
  "hygiene",
] as const;

export type DocumentSpec = {
  kind: HostDocumentKind;
  title: string;
  /** What actually qualifies. Named documents, not a category noun. */
  qualifies: string;
  /** The one thing people get wrong about this document. */
  caution: string;
};

export const DOCUMENT_SPECS: Record<HostDocumentKind, DocumentSpec> = {
  identity: {
    kind: "identity",
    title: "Government issued ID of the representative",
    qualifies:
      "An international passport, a driver's licence, a NIN slip or card, or a permanent voter's card.",
    caution: "All four corners in frame, and the photograph and the numbers readable.",
  },
  registration: {
    kind: "registration",
    title: "CAC certificate",
    qualifies: "The certificate of incorporation or business name registration, as the CAC issued it.",
    caution: "The RC or BN number on it must match the one you typed.",
  },
  association: {
    kind: "association",
    title: "Proof you act for the business",
    qualifies:
      "A letter of authorisation on the business's letterhead, or your employment ID. Not needed if you are named on the CAC record.",
    caution: "It must name you and the business, and be signed.",
  },
  licence: {
    kind: "licence",
    title: "State hospitality licence",
    qualifies: "The current licence or registration from your state's tourism or hospitality body.",
    caution: "Optional. It renders on your page as a dated fact, not as a badge.",
  },
  hygiene: {
    kind: "hygiene",
    title: "Health permit",
    qualifies: "The current Local Government health permit for the venue.",
    caution: "Optional alongside the attestation. It renders as a dated fact, not as a badge.",
  },
};

/** Why a chosen file cannot be used, in words, before anything is uploaded. */
export function rejectFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return `That file is not ${ACCEPTED_LABEL}. Choose one of those instead.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `That file is over ${MAX_FILE_LABEL}. Photograph the document again at a lower resolution, or use a PDF.`;
  }
  return null;
}

/**
 * Loose on purpose, and identical to the CHECK on businesses.cac_number: RC,
 * BN or IT prefix, optional space or hyphen, four to ten digits, any case.
 * Verification is a rung a human records, not a regex.
 */
export const CAC_NUMBER_RE = /^(RC|BN|IT)?\s?-?\d{4,10}$/i;

/* ------------------------------------------------------------------ steps */

export type HostStepId =
  | "host-type"
  | "business"
  | "registration"
  | "representative"
  /* The hotel's four, `GOVERNING-10`. */
  | "hotel"
  | "room-types"
  | "rates"
  /* The shortlet's two, `GOVERNING-11` screens one and two. */
  | "place"
  | "house-rules"
  /* Shared by both accommodation branches: `GOVERNING-10` screen four. */
  | "facilities"
  /* Both accommodation branches: every charge a guest could be asked for at
     the door (V-57), which the publish gate requires. */
  | "extra-charges"
  /* The restaurant's two, `GOVERNING-11` screens three and four. */
  | "restaurant"
  | "tables"
  | "payout"
  | "consent"
  | "review";

/* ---------------------------------------------------------- stays branches */

/**
 * WHICH SET OF DRAWN SCREENS A STAYS HOST GETS.
 *
 * `GOVERNING-10` is a hotel's four screens. `GOVERNING-11` splits into a
 * shortlet's two and a restaurant's two. A guest house and a serviced
 * apartment block are run like a hotel, rooms with rates and several of each,
 * so they take the hotel's screens; a shortlet operator lets one place at a
 * time and gets its own.
 *
 * IT LIVES HERE RATHER THAN IN `stays-setup.ts` FOR ONE REASON: `stepsFor`
 * below needs it, `stays-setup.ts` needs this file's `BusinessKind`, and a
 * value import in both directions is a module cycle. `stays-setup.ts`
 * re-exports it so the screens can read it from the file they already read
 * everything else from.
 */
export type StaysBranch = "hotel" | "shortlet" | "restaurant";

export function branchFor(kind: BusinessKind | null): StaysBranch {
  if (kind === "restaurant") return "restaurant";
  if (kind === "shortlet_operator") return "shortlet";
  return "hotel";
}

export type HostStep = {
  id: HostStepId;
  /** The heading, which is also the one task this step asks for. */
  title: string;
  /** The sentence under it. One task per step means one sentence. */
  hint: string;
};

const STEPS: Record<HostStepId, HostStep> = {
  "host-type": {
    id: "host-type",
    title: "What kind of host are you?",
    hint: "This decides which steps you see, and nothing else.",
  },
  business: {
    id: "business",
    title: "Your business, named and placed",
    hint: "Three short groups: what it is called, how to reach it, and where it sits.",
  },
  registration: {
    id: "registration",
    title: "Registration papers",
    hint: "The name as the CAC holds it, the RC or BN number, and the certificate.",
  },
  representative: {
    id: "representative",
    title: "You, the representative",
    hint: "One government issued ID, your name and your phone.",
  },
  /*
   * THE EIGHT DRAWN STAYS STEPS. Every title and every hint below is the
   * render's own wording, because the render's wording is the question and
   * this file is where the questions live.
   */
  hotel: {
    id: "hotel",
    title: "Your hotel",
    hint: "Tell us about your hotel and its basic details.",
  },
  "room-types": {
    id: "room-types",
    title: "Your room types",
    hint: "Tell us what kinds of rooms guests can book.",
  },
  rates: {
    id: "rates",
    title: "Rates",
    hint: "Set the nightly prices for each room type.",
  },
  place: {
    id: "place",
    title: "Your place",
    hint: "What kind of shortlet are you listing?",
  },
  "house-rules": {
    id: "house-rules",
    title: "House rules and cancellation",
    hint: "Set your house rules and cancellation policy.",
  },
  facilities: {
    id: "facilities",
    title: "Facilities and photos",
    hint: "Show guests what the property has to offer, and where it is.",
  },
  "extra-charges": {
    id: "extra-charges",
    title: "Extra charges",
    hint: "Anything a guest could be asked to pay when they arrive. Answer all five, an amount or none.",
  },
  restaurant: {
    id: "restaurant",
    title: "Your restaurant",
    hint: "Tell us about your restaurant.",
  },
  tables: {
    id: "tables",
    title: "Tables and hours",
    hint: "Set your opening hours and table inventory.",
  },
  payout: {
    id: "payout",
    title: "Getting paid",
    hint: "A bank account, confirmed with the bank before it is saved.",
  },
  consent: {
    id: "consent",
    title: "Permissions",
    hint: "Three separate agreements. Each one is its own decision.",
  },
  review: {
    id: "review",
    title: "Check and send",
    hint: "Nothing is submitted until you press the button on this screen.",
  },
};

/**
 * The steps THIS host will actually see.
 *
 * `hostType` is null until they have answered the first question. While it is
 * null the branch steps are not in the list, so the progress line never
 * promises a shorter flow than they are going to get and never pads the count
 * with a step somebody is not going to be asked.
 */
export function stepsFor(hostType: HostType | null, kind: BusinessKind | null = null): HostStep[] {
  const ids: HostStepId[] = ["host-type", "business"];
  if (hostType === "business") ids.push("registration");
  if (hostType !== null) ids.push("representative");
  if (hostType === "individual" || hostType === "business") {
    /*
     * THE BRANCH IS THE KIND'S AND NOT THE HOST TYPE'S, which is the one thing
     * `stepsFor` did not know before. A shortlet operator can be an individual
     * or a registered company, and either way they are letting a flat rather
     * than running a hotel: `GOVERNING-11` asks them about bedrooms and beds
     * where `GOVERNING-10` asks a hotelier about room types and rates. Passing
     * no kind keeps the hotel's screens, which is where a host lands before
     * they have told us anything.
     */
    const drawn: HostStepId[] =
      branchFor(kind) === "shortlet"
        ? ["place", "house-rules"]
        : ["hotel", "room-types", "rates"];
    /* The charges at the door come last before the payout, so they are
       answered before the application is sent: an approved stay cannot be
       published until all five are (V-57). */
    ids.push(...drawn, "facilities", "extra-charges");
  }
  if (hostType === "restaurant") ids.push("restaurant", "tables");
  ids.push("payout", "consent", "review");
  return ids.map((id) => STEPS[id]);
}

/** "Step 4 of 9". One place, so no screen can print its own arithmetic. */
export function progressLabel(index: number, total: number): string {
  return `Step ${index + 1} of ${total}`;
}

/* --------------------------------------------------------------- business */

export type BusinessField = {
  name: string;
  label: string;
  /** Placed under the input, not inside it. A placeholder is not a label. */
  hint?: string;
  optional?: boolean;
  type?: "text" | "tel" | "email" | "textarea";
};

export type BusinessSection = {
  heading: string;
  note: string;
  fields: BusinessField[];
};

/** Three headed groups, never a stack of boxes. The kyc.ts argument applies. */
export const BUSINESS_SECTIONS: readonly BusinessSection[] = [
  {
    heading: "Identity",
    note: "What the business is called and how you describe it to a guest.",
    fields: [
      { name: "name", label: "Business name" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        optional: true,
        hint: "A few sentences a guest would read on your page.",
      },
    ],
  },
  {
    heading: "Contact",
    note: "How a guest, and how we, reach the business.",
    fields: [
      { name: "phone", label: "Business phone", type: "tel" },
      { name: "email", label: "Business email", type: "email", optional: true },
    ],
  },
  {
    heading: "Address",
    note: "Where the business actually operates from.",
    fields: [
      { name: "address", label: "Street address" },
      { name: "area", label: "Area or neighbourhood", optional: true },
      { name: "city", label: "City or town" },
      { name: "stateCode", label: "State" },
    ],
  },
] as const;

/* ----------------------------------------------------------------- consent */

export type ConsentId = "accuracy" | "terms" | "processing";

export type Consent = {
  id: ConsentId;
  label: string;
  detail: string;
};

/**
 * THREE CHECKBOXES, NOT ONE. A statement of fact about the documents,
 * acceptance of a contract, and NDPA-specific permission to process identity
 * data through third-party checks. Under the Nigeria Data Protection Act the
 * last has to be freely given and specific; bundling it makes it neither.
 * Stored as three timestamps in businesses.consents, keyed by id.
 */
export const CONSENTS: readonly Consent[] = [
  {
    id: "accuracy",
    label: "The documents I have uploaded are genuine and the details are accurate",
    detail:
      "Submitting a document that belongs to somebody else, or that has been altered, ends the account and is reported.",
  },
  {
    id: "terms",
    label: "I accept the host terms of service and the privacy policy",
    detail: "Both open in a new tab and neither has changed for this form.",
  },
  {
    id: "processing",
    label: "Vallo may process my details for identity and fraud checks",
    detail:
      "A person at Vallo checks your name, document numbers and business registration against the documents you upload and the CAC record. Your documents are not sold, and not used for anything else.",
  },
] as const;

/* ------------------------------------------------------------------- draft */

/**
 * The application as read back from the database, shaped for `missingFrom`.
 * Counts rather than rows for the children, because the review step needs to
 * know that at least one exists, not what it says.
 */
export type HostDraft = {
  businessId: string | null;
  status: Database["public"]["Enums"]["listing_status"] | null;
  hostType: HostType | null;
  kind: BusinessKind | null;
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  city: string;
  stateCode: string;
  registeredName: string;
  cacNumber: string;
  tin: string;
  representativeName: string;
  representativePhone: string;
  /** Which document kinds have at least one file on record. */
  documents: Partial<Record<HostDocumentKind, true>>;
  accommodation: {
    id: string;
    name: string;
    hasPin: boolean;
    /**
     * The photographs on record, cover first, rather than a count of them.
     *
     * A COUNT WAS ALL THIS CARRIED WHILE THERE WAS NOWHERE TO UPLOAD ONE. The
     * wizard could only say how many existed and then tell the host that
     * property photographs arrived "with the next host release", while
     * `missingFrom` below refused to submit without one. Now that the property
     * step manages them, it needs the rows themselves to draw them.
     */
    photos: { id: string; url: string }[];
    /**
     * The amenity codes this property claims.
     *
     * Not a submission requirement and deliberately not one: a guest house
     * with nothing but a bed and a generator is a real listing and the shelf
     * should carry it. It is here because the facilities control needs to draw
     * what is already ticked, and because `accommodation_amenities` had no
     * writer at all until this pass, so every facility filter on the stays
     * shelf returned nothing for every hotel.
     */
    facilities: string[];
    /*
     * THE FIELDS `GOVERNING-10` SCREEN ONE AND `GOVERNING-11` SCREEN TWO DRAW,
     * which the draft could not previously read back.
     *
     * Every one of them is a column that already exists on `accommodations`
     * and every one of them was WRITABLE from the old property step and not
     * READABLE afterwards, so a host who saved a check-in time and came back
     * to the step was shown an empty box and could overwrite their own answer
     * with a default. A form that cannot read back what it wrote is a form
     * that loses work, and the drawn screens print these values rather than
     * asking for them again.
     */
    starRating: number | null;
    checkInFrom: string;
    checkOutBy: string;
    houseRules: string;
    cancellationPolicyId: string | null;
  } | null;
  roomTypeCount: number;
  ratePlanCount: number;
  /**
   * The room types on record, as `GOVERNING-10` screen two lists them: what a
   * guest can book, how many there are of it, and how many it sleeps.
   *
   * BESIDE THE COUNTS RATHER THAN INSTEAD OF THEM. `missingFrom` asks only
   * whether there is at least one of each, which is a count question, and the
   * counts come from a read that also carries the rate plans. The list is what
   * the step DRAWS, and a room type saved and then forgotten is the commonest
   * reason a host adds the same room twice.
   */
  roomTypes: {
    id: string;
    name: string;
    sleeps: number;
    unitsTotal: number;
    rateCount: number;
    /* What kind of room, or for a shortlet what kind of place. */
    category: string;
    baseRateMinor: number;
    /*
     * THE RATES THEMSELVES, because `GOVERNING-10` screen three is a screen
     * about them and a count cannot be drawn. Integer kobo, printed only
     * through `formatMoney`.
     */
    rates: { id: string; name: string; mealPlan: string; rateMinor: number }[];
    /**
     * What is actually slept in, and how many rooms it is spread over.
     *
     * `beds` is the TOTAL read out of `room_types.beds`, which is a jsonb
     * ARRAY of `{kind, count}` enforced by `room_types_beds_check`. This field
     * said the column had no shape constraint; it has had one since it was
     * created, the shortlet screen was written from that sentence and wrote an
     * object, and every real save would have failed with `23514`. The whole
     * fault is in `20260922200000_imgc_a_bedroom_is_not_a_bed.sql`.
     *
     * `bedrooms` IS NULL UNTIL SOMEBODY IS ASKED, which is every hotel room
     * type and every row written before that migration ran. Null and 0 are
     * different facts: 0 is a studio's true answer.
     */
    beds: { bedrooms: number | null; beds: number } | null;
  }[];
  restaurant: {
    priceBand: number | null;
    cuisineCount: number;
    /* The cuisines themselves, which `GOVERNING-11` screen three draws as
       chips and which a count cannot express. */
    cuisines: string[];
    /*
     * The restaurant's own table rules. Null until set, and null on an estate
     * where `20261013090200_...` has not run, where they cannot be kept.
     */
    sittingMinutes: number | null;
    holdMinutes: number | null;
    cancelNoticeHours: number | null;
  } | null;
  serviceWindowCount: number;
  /** SUP-17: photographs of the business itself (a restaurant's), on record. */
  businessPhotoCount: number;
  /**
   * Those photographs themselves, cover first, so the restaurant's step can
   * draw them. `missingFrom` refuses a restaurant with none, and until the
   * wizard carried them there was nowhere in the application to add one.
   */
  businessPhotos: { id: string; url: string }[];
  /*
   * THE OPENING HOURS, as `GOVERNING-11` screen four lists them: one row a
   * day, with the hours and a switch. Read back for the same reason as the
   * accommodation's times above, and because a restaurant that has already
   * said it opens on Friday must not be asked again.
   */
  serviceWindows: {
    id: string;
    weekday: number;
    opens: string;
    lastSeating: string;
    closes: string;
    covers: number;
  }[];
  hygieneAttestedAt: string | null;
  licenceAttestedAt: string | null;
  hasBankAccount: boolean;
  /** ISO instants keyed by consent id; an absent key is a consent not given. */
  consents: Partial<Record<ConsentId, string>>;
  /**
   * The reviewer's words when the application was sent back
   * (MORE_INFO_REQUIRED) or refused. The wizard prints them at the top of
   * every step, because a host told "open the application to answer" has to
   * be able to read the question there.
   */
  reviewNotes: string | null;
  /**
   * The charges at the door, as last declared and complete, or null when the
   * five have not all been answered. A stay is not sent without them (V-57).
   */
  arrivalCharges: ArrivalCharges | null;
  /** Consents given and then withdrawn, newest last, for the record. */
  consentWithdrawals: { id: ConsentId; at: string }[];
  /**
   * The Host Agreement version this host agreed to (with the Terms and the
   * Privacy policy, `consents.agreements`), or null. Agreed before the
   * business is created; a business on an older version is asked again.
   */
  hostAgreementVersion: string | null;
  /**
   * Ruling 6 (13 October 2026): the version of "Every payment for a deal I
   * make on Vallo happens inside Vallo." this host ticked, or null. Optional
   * so a draft written before it reads as not yet ticked.
   */
  payOnValloVersion?: string | null;
};

/** A draft with nothing in it, for a host who has not started. */
export function emptyHostDraft(): HostDraft {
  return {
    businessId: null,
    status: null,
    hostType: null,
    kind: null,
    name: "",
    description: "",
    phone: "",
    email: "",
    address: "",
    area: "",
    city: "",
    stateCode: "",
    registeredName: "",
    cacNumber: "",
    tin: "",
    representativeName: "",
    representativePhone: "",
    documents: {},
    accommodation: null,
    roomTypeCount: 0,
    ratePlanCount: 0,
    roomTypes: [],
    restaurant: null,
    serviceWindowCount: 0,
    businessPhotoCount: 0,
    businessPhotos: [],
    serviceWindows: [],
    hygieneAttestedAt: null,
    licenceAttestedAt: null,
    hasBankAccount: false,
    consents: {},
    reviewNotes: null,
    arrivalCharges: null,
    consentWithdrawals: [],
    hostAgreementVersion: null,
    payOnValloVersion: null,
  };
}

/**
 * The wizard's draft after the server has read the application back.
 *
 * WHY THIS EXISTS. Every write in the wizard ends in `router.refresh()`, which
 * hands the wizard a fresh `initial` read from the database, and the wizard
 * kept its first copy in state and never looked at the new one. So a property,
 * a room type, a rate, a photograph or a week of hours could be saved and the
 * screen would go on drawing the draft from before the save: the room types
 * step never offered Continue, the facilities step said "save the property
 * first" about a property that existed, an uploaded photograph never appeared,
 * the health permit box would not stay ticked, and Back showed blanks over
 * answers that were on record.
 *
 * WHAT COMES FROM WHERE. The rows only the server writes (the property, its
 * rooms, rates and photographs, the restaurant's profile, hours and
 * photographs, the attestations, the status and the reviewer's note) are taken
 * from the read. The words the person is typing (names, contact, address,
 * registration, the representative) and the host type stay the device's,
 * because a keystroke made while a save was in flight is newer than the read
 * that save produced. Documents and the bank account only ever gain an entry.
 * Consents are the server's: ticking one records it and unticking one
 * records its withdrawal.
 *
 * A READ THAT CAME BACK EMPTY CHANGES NOTHING. `readMyHostDraft` answers a
 * failed read with an empty draft, and adopting it would wipe the screen.
 */
export function mergeServerDraft(local: HostDraft, server: HostDraft): HostDraft {
  if (!server.businessId) return local;
  if (local.businessId && local.businessId !== server.businessId) return local;
  return {
    ...local,
    businessId: server.businessId,
    status: server.status,
    documents: { ...local.documents, ...server.documents },
    accommodation: server.accommodation,
    roomTypeCount: server.roomTypeCount,
    ratePlanCount: server.ratePlanCount,
    roomTypes: server.roomTypes,
    restaurant: server.restaurant,
    serviceWindowCount: server.serviceWindowCount,
    businessPhotoCount: server.businessPhotoCount,
    businessPhotos: server.businessPhotos,
    serviceWindows: server.serviceWindows,
    hygieneAttestedAt: server.hygieneAttestedAt,
    licenceAttestedAt: server.licenceAttestedAt,
    hasBankAccount: local.hasBankAccount || server.hasBankAccount,
    reviewNotes: server.reviewNotes,
    arrivalCharges: server.arrivalCharges,
    /* Every tick and every untick is now a write (a withdrawal is recorded),
       so the read is the truth about consents too. */
    consents: server.consents,
    consentWithdrawals: server.consentWithdrawals,
    hostAgreementVersion: server.hostAgreementVersion,
    payOnValloVersion: server.payOnValloVersion ?? null,
  };
}

/**
 * Whether the review step may submit at all, and if not, what is missing.
 *
 * The blocking list of docs/research/HOST_ONBOARDING_RESEARCH.md section 3.3,
 * verbatim: identity document present, the business complete, the CAC number
 * entered for the business branch, one bookable unit, photos and the pin, a
 * resolved bank account, and the three consents. Everything else (the CAC
 * actually verified, the payout name match, licences) is a post-live rung or
 * a dated fact and never blocks the shelf.
 */
export function missingFrom(draft: HostDraft): string[] {
  const missing: string[] = [];
  const blank = (value: string) => value.trim().length === 0;

  if (!draft.hostType) {
    missing.push("What kind of host you are");
    return missing;
  }
  if (!draft.kind) missing.push("The kind of business");

  for (const section of BUSINESS_SECTIONS) {
    for (const field of section.fields) {
      if (field.optional) continue;
      const value = draft[field.name as keyof HostDraft];
      if (typeof value === "string" && blank(value)) missing.push(field.label);
    }
  }

  if (draft.hostType === "business") {
    if (blank(draft.registeredName)) missing.push("Registered business name");
    if (blank(draft.cacNumber)) missing.push("CAC registration number");
    if (!draft.documents.registration) missing.push(DOCUMENT_SPECS.registration.title);
  }

  if (blank(draft.representativeName)) missing.push("Your full name");
  if (blank(draft.representativePhone)) missing.push("Your phone number");
  if (!draft.documents.identity) missing.push(DOCUMENT_SPECS.identity.title);

  if (hostsAccommodation(draft.hostType)) {
    if (!draft.accommodation) {
      missing.push("The property");
    } else {
      if (draft.accommodation.photos.length === 0) missing.push("At least one photo of the property");
      if (!draft.accommodation.hasPin) missing.push("The pin on the map");
    }
    if (draft.roomTypeCount === 0) missing.push("At least one room type");
    if (draft.ratePlanCount === 0) missing.push("A rate with a cancellation policy");
    /* V-57: the publish gate refuses a stay whose charges at the door are not
       all answered, so the application asks for them before it is sent. */
    if (!draft.arrivalCharges) missing.push("The charges at the door, all five answered");
  } else {
    if (!draft.restaurant || draft.restaurant.priceBand === null) missing.push("A price band");
    if (draft.serviceWindowCount === 0) missing.push("At least one service window");
    if (!draft.hygieneAttestedAt) missing.push("The health permit attestation");
    /* SUP-17: a restaurant goes on the shelf with a photograph, like a stay. */
    if (draft.businessPhotoCount === 0) missing.push("At least one photo of the restaurant");
  }

  if (!draft.hasBankAccount) missing.push("A bank account for payouts");

  /* Founder decision B: the Terms, the Privacy policy and the Host Agreement,
     agreed with their versions, before anything is sent or published. */
  if (draft.hostAgreementVersion !== HOST_AGREEMENT_VERSION) {
    missing.push("Your agreement to the Terms, the Privacy policy and the Host Agreement");
  }
  /* Ruling 6: and that every payment for a deal happens inside Vallo. */
  if (draft.payOnValloVersion !== PAY_ON_VALLO_VERSION) {
    missing.push("Your statement that every payment for a deal you make on Vallo happens inside Vallo");
  }

  for (const consent of CONSENTS) {
    if (!draft.consents[consent.id]) missing.push(consent.label);
  }

  return missing;
}

/* -------------------------------------------------------------- documents */

/**
 * Whether an uploaded path belongs to this person's own folder in the
 * host-documents bucket. Storage RLS enforces the same rule on the upload,
 * so a path that fails here was never written by this user and has no
 * business being recorded against their application.
 */
export function documentPathBelongsTo(userId: string, storagePath: string): boolean {
  /* A prefix is only a folder if nothing after it walks out of it, so
     `<uid>/../<someone else>/id.pdf` is never recorded as this person's. */
  return pathInOwnFolder(userId, storagePath);
}
