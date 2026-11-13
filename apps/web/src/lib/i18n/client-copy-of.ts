import type { Dictionary } from "@vallo/i18n/core";

/** The auth screens' lines that client code draws. */
const AUTH_FLOW_KEYS = [
  "appleFailed",
  "appleUnfinished",
  "backHome",
  "errorBody",
  "errorTitle",
  "reference",
  "tryAgain",
  "offlineTitle",
  "offlineBody",
  "weakTitle",
  "weakBody",
  "alreadyConfirmed",
  "codeStillWorks",
  "enterCodeInstead",
  "expiredLink",
  "invalidLink",
  "linkFailedTitle",
  "providerOff",
  "signInWithEmail",
  "signInWithYourEmail",
  "unconfigured",
  "noScriptSignIn",
  "noScriptSignUp",
  "signingInBody",
  "signingInTitle",
  "verifyingBody",
  "verifyingTitle",
] as const;

/**
 * What the root layout hands to client code through `ClientCopyProvider`
 * (`client-copy.tsx` says why). Kept to the words the client components on
 * the main routes actually read, because every page carries a copy (about
 * 7 KB; `core-entry.test.ts` holds it under 12):
 *
 *   common                     the back button, the page header
 *   a11y                       accessible names (the gallery)
 *   platform.outbox            the offline tray, save, the composer, viewings
 *   platform.inflight          the offline tray
 *   trustVisible.state         the in-app error screen
 *   trustVisible.report        the report sheet
 *   trustVisible.phone         the phone gate's button (`PhoneGateLink`), drawn
 *     (requiredAction only)    beside any gated action's refusal
 *   counts, reserve            the listing page's booking bar and panel
 *   uiCommon.around, .inbox    a post's place line, the inbox tabs
 *   feedV2.card, .composer     a post card's words, the post and story composers
 *   authFlow (the keys below)  Apple sign-in, the auth error, the verify screens
 *   catalogue.card             the listing gallery's empty frame
 *   frontDoor.share            the listing page's share control
 *   offPlatform                the sheet before a link leaves Vallo
 *   details                    the toast, copy, connection line, pull to
 *                              refresh, back to top, the card menu
 *   socialProfile.accountPage  the profile's hero and rows
 *   fixesV2.offline, weakSignal the error boundaries' calm offline and weak-signal words
 *   success (chrome, and the   the success sheet's own words, and only the
 *   moments below)             moments whose components have no server
 *                              parent to hand them copy: the account moments
 *                              the root layout's host shows, a report, a
 *                              support ticket and an inspection request. Every
 *                              other moment's words come from its page, so the
 *                              ~5 KB of them are not carried by every screen.
 *
 * A server-side function, not part of the client module, so the root layout
 * can call it.
 */
export type ClientCopy = {
  common: Dictionary["common"];
  a11y: Dictionary["a11y"];
  platform: Pick<Dictionary["platform"], "outbox" | "inflight">;
  trustVisible: Pick<Dictionary["trustVisible"], "state" | "report"> & {
    phone: Pick<Dictionary["trustVisible"]["phone"], "requiredAction">;
  };
  counts: Dictionary["counts"];
  reserve: Dictionary["reserve"];
  uiCommon: Pick<Dictionary["uiCommon"], "around" | "inbox">;
  feedV2: Pick<Dictionary["feedV2"], "card" | "composer">;
  authFlow: Pick<Dictionary["authFlow"], (typeof AUTH_FLOW_KEYS)[number]>;
  catalogue: Pick<Dictionary["catalogue"], "card">;
  frontDoor: Pick<Dictionary["frontDoor"], "share">;
  offPlatform: Dictionary["offPlatform"];
  details: Dictionary["details"];
  socialProfile: Pick<Dictionary["socialProfile"], "accountPage">;
  /** The error boundaries' calm offline words. */
  fixesV2: Pick<Dictionary["fixesV2"], "offline" | "weakSignal">;
  success: Pick<Dictionary["success"], "continue" | "close" | "detail"> & {
    moments: Pick<Dictionary["success"]["moments"], (typeof SLICED_MOMENTS)[number]>;
  };
};

/** The success moments carried on every screen. Keep this list short. */
const SLICED_MOMENTS = [
  "accountCreated",
  "signedIn",
  "signedOut",
  "photoAdded",
  "checkEmail",
  "emailVerified",
  "passwordChanged",
  "passcodeSet",
  "passcodeChanged",
  "inspectionRequested",
  "reportFiled",
  "ticketFiled",
  "contactSent",
] as const;

export function clientCopyOf(t: Dictionary): ClientCopy {
  return {
    common: t.common,
    a11y: t.a11y,
    platform: { outbox: t.platform.outbox, inflight: t.platform.inflight },
    trustVisible: {
      state: t.trustVisible.state,
      report: t.trustVisible.report,
      phone: { requiredAction: t.trustVisible.phone.requiredAction },
    },
    counts: t.counts,
    reserve: t.reserve,
    uiCommon: { around: t.uiCommon.around, inbox: t.uiCommon.inbox },
    feedV2: { card: t.feedV2.card, composer: t.feedV2.composer },
    authFlow: Object.fromEntries(
      AUTH_FLOW_KEYS.map((key) => [key, t.authFlow[key]])
    ) as ClientCopy["authFlow"],
    catalogue: { card: t.catalogue.card },
    frontDoor: { share: t.frontDoor.share },
    offPlatform: t.offPlatform,
    details: t.details,
    socialProfile: { accountPage: t.socialProfile.accountPage },
    fixesV2: { offline: t.fixesV2.offline, weakSignal: t.fixesV2.weakSignal },
    success: {
      continue: t.success.continue,
      close: t.success.close,
      detail: t.success.detail,
      moments: Object.fromEntries(
        SLICED_MOMENTS.map((key) => [key, t.success.moments[key]])
      ) as ClientCopy["success"]["moments"],
    },
  };
}
