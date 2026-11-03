/**
 * Identity verification, as a model rather than as six screens.
 *
 * The flow branches, which is the only genuinely hard thing about it: somebody
 * who runs a property business answers one more step than somebody who does
 * not, so "step 4 of 6" is not a constant and cannot be hardcoded into the
 * header of each screen. Everything about which steps exist, which one is
 * showing, and what the progress line says therefore lives here, pure, and the
 * components render it.
 *
 * WHERE IT IS STORED is not this file's business either: `DocumentUploader`
 * puts each file in the private `agent-documents` bucket under the person's
 * own folder, and `submitVerification` (app/(app)/verification/actions.ts)
 * files the `agent_documents` rows and the `kyc_consents` receipts. The
 * checks here run on both sides, so the phone and the server never disagree
 * about what is missing.
 *
 * ---------------------------------------------------------------------------
 * WHY THE BUSINESS STEP IS GROUPED AND THE REFERENCE PLATFORM'S IS NOT.
 *
 * The platform we were shown asks for eight business fields as eight identical
 * outlined boxes in one vertical stack, with no headings between them. It is
 * the weakest screen in their product and it fails for a specific reason: a
 * flat stack gives a reader no way to estimate how much is left, no way to tell
 * which fields belong together, and no way to resume after being interrupted
 * except by reading every label again from the top.
 *
 * `BUSINESS_SECTIONS` below is the fix, and it is three headings rather than a
 * redesign: what the business IS, how to REACH it, and where it SITS. Three
 * groups of two to four fields each read as three small tasks. Eight boxes read
 * as a form.
 */

/* -------------------------------------------------------------- documents */

/**
 * The accepted file types and the size ceiling, stated once.
 *
 * These strings are rendered INLINE UNDER EVERY UPLOADER rather than kept as a
 * validation rule nobody sees. An upload control that only mentions its limits
 * inside the error it shows after a failed 8MB upload on Nigerian mobile data
 * has spent somebody's money to tell them something it knew beforehand.
 */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;
export const ACCEPTED_LABEL = "JPG, PNG, HEIC or PDF";
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_LABEL = "8MB";

export type DocumentKind = "identity" | "address";

export type DocumentSpec = {
  kind: DocumentKind;
  title: string;
  /** What actually qualifies. Named documents, not a category noun. */
  qualifies: string;
  /** The one thing people get wrong about this document. */
  caution: string;
};

export const DOCUMENT_SPECS: Record<DocumentKind, DocumentSpec> = {
  identity: {
    kind: "identity",
    title: "Government issued ID",
    qualifies:
      "An international passport, a driver's licence, a NIN slip or card, or a permanent voter's card.",
    caution: "All four corners in frame, and the photograph and the numbers readable.",
  },
  address: {
    kind: "address",
    title: "Proof of address",
    qualifies:
      "A utility bill, a bank statement, or a tenancy agreement showing your name and the address.",
    caution: "It must be dated within the last three months. Anything older is refused.",
  },
};

/**
 * WHICH document it is. The review desk records the subtype on the rung, and
 * a reviewer holding a photograph cannot always tell a NIN slip from a voter's
 * card at a glance. The values are the database's `document_subtype` labels.
 */
export const DOCUMENT_SUBTYPES: Record<DocumentKind, readonly { value: string; label: string }[]> = {
  identity: [
    { value: "passport", label: "International passport" },
    { value: "drivers_licence", label: "Driver's licence" },
    { value: "nin_card", label: "NIN slip or card" },
    { value: "voters_card", label: "Permanent voter's card" },
  ],
  address: [
    { value: "utility_bill", label: "Utility bill" },
    { value: "bank_statement", label: "Bank statement" },
    { value: "tenancy_agreement", label: "Tenancy agreement" },
  ],
};

export function isSubtypeOf(kind: DocumentKind, subtype: string | null | undefined): boolean {
  return DOCUMENT_SUBTYPES[kind].some((option) => option.value === subtype);
}

/** How old a proof of address may be, the same three months the caution states. */
export const ADDRESS_MAX_AGE_DAYS = 92;

/**
 * Why an address document's date will be refused, or null. `today` is an
 * ISO date so the check is the same on the phone and on the server.
 */
/**
 * What is wrong with a proof of address's date, as a code the screen words in
 * the reader's language (`experienceAccount.kyc`, Round 3 sweep). The English
 * sentences below stay for the server action, which answers in them.
 */
export type AddressDateIssue = "missing" | "future" | "old";

export function addressDateIssue(issuedOn: string | null | undefined, today: string): AddressDateIssue | null {
  if (!issuedOn || !/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) return "missing";
  const issued = Date.parse(`${issuedOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(issued)) return "missing";
  if (issued > now) return "future";
  if (now - issued > ADDRESS_MAX_AGE_DAYS * 86_400_000) return "old";
  return null;
}

const ADDRESS_DATE_EN: Record<AddressDateIssue, string> = {
  missing: "Enter the date printed on the document.",
  future: "That date is in the future. Enter the date printed on the document.",
  old: "That document is more than three months old, so it would be refused. Use a more recent one.",
};

export function addressDateProblem(issuedOn: string | null | undefined, today: string): string | null {
  const issue = addressDateIssue(issuedOn, today);
  return issue ? ADDRESS_DATE_EN[issue] : null;
}

/** Today in Lagos, as the ISO date both sides compare against. */
export function lagosToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}

/**
 * The extension a document is stored under, from its type rather than its
 * name. The reviewer's viewer (`lib/admin/documents.ts`) decides how to draw
 * a file from this extension, so a HEIC or WebP photo filed as `.jpg` would be
 * served with the wrong type and fail to open. Every uploader into the
 * private document bucket names its objects through this one function.
 */
export function documentExtension(type: string): string {
  switch (type) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

/** Why a chosen file cannot be used, as a code the screen words. */
export function rejectFileIssue(file: { type: string; size: number }): "type" | "size" | null {
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) return "type";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

/** Why a chosen file cannot be used, in words, before anything is uploaded. */
export function rejectFile(file: { type: string; size: number }): string | null {
  const issue = rejectFileIssue(file);
  if (issue === "type") return `That file is not ${ACCEPTED_LABEL}. Choose one of those instead.`;
  if (issue === "size") {
    return `That file is over ${MAX_FILE_LABEL}. Photograph the document again at a lower resolution, or use a PDF.`;
  }
  return null;
}

/* ------------------------------------------------------------------ steps */

export type StepId =
  | "identity-document"
  | "selfie"
  | "address-document"
  | "business-question"
  | "business-details"
  | "consent"
  | "review";

export type Step = {
  id: StepId;
  /** The heading, which is also the one task this step asks for. */
  title: string;
  /** The sentence under it. One task per step means one sentence. */
  hint: string;
};

const STEPS: Record<StepId, Step> = {
  "identity-document": {
    id: "identity-document",
    title: "Your ID",
    hint: "One government issued document that shows your face and your name.",
  },
  selfie: {
    id: "selfie",
    title: "A quick selfie",
    hint: "We compare it with the photo on your ID, so we know the ID is yours.",
  },
  "address-document": {
    id: "address-document",
    title: "Where you live",
    hint: "One recent document that shows your name at your address.",
  },
  "business-question": {
    id: "business-question",
    title: "Do you run a property business?",
    hint: "This decides whether we ask you for business details, and nothing else.",
  },
  "business-details": {
    id: "business-details",
    title: "Your business",
    hint: "Three short groups: what it is, how to reach it, and where it sits.",
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
 * The steps THIS person will actually see.
 *
 * `business` is the answer to the branching question, and it is `null` until
 * they have answered it. While it is null the business details step is not in
 * the list, so the progress line reads "of 5" and grows to "of 6" the moment
 * they say yes. That is honest either way: it never promises a shorter flow
 * than they are going to get, and it never pads the count with a step somebody
 * is not going to be asked.
 */
export function stepsFor(business: boolean | null, askBusiness = true): Step[] {
  /* The order the big platforms use: the ID, then the face that matches it,
     then everything else. The selfie is a plain photo of the face, taken
     live; nobody is asked to hold their ID up to the camera. */
  const ids: StepId[] = ["identity-document", "selfie", "address-document"];
  /* `askBusiness` is false when the answers could not be filed: the business
     details live on the application, and an application that is submitted,
     under review or decided cannot be edited by its applicant, so the eight
     fields were collected, shown back on the review step, and dropped. */
  if (askBusiness) {
    ids.push("business-question");
    if (business === true) ids.push("business-details");
  }
  ids.push("consent", "review");
  return ids.map((id) => STEPS[id]);
}

/** "Step 4 of 6". One place, so no screen can print its own arithmetic. */
export function progressLabel(index: number, total: number): string {
  return `Step ${index + 1} of ${total}`;
}

/* ---------------------------------------------------------------- business */

export type BusinessField = {
  name: string;
  label: string;
  /** Placed under the input, not inside it. A placeholder is not a label. */
  hint?: string;
  optional?: boolean;
  type?: "text" | "tel" | "email" | "url";
};

export type BusinessSection = {
  /** Which of the three groups, for the screen's words. */
  key: "identity" | "contact" | "address";
  /** The heading that turns a stack of boxes into a task. */
  heading: string;
  /** Why these fields are together, in one line. */
  note: string;
  fields: BusinessField[];
};

export const BUSINESS_SECTIONS: readonly BusinessSection[] = [
  {
    key: "identity",
    heading: "Business identity",
    note: "What the business is called and how it is registered.",
    fields: [
      { name: "businessName", label: "Registered business name" },
      {
        name: "rcNumber",
        label: "CAC registration number",
        hint: "The RC or BN number on your certificate.",
      },
      {
        name: "tin",
        label: "Tax identification number",
        optional: true,
        hint: "If you have one. It is not required to be approved.",
      },
    ],
  },
  {
    key: "contact",
    heading: "Contact",
    note: "How a client, and how we, reach the business.",
    /* No website field. It was asked, printed on the review step and then
       dropped, because `agent_applications` has no column for it. */
    fields: [
      { name: "businessPhone", label: "Business phone", type: "tel" },
      { name: "businessEmail", label: "Business email", type: "email" },
    ],
  },
  {
    key: "address",
    heading: "Address",
    note: "Where the business actually operates from.",
    fields: [
      { name: "street", label: "Street address" },
      { name: "city", label: "City or town" },
      { name: "state", label: "State" },
    ],
  },
] as const;

/* ----------------------------------------------------------------- consent */

export type ConsentId = "accuracy" | "terms" | "processing";

export type Consent = {
  id: ConsentId;
  label: string;
  /** What they are actually agreeing to, in full, under the label. */
  detail: string;
};

/**
 * THREE CHECKBOXES, NOT ONE.
 *
 * A single "I agree to everything" tick is convenient and it is not consent.
 * These are three genuinely different things - a statement of fact about the
 * documents, acceptance of a contract, and permission to process biometric-
 * adjacent personal data through third-party identity and fraud checks - and
 * under the Nigeria Data Protection Act the last of those has to be freely
 * given and specific. Bundling it with the terms makes it neither.
 */
export const CONSENTS: readonly Consent[] = [
  {
    id: "accuracy",
    label: "The documents I have uploaded are mine and are accurate",
    detail:
      "Submitting a document that belongs to somebody else, or that has been altered, ends the account and is reported.",
  },
  {
    id: "terms",
    label: "I accept the terms of service and the privacy policy",
    detail: "Both open in a new tab and neither has changed for this form.",
  },
  {
    id: "processing",
    label: "Vallo may process my details and my selfie for identity and fraud checks",
    detail:
      "A person on Vallo's verification team checks your documents, compares your selfie with the photo on your ID, and checks that the name on the bank account you are paid into matches your ID. Your documents and your photo are not sold, not shared with other members, and not used for anything else.",
  },
] as const;

/* -------------------------------------------------------------- submission */

/**
 * One document as the flow holds it: already uploaded to the private
 * document store under the person's own folder, so `path` is real, plus the
 * two answers the reviewer needs about it.
 */
export type KycDocument = {
  name: string;
  size: number;
  type: string;
  path: string;
  subtype: string | null;
  /** The date printed on a proof of address. Null for an ID. */
  issuedOn: string | null;
};

/** The selfie as the flow holds it: uploaded, so `path` is real. */
export type KycSelfie = { path: string; size: number; type: string };

/** What the UI produces, and what `submitVerification` files. */
export type KycSubmission = {
  documents: Partial<Record<DocumentKind, KycDocument>>;
  /**
   * The live selfie (2 November 2026), already in the private bucket under
   * the person's own folder. Compared by a person with the photo on the ID.
   */
  selfie?: KycSelfie | null;
  business: boolean;
  businessDetails: Record<string, string>;
  consents: ConsentId[];
  /**
   * Ruling 6 (13 October 2026): when this submission files or resubmits a
   * workspace application, the Terms and Privacy Policy tick and the
   * pay-on-Vallo tick, recorded on the application (pov07, pov08).
   */
  acceptTerms?: boolean;
  acceptPayOnVallo?: boolean;
};

export type KycSubmitResult = { ok: true } | { ok: false; message: string };

/**
 * Whether the review step may submit at all, and if not, what is missing.
 *
 * Returns the list rather than a boolean so the review screen can PRINT it.
 * "Complete all required fields" is the least useful sentence in software.
 */
/**
 * What is missing, as items the screen can word in the reader's language
 * (Round 3 sweep). `missingFrom` below is the same list in English, which the
 * server action answers in.
 */
export type MissingItem =
  | { kind: "document"; document: DocumentKind }
  | { kind: "selfie" }
  | { kind: "which-id" }
  | { kind: "which-address" }
  | { kind: "address-date" }
  | { kind: "field"; name: string }
  | { kind: "consent"; id: ConsentId };

export function missingItems(submission: KycSubmission, today: string = lagosToday()): MissingItem[] {
  const missing: MissingItem[] = [];
  const identity = submission.documents.identity;
  const address = submission.documents.address;
  if (!identity) missing.push({ kind: "document", document: "identity" });
  else if (!isSubtypeOf("identity", identity.subtype)) missing.push({ kind: "which-id" });
  if (!submission.selfie?.path) missing.push({ kind: "selfie" });
  if (!address) missing.push({ kind: "document", document: "address" });
  else {
    if (!isSubtypeOf("address", address.subtype)) missing.push({ kind: "which-address" });
    if (addressDateIssue(address.issuedOn, today)) missing.push({ kind: "address-date" });
  }

  if (submission.business) {
    for (const section of BUSINESS_SECTIONS) {
      for (const field of section.fields) {
        if (field.optional) continue;
        if (!(submission.businessDetails[field.name] ?? "").trim()) missing.push({ kind: "field", name: field.name });
      }
    }
  }

  for (const consent of CONSENTS) {
    if (!submission.consents.includes(consent.id)) missing.push({ kind: "consent", id: consent.id });
  }

  return missing;
}

export function missingFrom(submission: KycSubmission, today: string = lagosToday()): string[] {
  const fieldLabel = new Map(BUSINESS_SECTIONS.flatMap((s) => s.fields).map((f) => [f.name, f.label]));
  const consentLabel = new Map(CONSENTS.map((c) => [c.id, c.label]));
  return missingItems(submission, today).map((item) => {
    switch (item.kind) {
      case "document":
        return DOCUMENT_SPECS[item.document].title;
      case "selfie":
        return SELFIE;
      case "which-id":
        return WHICH_ID;
      case "which-address":
        return WHICH_ADDRESS;
      case "address-date":
        return ADDRESS_DATE;
      case "field":
        return fieldLabel.get(item.name) ?? item.name;
      case "consent":
        return consentLabel.get(item.id) ?? item.id;
    }
  });
}

const SELFIE = "A selfie";
const WHICH_ID = "Which ID you uploaded";
const WHICH_ADDRESS = "Which proof of address you uploaded";
const ADDRESS_DATE = "The date on your proof of address, within the last three months";
