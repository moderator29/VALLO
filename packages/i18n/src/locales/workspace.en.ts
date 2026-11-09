/**
 * Workspace standing copy (SW11). Moved from `lib/supply/roles.ts`.
 */

export const workspaceStandingEn = {
  active: { label: null, meaning: null },
  draft: {
    label: "Not finished",
    meaning: "Nothing is submitted until you press the button on the last screen.",
  },
  pending: {
    label: "Pending review",
    meaning: "A person reads this. You can build listings now; publishing opens when it comes back.",
  },
  refused: {
    label: "Not approved",
    meaning: "Open it to read why, in full, and to send the missing thing.",
  },
  suspended: {
    label: "Suspended",
    meaning: "Open it to read the reason. Confirmed stays are untouched.",
  },
};
