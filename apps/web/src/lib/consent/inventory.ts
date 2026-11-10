/**
 * EVERYTHING VALLO STORES ON A DEVICE, AS DATA (founder, 10 November 2026).
 *
 * ONE SOURCE OF TRUTH. The Cookies page (`/cookies`) draws its table from this
 * list, the choice sheet counts from it, and withdrawing a choice clears the
 * items it names. A cookie or storage key that the code writes and this list
 * does not name fails `inventory.test.ts`, so the page cannot drift from the
 * app.
 *
 * Found by reading the code for `document.cookie`, `cookies().set`,
 * `localStorage`, `sessionStorage` and the service worker's caches on
 * 10 November 2026. Every item is first party: Vallo sets it, and the only
 * other party named is Supabase, our sign-in provider, whose cookie carries
 * your session. There is no advertising storage and no third-party analytics.
 *
 * THE THREE KINDS, STRICTLY:
 *
 *   necessary    Needed for something you asked for or to keep the service
 *                working: signing in, your language and theme, the places you
 *                saved, a draft you were typing, the offline queue, a record
 *                of your cookie choice. Always on. Includes small "you have
 *                seen this tip" marks, which stop a tip repeating.
 *   preferences  Things Vallo remembers on its own initiative to be
 *                convenient: recent searches, recently viewed listings, the
 *                search view you used last, when you last visited. Off until
 *                you agree; withdrawing clears them.
 *   analytics    Simple first-party counts of how people move through the
 *                product, and the link a visit came from so the person who
 *                shared it is credited. Off until you agree. No third party.
 *
 * Whether the necessary ones need consent at all is a question for counsel
 * (docs/handoff/COUNSEL_BRIEF.md section 2.3).
 *
 * Client-safe: plain data and pure functions.
 */

export type StorageCategory = "necessary" | "preferences" | "analytics";
export type StorageKind = "cookie" | "localStorage" | "sessionStorage" | "cache";

export type StorageItem = {
  id: string;
  /** The name as the browser shows it. A trailing `*` stands for a changing ending. */
  name: string;
  kind: StorageKind;
  category: StorageCategory;
  /** What it is for, in plain words. */
  purpose: string;
  /** How long it lasts. */
  lifetime: string;
  /** Who sets it. */
  setBy?: "Vallo" | "Supabase";
};

const YEAR = "1 year";
const SESSION = "Until you close the browser tab";
const DEVICE = "Until you clear it, or sign out and clear this device";

export const STORAGE_INVENTORY: readonly StorageItem[] = [
  /* ------------------------------------------------------------ necessary */
  { id: "consent", name: "vallo_consent", kind: "cookie", category: "necessary", purpose: "Remembers the cookie choice you made here, and which version of this notice you saw.", lifetime: YEAR },
  { id: "session", name: "sb-*-auth-token*", kind: "cookie", category: "necessary", purpose: "Keeps you signed in. Set by our sign-in provider.", lifetime: "While you stay signed in, up to about 13 months", setBy: "Supabase" },
  { id: "locale", name: "nf_locale", kind: "cookie", category: "necessary", purpose: "Remembers the language you chose.", lifetime: YEAR },
  { id: "theme", name: "nf_theme", kind: "cookie", category: "necessary", purpose: "Remembers light, dark or system, so the page draws in your theme straight away.", lifetime: YEAR },
  { id: "settings", name: "nf_settings", kind: "localStorage", category: "necessary", purpose: "Your display and notification choices on this device.", lifetime: DEVICE },
  { id: "motion", name: "nf_motion", kind: "cookie", category: "necessary", purpose: "Remembers if you asked for less motion.", lifetime: YEAR },
  { id: "motion-local", name: "nf_reduce_motion", kind: "localStorage", category: "necessary", purpose: "The same less-motion choice, kept on the device.", lifetime: DEVICE },
  { id: "lite", name: "vallo_lite", kind: "cookie", category: "necessary", purpose: "Remembers your data-saver choice, so pages arrive lighter.", lifetime: "About 13 months" },
  { id: "meter", name: "vallo_data_meter", kind: "localStorage", category: "necessary", purpose: "Counts the data Vallo used on this device this week, for the data-saver screen. Never sent anywhere.", lifetime: "The last 8 days" },
  { id: "side", name: "nf_side", kind: "cookie", category: "necessary", purpose: "Remembers which side of Vallo you last used, Property or Stays.", lifetime: YEAR },
  { id: "mode", name: "nf_mode", kind: "cookie", category: "necessary", purpose: "Remembers if you last used Vallo as a member or in a work mode.", lifetime: YEAR },
  { id: "workspace", name: "nf_workspace", kind: "cookie", category: "necessary", purpose: "Remembers which of your workspaces you last opened.", lifetime: YEAR },
  { id: "pro-view", name: "vallo_pro_view", kind: "cookie", category: "necessary", purpose: "Remembers if you switched the Pro view on.", lifetime: "About 13 months" },
  { id: "saved-cookie", name: "nf_saved", kind: "cookie", category: "necessary", purpose: "Places you saved before signing in, so they are still there after you sign up.", lifetime: YEAR },
  { id: "saved-local", name: "nf_saved", kind: "localStorage", category: "necessary", purpose: "The same saved places, kept on the device.", lifetime: DEVICE },
  { id: "unlock", name: "vallo_unlock", kind: "cookie", category: "necessary", purpose: "Shows that you unlocked Vallo with your passcode or Face ID on this device.", lifetime: "A short time, set by you in Settings" },
  { id: "unlock-reset", name: "vallo_passcode_reset", kind: "cookie", category: "necessary", purpose: "Lets you finish resetting your passcode after you proved it is you.", lifetime: "A few minutes" },
  { id: "passcode-offer", name: "vallo_pc_offer", kind: "cookie", category: "necessary", purpose: "Remembers that you chose not to set a passcode yet, so we do not ask again straight away.", lifetime: "A few days" },
  { id: "passcode-tab", name: "vallo.passcode.tab", kind: "sessionStorage", category: "necessary", purpose: "Keeps the passcode lock tied to this tab.", lifetime: SESSION },
  { id: "passcode-idle", name: "vallo.passcode.idle15.v1", kind: "localStorage", category: "necessary", purpose: "Your choice of how long Vallo waits before it locks.", lifetime: DEVICE },
  { id: "passcode-local", name: "nf_pc_local", kind: "localStorage", category: "necessary", purpose: "Your passcode settings on this device. The passcode itself is never stored in the browser.", lifetime: DEVICE },
  { id: "bio-offer", name: "vallo.bio-offer", kind: "localStorage", category: "necessary", purpose: "Remembers that you were offered Face ID or fingerprint unlock.", lifetime: DEVICE },
  { id: "ai-consent", name: "vallo_ai_consent", kind: "cookie", category: "necessary", purpose: "Records that you agreed to how the AI assistant works. Nothing is sent to it without this.", lifetime: YEAR },
  { id: "ai-threads", name: "nf_ai_thread*", kind: "localStorage", category: "necessary", purpose: "Your assistant conversations, kept on this device so you can pick them up.", lifetime: DEVICE },
  { id: "ai-prefs", name: "nf_ai_prefs", kind: "localStorage", category: "necessary", purpose: "Your assistant settings on this device.", lifetime: DEVICE },
  { id: "ai-handoff", name: "nf_ai_handoff", kind: "sessionStorage", category: "necessary", purpose: "Carries your question from one screen to the assistant.", lifetime: SESSION },
  { id: "support-thread", name: "nf_support_*", kind: "localStorage", category: "necessary", purpose: "Your support chat and the message you were typing, so you do not lose it.", lifetime: DEVICE },
  { id: "drafts", name: "nf_agent_application_draft", kind: "localStorage", category: "necessary", purpose: "An application you were filling in, so you can come back to it.", lifetime: DEVICE },
  { id: "host-draft", name: "nf_host_draft", kind: "localStorage", category: "necessary", purpose: "A host set-up you were filling in.", lifetime: DEVICE },
  { id: "broadcast-draft", name: "vallo_broadcast_unconfirmed*", kind: "localStorage", category: "necessary", purpose: "A listing broadcast you started and did not confirm.", lifetime: DEVICE },
  { id: "signup-draft", name: "vallo_signup_draft", kind: "sessionStorage", category: "necessary", purpose: "Your sign-up answers while you finish, so a refresh does not lose them.", lifetime: SESSION },
  { id: "pending-email", name: "nf_pending_email", kind: "cookie", category: "necessary", purpose: "Remembers the email you are confirming while you open the link or enter the code.", lifetime: "30 minutes" },
  { id: "chooser-email", name: "nf_chooser_email", kind: "cookie", category: "necessary", purpose: "Remembers the email you used when choosing how to sign in.", lifetime: "10 minutes" },
  { id: "admin-entry", name: "nf_admin_entry", kind: "cookie", category: "necessary", purpose: "Staff only: marks that a staff member entered the console on purpose.", lifetime: SESSION },
  { id: "success", name: "nf_done", kind: "cookie", category: "necessary", purpose: "Carries the confirmation of something you just did, such as a request sent, to the next screen.", lifetime: "A few minutes" },
  { id: "success-hint", name: "nf_done_hint", kind: "cookie", category: "necessary", purpose: "Tells the next screen to look for that confirmation.", lifetime: "A few minutes" },
  { id: "verification-seen", name: "nf_vpass", kind: "cookie", category: "necessary", purpose: "Remembers that you saw the message after a verification step, so it is not repeated.", lifetime: "15 days" },
  { id: "tips-seen", name: "vallo_feature_runs", kind: "cookie", category: "necessary", purpose: "Remembers which first-time tips you have seen, so they do not repeat.", lifetime: "About 13 months" },
  { id: "first-run", name: "vallo_first_run", kind: "cookie", category: "necessary", purpose: "Remembers that you saw the welcome cards, for the length of the first visit.", lifetime: "30 minutes" },
  { id: "first-interest", name: "vallo_first_interest", kind: "cookie", category: "necessary", purpose: "Carries the interest you picked at welcome to your first screen.", lifetime: "1 day" },
  { id: "setup-skip", name: "vallo_setup_skip", kind: "cookie", category: "necessary", purpose: "Remembers that you chose to finish your profile later, so the sheet is not shown again straight away.", lifetime: "A few days" },
  { id: "setup-shown", name: "vallo_setup_shown", kind: "cookie", category: "necessary", purpose: "Remembers that the profile set-up sheet was shown on this device.", lifetime: "A few days" },
  { id: "invite-seen", name: "vallo_invite_seen", kind: "cookie", category: "necessary", purpose: "Remembers that you saw your invite code, so the reminder is not repeated.", lifetime: YEAR },
  { id: "invite", name: "vallo_invite", kind: "cookie", category: "necessary", purpose: "Holds the invite code from the link you followed until you sign up, so the person who invited you is credited.", lifetime: "Until you sign up, or it expires" },
  { id: "seen-marks", name: "nf-seen:*", kind: "localStorage", category: "necessary", purpose: "Remembers that you have seen a notice or a confirmation, so it is not repeated.", lifetime: DEVICE },
  { id: "stories-seen", name: "nf_seen_stories:*", kind: "localStorage", category: "necessary", purpose: "Which stories you have already watched, so the ring updates.", lifetime: DEVICE },
  { id: "push-device", name: "vallo.push.device.v1", kind: "localStorage", category: "necessary", purpose: "Whether notifications are on for this device.", lifetime: DEVICE },
  { id: "push-prompt", name: "vallo.push.prompt", kind: "localStorage", category: "necessary", purpose: "Remembers that you answered the notification question, so it is not asked again.", lifetime: DEVICE },
  { id: "widget", name: "vallo.widget.handed", kind: "localStorage", category: "necessary", purpose: "Remembers that the home-screen widget was set up.", lifetime: DEVICE },
  { id: "inflight", name: "vallo.inflight", kind: "localStorage", category: "necessary", purpose: "Keeps track of something you sent while the connection was weak, so it is not sent twice.", lifetime: "Until it is confirmed" },
  { id: "outbox", name: "vallo.outbox.*", kind: "localStorage", category: "necessary", purpose: "Messages and actions waiting to be sent when you are back online.", lifetime: "Until they are sent" },
  { id: "weak", name: "nf_weak_retry", kind: "sessionStorage", category: "necessary", purpose: "Counts retries on a weak connection, so the page does not loop.", lifetime: SESSION },
  { id: "deploy", name: "vallo-deploy-reload", kind: "sessionStorage", category: "necessary", purpose: "Stops the page reloading more than once when Vallo has just been updated.", lifetime: SESSION },
  { id: "history", name: "nf_history_seq", kind: "sessionStorage", category: "necessary", purpose: "Keeps the Back button going where you expect inside the app.", lifetime: SESSION },
  { id: "scroll", name: "nf_scroll_positions", kind: "sessionStorage", category: "necessary", purpose: "Remembers where you were on a page, so Back returns you there.", lifetime: SESSION },
  { id: "launch", name: "nf_launch", kind: "sessionStorage", category: "necessary", purpose: "Plays the opening animation once per visit.", lifetime: SESSION },
  { id: "entered", name: "nf_entered", kind: "sessionStorage", category: "necessary", purpose: "Remembers that you passed the opening screen on this visit.", lifetime: SESSION },
  { id: "intro", name: "nf-intro", kind: "sessionStorage", category: "necessary", purpose: "Plays the home page introduction once per visit.", lifetime: SESSION },
  { id: "open", name: "nf_open", kind: "sessionStorage", category: "necessary", purpose: "Remembers that the app has already opened on this visit.", lifetime: SESSION },
  { id: "boot-trace", name: "nf_boot_trace", kind: "sessionStorage", category: "necessary", purpose: "Helps us find why an app start was slow or failed. Not sent unless it crashes.", lifetime: SESSION },
  { id: "native-crash", name: "nf_native_crash", kind: "localStorage", category: "necessary", purpose: "A crash note from the app, kept until it can be reported.", lifetime: "Until it is reported" },
  { id: "safety-edu", name: "nf_money_edu_seen", kind: "sessionStorage", category: "necessary", purpose: "Remembers you saw the safety reminder about paying inside Vallo.", lifetime: SESSION },
  { id: "inspections", name: "nf_inspections", kind: "localStorage", category: "necessary", purpose: "Inspection requests you made from a conversation, on this device.", lifetime: DEVICE },
  { id: "device-identity", name: "nf_profile_*", kind: "localStorage", category: "necessary", purpose: "Your name and email as shown on this device, so the app can greet you before it has loaded your account.", lifetime: DEVICE },
  { id: "member-since", name: "nf_member_since", kind: "localStorage", category: "necessary", purpose: "The date you joined, shown on your profile on this device.", lifetime: DEVICE },
  { id: "read", name: "nf_messages_read", kind: "localStorage", category: "necessary", purpose: "Which messages you have read on this device.", lifetime: DEVICE },
  { id: "rail", name: "nf-rail-collapsed", kind: "localStorage", category: "necessary", purpose: "Whether you folded the side menu.", lifetime: DEVICE },
  { id: "side-flip", name: "nf_side_flipped", kind: "localStorage", category: "necessary", purpose: "Remembers you tried switching sides, so the hint is not repeated.", lifetime: DEVICE },
  { id: "offline-caches", name: "vallo-*", kind: "cache", category: "necessary", purpose: "Pages and images saved by the service worker so Vallo opens on a weak connection, and the offline outbox.", lifetime: "Until Vallo updates, or you clear site data" },
  /* ----------------------------------------------------------- preferences */
  { id: "recent-searches", name: "nf_recent_searches", kind: "localStorage", category: "preferences", purpose: "Your last few searches, as shortcuts.", lifetime: DEVICE },
  { id: "recent-listings", name: "nf_recent_listings", kind: "localStorage", category: "preferences", purpose: "The listings you last looked at, as a Recently viewed row.", lifetime: DEVICE },
  { id: "view", name: "nf_view", kind: "cookie", category: "preferences", purpose: "The way you last viewed search results, list or map.", lifetime: YEAR },
  { id: "shelf-visit", name: "vallo_shelf_last_visit", kind: "localStorage", category: "preferences", purpose: "When you last looked at the shelf, to mark what is new since.", lifetime: DEVICE },
  { id: "saved-visit", name: "vallo_saved_last_visit", kind: "localStorage", category: "preferences", purpose: "When you last opened Saved, to mark what changed since.", lifetime: DEVICE },
  /* ------------------------------------------------------------- analytics */
  { id: "visit", name: "nf_visit", kind: "cookie", category: "analytics", purpose: "A random visit number, so sign-up steps are counted once per visit. No name, no account and no third party.", lifetime: SESSION },
  { id: "first-touch", name: "vallo_via", kind: "cookie", category: "analytics", purpose: "Which shared listing link you opened first, so the person who shared it is credited if you message about that listing.", lifetime: "14 days" },
] as const;

export const CATEGORY_ORDER: readonly StorageCategory[] = ["necessary", "preferences", "analytics"];

export const CATEGORY_LABEL: Record<StorageCategory, string> = {
  necessary: "Necessary",
  preferences: "Preferences",
  analytics: "Usage counts",
};

export const KIND_LABEL: Record<StorageKind, string> = {
  cookie: "Cookie",
  localStorage: "Device storage",
  sessionStorage: "Tab storage",
  cache: "Offline cache",
};

export function itemsIn(category: StorageCategory): StorageItem[] {
  return STORAGE_INVENTORY.filter((item) => item.category === category);
}

/** Does a stored name belong to this item? A trailing `*` matches any ending. */
export function nameMatches(item: StorageItem, name: string): boolean {
  return item.name.endsWith("*") ? name.startsWith(item.name.slice(0, -1)) : item.name === name;
}

/** Every item that could hold this name (a name can be both a cookie and a storage key). */
export function itemsNamed(name: string): StorageItem[] {
  return STORAGE_INVENTORY.filter((item) => nameMatches(item, name));
}
