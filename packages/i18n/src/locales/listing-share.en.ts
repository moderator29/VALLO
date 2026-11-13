/**
 * Share to feed: the words of the button, the sheet, the feed card and the
 * banners (founder, 10 November 2026). A listing shared into the feed is a
 * post by the sharer; the card says "Shared", never anything that implies
 * Vallo picked it.
 */
export const listingShareEn = {
  /* "Post", the founder's word for the feed (13 November 2026). */
  button: "Post to your feed",
  buttonAria: "Post this listing to your feed",
  sheetTitle: "Post to your feed",
  sheetIntro: "This puts the listing in the feed as a post from you. Anyone can open the real listing from it.",
  previewLabel: "The listing you are posting",
  /* The X on the attached listing: there is nothing else to post, so it closes the sheet. */
  removeAttachment: "Remove the listing and close",
  attachmentNote: "This listing is the post. Take it off and there is nothing to post.",
  badge: "Shared",
  noteLabel: "Say something about it (optional)",
  notePlaceholder: "Say why this one caught your eye",
  noteCount: "{count} of {max}",
  slotsLeft: "You have {left} of {limit} shares left",
  slotsNone: "You have used all {limit} of your shares. Remove one from the feed to share another.",
  unlimited: "There is no share limit on your account.",
  share: "Post",
  sharing: "Posting",
  close: "Not now",
  loading: "Checking your shares",
  loadFailed: "We could not load this. Check your connection and try again.",
  retry: "Try again",
  done: "Posted to your feed. Find it under Around.",
  undone: "Share removed. The slot is free again.",
  undoFailedFull: "That share could not be put back because you have used all your shares.",
  restored: "Share put back in the feed.",
  removed: "Share removed from the feed. The slot is free again.",
  removeRow: "Remove share",
  removeNote: "Takes it out of the feed and frees one of your shares.",
  viewLabel: "View property",
  gone: "No longer available",
  goneNote: "The listing this post shared is not on Vallo any more.",
  alreadyShared: "You have already shared this listing. Remove that share first.",
  notLive: "This listing is not open to the public, so it cannot be shared.",
  signInPrompt: "Sign in to share this listing to the feed.",
  notOpen: "Sharing to the feed is not open yet.",
  limitReached: "You can share up to 2 listings at a time. Remove one to share another.",
  failed: "That share did not go through. Try again in a moment.",
  noteTooLong: "Keep the note to 280 characters or fewer.",
  noteLink: "Leave links and contact details out of the note.",
  ownListing: "This is your own listing.",
  paced: "You have shared a few times already. Try again later.",
  notifyTitle: "Your listing was shared to the feed",
  notifyBody: "{name} shared {title} to the feed.",
} as const;
