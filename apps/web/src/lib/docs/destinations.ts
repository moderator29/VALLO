import type { UiIconName } from "@/design-system/icons/UiIcon";
import { offersHref, offersTabHref } from "@/lib/offers/routes";

/**
 * EVERY PLACE A DOCUMENT BUTTON CAN TAKE A READER, in one list.
 *
 * A document never types a path into a button. It names a destination from
 * here, and `coverage.test.ts` checks that every `href` below is a route that
 * exists in the app. A button into a screen that was renamed or removed
 * therefore fails the build instead of reaching a reader as a dead end.
 *
 * `needs`:
 *   none      anyone can open it
 *   account   a signed-in account is needed. A signed-out reader is sent to
 *             sign in, carrying the destination, and arrives there after.
 *   identity  as `account`, and the button also knows where the reader's
 *             identity document stands: if it is already approved it says so
 *             instead of pretending there is work to do.
 *
 * `explain` is the one sentence shown beside a button when the reader cannot
 * use it yet, so a button never fails silently.
 */
export type DocDestination = {
  label: string;
  href: string;
  needs: "none" | "account" | "identity";
  icon?: UiIconName;
  explain: string;
};

export const DOC_DESTINATIONS = {
  "start-verification": {
    label: "Start verification",
    href: "/verification",
    needs: "identity",
    icon: "shield-check",
    explain: "Verification needs an account, so you will be asked to sign in first and then taken straight there.",
  },
  "search-homes": {
    label: "Search homes",
    href: "/search",
    needs: "none",
    icon: "search",
    explain: "Anyone can search. You only need an account to save, message or act.",
  },
  "search-stays": {
    label: "Find a stay",
    href: "/stays",
    needs: "none",
    icon: "building-hotel",
    explain: "Anyone can browse stays. You need an account to book.",
  },
  restaurants: {
    label: "Find a restaurant",
    href: "/restaurants",
    needs: "none",
    icon: "utensils",
    explain: "Anyone can browse restaurants. You need an account to book a table.",
  },
  "make-offer": {
    label: "Make an offer",
    href: "/search",
    needs: "none",
    icon: "hand-coins",
    explain:
      "An offer is made on one home for sale, so this opens search. Choose a home for sale and use Make an offer on its page.",
  },
  "open-offers": {
    label: "Open my offers",
    href: offersHref,
    needs: "account",
    icon: "file-check",
    explain: "Your offers are part of your account, so you will be asked to sign in first.",
  },
  "open-offers-received": {
    label: "Open offers received",
    href: offersTabHref("received"),
    needs: "account",
    icon: "file-check",
    explain: "Offers you have received are part of your account, so you will be asked to sign in first.",
  },
  "open-deal-room": {
    label: "Open the Deal Room",
    href: offersHref,
    needs: "account",
    icon: "key",
    explain: "Each offer has its own Deal Room. Open it from My offers. You will be asked to sign in first.",
  },
  "open-bookings": {
    label: "Open my bookings",
    href: "/bookings",
    needs: "account",
    icon: "calendar-booking",
    explain: "Your bookings live in your account, so you will be asked to sign in first.",
  },
  "open-agreements": {
    label: "Open my agreements",
    href: "/agreements",
    needs: "account",
    icon: "file-check",
    explain: "Agreements are shared with the other person in your account, so you will be asked to sign in first.",
  },
  "open-messages": {
    label: "Open messages",
    href: "/messages",
    needs: "account",
    icon: "chat-bubble",
    explain: "Messages are private to your account, so you will be asked to sign in first.",
  },
  "open-wallet": {
    label: "Open my wallet",
    href: "/wallet",
    needs: "account",
    icon: "wallet",
    explain: "Your wallet is part of your account, so you will be asked to sign in first.",
  },
  "open-payouts": {
    label: "Open payouts",
    href: "/payouts",
    needs: "account",
    icon: "banknote",
    explain: "Payouts are for listers and hosts and live in your account, so you will be asked to sign in first.",
  },
  "open-receipts": {
    label: "Open my receipts",
    href: "/receipts",
    needs: "account",
    icon: "receipt",
    explain: "Receipts live in your account, so you will be asked to sign in first.",
  },
  "open-refunds": {
    label: "Open my refunds",
    href: "/refunds",
    needs: "account",
    icon: "history",
    explain: "Refunds live in your account, so you will be asked to sign in first.",
  },
  "open-saved": {
    label: "Open saved",
    href: "/saved",
    needs: "account",
    icon: "bookmark",
    explain: "Saved places live in your account, so you will be asked to sign in first.",
  },
  "open-notifications": {
    label: "Open notifications",
    href: "/notifications",
    needs: "account",
    icon: "bell",
    explain: "Notifications are private to your account, so you will be asked to sign in first.",
  },
  "open-settings": {
    label: "Open settings",
    href: "/settings",
    needs: "account",
    icon: "settings-gear",
    explain: "Settings belong to your account, so you will be asked to sign in first.",
  },
  "privacy-choices": {
    label: "Open privacy choices",
    href: "/settings/privacy",
    needs: "account",
    icon: "shield-lock",
    explain: "Privacy choices belong to your account, so you will be asked to sign in first.",
  },
  "open-profile": {
    label: "Open my profile",
    href: "/profile",
    needs: "account",
    icon: "user-check",
    explain: "Your profile is part of your account, so you will be asked to sign in first.",
  },
  "ask-support": {
    label: "Ask the support desk",
    href: "/support/new",
    needs: "account",
    icon: "headset",
    explain: "A ticket needs an account so we can reply. Signed out, use the contact form instead.",
  },
  "contact-form": {
    label: "Open the contact form",
    href: "/contact",
    needs: "none",
    icon: "mail",
    explain: "Anyone can write to us. A person answers within one business day.",
  },
  "open-assistant": {
    label: "Ask the assistant",
    href: "/assistant",
    needs: "account",
    icon: "bot",
    explain: "The assistant is part of your account, so you will be asked to sign in first.",
  },
  "start-hosting": {
    label: "Start hosting",
    href: "/host/start",
    needs: "account",
    icon: "key",
    explain: "Hosting is set up from your account, so you will be asked to sign in first.",
  },
  "list-property": {
    label: "List a property",
    href: "/agent/list",
    needs: "account",
    icon: "house",
    explain: "Listing needs an account and an agent or owner profile, so you will be asked to sign in first.",
  },
  "open-roommates": {
    label: "Open Roommates",
    href: "/roommates",
    needs: "account",
    icon: "users",
    explain: "Roommates is part of your account, so you will be asked to sign in first.",
  },
  "open-circle": {
    label: "Open Circle",
    href: "/circle",
    needs: "account",
    icon: "circle-people",
    explain: "Circle is part of your account, so you will be asked to sign in first.",
  },
  "open-around": {
    label: "Open Around",
    href: "/around",
    needs: "none",
    icon: "feed",
    explain: "Anyone can read Around. You need an account to post or react.",
  },
  "open-rewards": {
    label: "Open rewards",
    href: "/rewards",
    needs: "account",
    icon: "gift",
    explain: "Rewards belong to your account, so you will be asked to sign in first.",
  },
  "price-check": {
    label: "Check a price",
    href: "/price",
    needs: "none",
    icon: "price-tag",
    explain: "Anyone can check a price.",
  },
  "move-in-cost": {
    label: "Work out move-in cost",
    href: "/move-in-cost",
    needs: "none",
    icon: "coins",
    explain: "Anyone can use the move-in calculator.",
  },
  "open-compare": {
    label: "Compare saved places",
    href: "/compare",
    needs: "none",
    icon: "scale",
    explain: "Compare works on places you have saved on this device or in your account.",
  },
  "sign-up": {
    label: "Create an account",
    href: "/sign-up",
    needs: "none",
    icon: "user-pen",
    explain: "Creating an account is free.",
  },
  "report-safety": {
    label: "Read the safety centre",
    href: "/safety",
    needs: "none",
    icon: "shield-check",
    explain: "Anyone can read the safety centre.",
  },
} as const satisfies Record<string, DocDestination>;

export type DocDestinationId = keyof typeof DOC_DESTINATIONS;

export function destinationFor(id: DocDestinationId): DocDestination {
  return DOC_DESTINATIONS[id];
}
