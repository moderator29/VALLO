/**
 * The first-run sheets after sign-up: confirm your name, then add a photo.
 * Both are skippable and come back on a later visit, not every visit
 * (`lib/first-run/profile-setup-core.ts`).
 */
export const profileSetupEn = {
  close: "Close",
  skip: "Skip for now",
  name: {
    title: "Confirm your information",
    description: "Please review and confirm your name to finish setting up your account. Make sure your name matches your government-issued ID.",
    fieldLabel: "Full name",
    save: "Save and continue",
    needsTwoNames: "Enter your first name and your surname.",
    failed: "We could not save your name just now. Check your connection and try again.",
  },
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
  profileRow: {
    addPhoto: "Add your photo",
  },
};
