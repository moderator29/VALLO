/**
 * The first-run sheet after sign-up: add a photo. Skippable, and it comes back
 * on a later visit, not every visit (`lib/first-run/profile-setup-core.ts`).
 * "Confirm your information" and its copy were removed on 13 November 2026:
 * the name is given at sign-up.
 */
export const profileSetupEn = {
  close: "Close",
  skip: "Skip for now",
  photo: {
    title: "Add a profile photo",
    description: "A clear photo helps people you meet on Vallo recognise you. It is optional, and you can add one any time from your profile.",
    choose: "Choose a photo",
    avatarLabel: "Profile photo placeholder",
    failed: "We could not upload that photo. Check your connection and try again.",
    badType: "Choose a JPG, PNG or WebP photo.",
    tooBig: "That photo is over 10MB. Please choose a smaller one.",
    unreadable: "We could not prepare that photo, so it was not uploaded. Try a different one.",
  },
};
