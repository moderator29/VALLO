import type { NoticeTopic } from "./model";

/**
 * The words of the reminders screen (FEATURE_BACKLOG A5 and A6). English,
 * plain, no schedule promises (`lib/copy/banned-phrases.ts`).
 */
export const REMINDERS_COPY = {
  title: "Reminders",
  subtitle: "Places near you, people you follow, and gentle nudges",
  idle:
    "None of these reminders are running on your account, so there is nothing to switch off here.",
  saved: "Saved",
  groups: {
    near: "Near you",
    after: "After a move-in",
    nudges: "Gentle nudges",
    elsewhere: "Set on Notifications",
  },
  nudgesNote: "At most one nudge a week, and each kind stops for good after three.",
  rows: {
    new_in_area: {
      label: "New in your area",
      sub: "One note a day when places are listed in areas you joined. Not sent while a saved search alert is on, which already tells you.",
    },
    new_neighbours: {
      label: "New neighbours",
      sub: "People you follow who join one of your areas. One note a day at most.",
    },
    move_in_review: {
      label: "How the new place is going",
      sub: "A month after you move in, we ask once how it went.",
    },
    nudges: {
      label: "Gentle nudges",
      sub: "Small reminders to finish setting up. Off turns them all off.",
    },
    nudge_phone: {
      label: "Confirm your phone",
      sub: "Once you have saved a place or asked for a viewing.",
    },
    nudge_identity: {
      label: "Verify before a long rental",
      sub: "Only before a rental of 5 months or more. Never for stays.",
    },
    nudge_listing_draft: {
      label: "Finish your listing draft",
      sub: "When a draft has sat for a few days.",
    },
    nudge_profile: {
      label: "Add a profile photo",
      sub: "When your profile has no photo after a week.",
    },
  } satisfies Record<NoticeTopic, { label: string; sub: string }>,
  elsewhere: {
    label: "Viewings, check-ins, reviews and price drops",
    sub: "These follow your Bookings and Saved places switches.",
  },
  on: "On",
  off: "Off",
} as const;
