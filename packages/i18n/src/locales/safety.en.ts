/**
 * Safety, reporting and blocking copy (SW11). Moved from:
 *   - lib/safety/blocks-copy.ts
 *   - lib/reports/categories.ts (REPORT_CATEGORY_COPY)
 *   - lib/messages/education.ts (SAFETY_EDUCATION_COPY)
 *
 * Only the static strings live here; arrays and type guards stay in their
 * original modules. The locale file re-exports from here.
 */

export const safetyBlocksEn = {
  blockConfirm:
    "They will not be able to message you, see your profile or find your listings, and you will not see theirs. They are not told. You can undo this in Settings, Privacy.",
};

export const safetyReportsEn = {
  off_platform_payment: {
    label: "Asked me to pay outside Vallo",
    hint: "An account number, a transfer, or anything that skips the platform.",
  },
  scam: {
    label: "This looks like a scam",
    hint: "The place, the price or the person does not add up.",
  },
  unsafe: {
    label: "Unsafe or threatening",
    hint: "Anything that made you feel unsafe, in the property or in the messages.",
  },
  not_as_described: {
    label: "Not as described",
    hint: "The photos, the size, the address or the amenities are wrong.",
  },
  unavailable: {
    label: "Not actually available",
    hint: "Already let, no longer on the market, or the dates are never free.",
  },
  offensive: {
    label: "Offensive content",
    hint: "Wording or images that should not be on the platform.",
  },
  duplicate: {
    label: "Duplicate listing",
    hint: "The same property is listed more than once.",
  },
  other: {
    label: "Something else",
    hint: "Tell us in your own words below.",
  },
};

export const safetyReportTargetNounEn = {
  listing: "listing",
  conversation: "conversation",
  message: "message",
  review: "review",
  business: "place",
  event: "event",
  roommate_listing: "roommate post",
  roommate_profile: "roommate profile",
};

export const safetyEducationEn =
  "For your safety, keep every chat inside Vallo. Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong. Pay only after you have inspected the property.";
