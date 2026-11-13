/**
 * The profile photo, asked as the last step of sign-up (lib/auth/photo-step.ts),
 * skippable in one tap. On 13 November 2026 "Confirm your information" was
 * removed (the name is given at sign-up) and the photo sheet that rose over the
 * first page after sign-up moved here, into sign-up itself.
 */
export const profileSetupEn = {
  /**
   * THE LAST STEP OF SIGN-UP (13 November 2026): the photo, asked before the
   * account lands, never after it. Skippable in one tap, never shamed.
   */
  step: {
    title: "Add a profile photo",
    body: "People you meet and deal with on Vallo see it beside your name. You can change it any time.",
    choose: "Choose from your photos",
    take: "Take a photo",
    change: "Choose another",
    continue: "Continue",
    skip: "Skip for now",
    saving: "Saving your photo",
    later: "This photo did not upload on your connection. Continue, and add it any time from your profile.",
    previewLabel: "Your profile photo",
    emptyLabel: "No photo chosen yet",
  },
};
