/**
 * "WHAT A REAL ONE LOOKS LIKE" (15 November 2026).
 *
 * A short list per document that a reviewer ticks through by eye, on the
 * Cross-checks panel. Each line is a concrete, well-known feature of the
 * genuine Nigerian document. The rule for this file: write only what we are
 * sure of. A feature we are not sure of is left out, because a wrong line
 * here teaches a reviewer to refuse a real ID or to pass a fake one.
 *
 * No list is proof. A careful forgery copies every line, and the panel says
 * so under each list. The ticks are the reviewer's own working notes: they
 * are kept in the browser while the person is open and saved nowhere.
 */

export type IdChecklist = {
  /** The `document_subtype` value this list is for. */
  subtype: string;
  title: string;
  items: readonly string[];
};

export const ID_CHECKLISTS: readonly IdChecklist[] = [
  {
    subtype: "nin_card",
    title: "NIN slip or card",
    items: [
      "The NIN is 11 digits, all numbers, with no letters.",
      "It shows the holder's photo and their names.",
      "The improved slip, the one the size of a bank card, carries a QR code.",
      "The words Federal Republic of Nigeria are on it.",
      "The number and the names are in one typeface, in line with each other, with no digit bolder, larger or out of line.",
    ],
  },
  {
    subtype: "passport",
    title: "International passport",
    items: [
      "The photo page has two lines of capitals, digits and chevrons (<) along the bottom, each 44 characters long.",
      "On a Nigerian passport the first of those lines starts P<NGA.",
      "The passport number is one letter followed by 8 digits, and the same number starts the second bottom line.",
      "The photo is printed into the page, not glued or laid on top. Look for an edge, a shadow or a raised border around it.",
      "The name, date of birth and expiry printed on the page are the ones the bottom lines carry. Use the checker to read them out.",
      "The expiry date has not passed.",
    ],
  },
  {
    subtype: "drivers_licence",
    title: "Driver's licence",
    items: [
      "It is a plastic card that says Federal Republic of Nigeria and National Driver's Licence.",
      "It shows the holder's photo, their names, their date of birth and a licence number.",
      "The licence number mixes letters and digits. It is not digits only.",
      "It shows an issue date and an expiry date, and the expiry date has not passed.",
      "The front and the back are the same card: the same wear, the same corners, the same colour.",
    ],
  },
  {
    subtype: "voters_card",
    title: "Permanent voter's card",
    items: [
      "It names the Independent National Electoral Commission (INEC).",
      "It shows the holder's photo and their names.",
      "It carries a voter identification number (VIN): a long mix of letters and digits, usually 19 characters.",
      "It has no expiry date.",
      "The front and the back are the same card: the same wear, the same corners, the same colour.",
    ],
  },
];

/** For an ID from another country, or a kind we hold no list for. */
export const GENERAL_CHECKLIST: IdChecklist = {
  subtype: "general",
  title: "Any ID",
  items: [
    "It is a photo of the document itself, with all four corners in view. Not a screenshot, a photocopy or a photo of a screen.",
    "Every letter and digit in the name, the number and the dates is the same typeface, size and darkness as its neighbours.",
    "No patch around the photo, the name or the dates is blurred, brighter or a different colour from the rest.",
    "The photo is part of the document, not laid on top: no edge, no shadow, no raised border.",
    "The face is a believable age for the date of birth, and the document is in date.",
  ],
};

/** The same sentence under every list. */
export const CHECKLIST_CAVEAT =
  "No list of features is proof. A careful forgery copies all of them, so a full set of ticks means you found nothing wrong, not that the ID is real.";

/** The list for one document, or the general one when we hold none for it. */
export function checklistFor(subtype: string | null | undefined, issuingCountry?: string | null): IdChecklist {
  if (issuingCountry && issuingCountry.toUpperCase() !== "NG") return GENERAL_CHECKLIST;
  return ID_CHECKLISTS.find((list) => list.subtype === subtype) ?? GENERAL_CHECKLIST;
}
