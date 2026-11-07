/**
 * THE VERIFICATION FLOW'S GRADE 1 WORDS (Platform Grade 1, P0.3, November
 * 2026): the "what will happen" intro, each step's eyebrow, the review's
 * Change. English only, its own namespace, so no translation is invented;
 * the other locales read the English until a native speaker translates it.
 * The steps' own titles and hints stay in `experienceAccount.kyc`.
 */
export const verifyFlowEn = {
  introEyebrow: "Identity check",
  introTitle: "Verify your identity",
  introBody:
    "Vallo checks every lister before their first deal, so renters, guests and buyers know exactly who they are dealing with.",
  introNeedTitle: "What you'll need",
  introNeedId: "A photo of your ID: an international passport, a driver's licence, a NIN slip or card, or a voter's card",
  introNeedSelfie: "A quick live selfie, taken on this screen",
  introNeedAddress: "Proof of address dated in the last 3 months, such as a utility bill",
  introPrivacy:
    "Your documents are private. Only Vallo's verification team sees them, and they never appear on your listings or profile.",
  introTime: "About five minutes. A person checks it, most within one working day, and we tell you either way.",
  introStart: "Start",
  introResume: "Continue where you left off",
  close: "Close",
  change: "Change",
  /* Sections, not the step's own title: the eyebrow says where you are in
     the flow (reference R18: THE BASICS, LOCATION, FINISH). */
  eyebrows: {
    "identity-document": "Identity",
    selfie: "Identity",
    "address-document": "Address",
    "business-question": "Business",
    "business-details": "Business",
    consent: "Agreements",
    review: "Finish",
  },
};
