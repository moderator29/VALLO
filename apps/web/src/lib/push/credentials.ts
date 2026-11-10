import "server-only";
import { CONTACT_EMAIL } from "@/lib/support-email";

/**
 * WHAT THIS DEPLOYMENT CAN ACTUALLY SEND, AND WHO HAS TO SUPPLY THE REST.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL.
 *
 * Three push transports, three completely different credentials, and on the
 * day this was written this repository held NONE of them. That is not a
 * failure of the build; two of the three can only come from accounts the
 * owner holds and nobody else can create. What would be a failure is a queue
 * that quietly fails forever because nothing ever said which key was absent.
 *
 * So every transport asks this module first, the drain turns a missing
 * credential into a NAMED alert on the desk rather than into a retry loop,
 * and `describeCredentials()` answers the question "what is stopping push"
 * in one sentence a person can act on.
 *
 * ---------------------------------------------------------------------------
 * THE THREE, AND WHICH OF THEM COSTS ANYTHING.
 *
 * WEB PUSH needs a VAPID key pair. THIS IS THE ONE THAT NEEDS NOBODY. A VAPID
 * pair is self generated, like an SSH key: no account, no signup, no money,
 * no company involved. `npx web-push generate-vapid-keys` prints both halves
 * in about a second. The private half is a server secret and belongs in the
 * environment; the public half is compiled into the client and is meant to be
 * seen. Because it needs nobody, web push is the transport this build can
 * carry all the way to a real device without waiting for anybody, and it is
 * the one to prove the path with.
 *
 * FIREBASE CLOUD MESSAGING needs a service account JSON from a Firebase
 * project. Free, but it needs a Google account and a project created in a
 * console, so it is the owner's to make and nobody else's. It is required for
 * Android, and a `google-services` JSON file has to be dropped into
 * `android/app/` as well: the credential alone is not enough.
 *
 * APNS needs a `.p8` signing key, a key id and a team id from an Apple
 * Developer account. That account costs 99 USD a year and this repository
 * already records, in `ios/App/App/App.entitlements`, that the owner does not
 * have one yet. Until it exists there is no iOS push, there is no
 * `aps-environment` entitlement that will build, and no amount of code here
 * changes that.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IN THIS FILE EVER RETURNS A SECRET, LOGS ONE, OR PUTS ONE IN AN
 * ALERT. It returns booleans and names of variables. The values are read at
 * the point of use, in the transport, and go straight onto the wire.
 */

/** The three ways a notification can reach a device. */
export type PushTransport = "webpush" | "fcm" | "apns";

export type CredentialStatus = {
  transport: PushTransport;
  configured: boolean;
  /** The environment variables this transport needs that are not set. */
  missing: string[];
  /** Who can supply what is missing, in a sentence fit for a person to read. */
  supplier: string;
};

/** Trimmed, and empty means absent. A variable set to whitespace is not set. */
function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

function present(name: string): boolean {
  return envValue(name).length > 0;
}

/**
 * Web Push, over VAPID. Self generated, so this is the only one of the three
 * that can go from nothing to working without leaving the terminal.
 */
export const VAPID_PUBLIC_KEY_VAR = "NEXT_PUBLIC_VAPID_PUBLIC_KEY";
export const VAPID_PRIVATE_KEY_VAR = "VAPID_PRIVATE_KEY";
export const VAPID_SUBJECT_VAR = "VAPID_SUBJECT";

export function webPushStatus(): CredentialStatus {
  const missing: string[] = [];
  if (!present(VAPID_PUBLIC_KEY_VAR)) missing.push(VAPID_PUBLIC_KEY_VAR);
  if (!present(VAPID_PRIVATE_KEY_VAR)) missing.push(VAPID_PRIVATE_KEY_VAR);
  /* The subject is required by the Web Push specification: it is the contact
     a push service uses when something about our sending is wrong. A
     `mailto:` or an `https:` URL. It has a working default rather than being
     a blocker, because it is not a secret and getting it slightly wrong
     costs an email we would want anyway. */
  return {
    transport: "webpush",
    configured: missing.length === 0,
    missing,
    supplier:
      "Nobody but us. A VAPID pair is self generated with `npx web-push generate-vapid-keys`: no account, no signup, no cost. Public half into NEXT_PUBLIC_VAPID_PUBLIC_KEY, private half into VAPID_PRIVATE_KEY as a server secret.",
  };
}

/** The contact a push service complains to. Never a person's address. */
export function vapidSubject(): string {
  const set = envValue(VAPID_SUBJECT_VAR);
  if (set.length > 0) return set;
  return `mailto:${CONTACT_EMAIL}`;
}

export const FCM_PROJECT_ID_VAR = "FCM_PROJECT_ID";
export const FCM_SERVICE_ACCOUNT_VAR = "FCM_SERVICE_ACCOUNT_JSON";

export function fcmStatus(): CredentialStatus {
  const missing: string[] = [];
  if (!present(FCM_PROJECT_ID_VAR)) missing.push(FCM_PROJECT_ID_VAR);
  if (!present(FCM_SERVICE_ACCOUNT_VAR)) missing.push(FCM_SERVICE_ACCOUNT_VAR);
  return {
    transport: "fcm",
    configured: missing.length === 0,
    missing,
    supplier:
      "The owner. Firebase console, a project, Project settings, Service accounts, Generate new private key. Free, but it needs a Google account and a project only the owner can create. The same project also yields the google-services JSON file, which is dropped into android/app/ and which the Android build needs separately.",
  };
}

export const APNS_KEY_ID_VAR = "APNS_KEY_ID";
export const APNS_TEAM_ID_VAR = "APNS_TEAM_ID";
export const APNS_PRIVATE_KEY_VAR = "APNS_PRIVATE_KEY";
export const APNS_BUNDLE_ID_VAR = "APNS_BUNDLE_ID";

export function apnsStatus(): CredentialStatus {
  const missing: string[] = [];
  if (!present(APNS_KEY_ID_VAR)) missing.push(APNS_KEY_ID_VAR);
  if (!present(APNS_TEAM_ID_VAR)) missing.push(APNS_TEAM_ID_VAR);
  if (!present(APNS_PRIVATE_KEY_VAR)) missing.push(APNS_PRIVATE_KEY_VAR);
  /* The bundle id is not a secret and this repository already knows it, so a
     missing variable is not a blocker: `capacitor.config.ts` fixes it as
     `com.vallospaces.app` and calls that string permanent. */
  return {
    transport: "apns",
    configured: missing.length === 0,
    missing,
    supplier:
      "The owner, and it costs money. An Apple Developer Program membership at 99 USD a year, then Certificates Identifiers and Profiles, Keys, a new key with Apple Push Notifications service enabled. The .p8 downloads exactly once. ios/App/App/App.entitlements already records that this account does not exist yet.",
  };
}

/** The bundle identifier APNs addresses, which is fixed by capacitor.config.ts. */
export function apnsBundleId(): string {
  return envValue(APNS_BUNDLE_ID_VAR) || "com.vallospaces.app";
}

/**
 * Is this APNs key for the production gateway or the sandbox one?
 *
 * A build signed with a development provisioning profile gets a SANDBOX
 * device token, and a sandbox token sent to the production gateway comes back
 * 400 BadDeviceToken. That single mismatch is the most common reason an
 * otherwise correct iOS push implementation appears to be broken, so it is a
 * named variable rather than a guess, and it defaults to sandbox because a
 * wrong guess in that direction fails during development where somebody is
 * watching rather than in production where nobody is.
 */
export function apnsUseProductionGateway(): boolean {
  return envValue("APNS_PRODUCTION") === "true";
}

export function credentialStatuses(): CredentialStatus[] {
  return [webPushStatus(), fcmStatus(), apnsStatus()];
}

/** Every transport that is ready to carry a notification right now. */
export function configuredTransports(): PushTransport[] {
  return credentialStatuses()
    .filter((status) => status.configured)
    .map((status) => status.transport);
}

/**
 * One line per transport, safe to print, safe to put in an alert.
 *
 * Variable NAMES only. This is the sentence somebody reads when they ask why
 * push is not working, so it says what is missing and who can supply it, and
 * it never says what any value is.
 */
export function describeCredentials(): string[] {
  return credentialStatuses().map((status) =>
    status.configured
      ? `${status.transport}: configured.`
      : `${status.transport}: NOT configured, missing ${status.missing.join(", ")}. ${status.supplier}`,
  );
}

/**
 * Which platforms there is any point reading tokens for.
 *
 * The drain asks this before it claims anything. A deployment with no
 * credentials at all should not be claiming rows, attempting sends and
 * burning attempts against a wall; it should say, once, on the desk, that
 * there are no credentials, and leave the queue alone so that the day a key
 * arrives everything waiting is still there to send.
 */
export function deliverablePlatforms(): Array<"web" | "ios" | "android"> {
  const out: Array<"web" | "ios" | "android"> = [];
  if (webPushStatus().configured) out.push("web");
  if (fcmStatus().configured) out.push("android");
  if (apnsStatus().configured) out.push("ios");
  return out;
}
