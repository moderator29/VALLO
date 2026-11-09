/**
 * PROTECT YOUR ACCOUNT (Platform Grade 1, 6 November 2026). The passcode is
 * optional: a new member goes straight in, and the home screen carries this
 * slim alert until they set one or close it (`components/passcode/
 * PasscodeOffer.tsx`). Closed, it comes back once after 60 days.
 *
 * Its own namespace, English only, so no Yoruba, Hausa or Igbo words are
 * invented for it: the other locales read the English until a native speaker
 * translates it (docs/handoff/PLATFORM_GRADE_1_READINESS.md, rule 7).
 */
export const protectEn = {
  offerTitle: "Protect your account",
  offerBody: "Add a passcode, and Face ID where your phone has it, so nobody else can open Vallo on this device.",
  offerAction: "Set up",
  offerDismiss: "Not now",
};
