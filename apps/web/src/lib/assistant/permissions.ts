/**
 * THE ASSISTANT'S PERMISSIONS, AND THE TWO DOCUMENTS A MEMBER ACCEPTS.
 *
 * Client-safe: the settings screen, the legal pages and the server layer all
 * read this one list. The database holds the same eight keys (a check
 * constraint on `ai_assistant_permissions`) and the same two version strings
 * (`private.ai_current_versions`); `permissions.test.ts` keeps them equal.
 *
 * READ AND ACT ARE DIFFERENT THINGS. Letting the assistant read transactions
 * does not let it pay for anything: payment help is its own permission, it
 * needs a read permission underneath it, and every payment still needs the
 * member's own confirmation and verification at the moment.
 */

export const AI_PERMISSIONS = [
  "discovery",
  "saved_prefs",
  "bookings_viewings",
  "account_info",
  "transactions",
  "wallet_balance",
  "payment_assist",
  "notifications",
] as const;
export type AiPermission = (typeof AI_PERMISSIONS)[number];

export const AI_TERMS_VERSION = "2026-11-01";
export const AI_PRIVACY_VERSION = "2026-11-01";

export type PermissionMeta = {
  key: AiPermission;
  title: string;
  /** What it lets the assistant do, in one plain sentence. */
  detail: string;
  /** READ: looks at information. ACTS: can start something, with the member's approval. */
  kind: "read" | "act";
  /** Money or identity: granted separately, with the security step. */
  sensitive: boolean;
  /** Always on while the assistant is on; turning it off turns the assistant off. */
  floor?: boolean;
};

export const PERMISSIONS: readonly PermissionMeta[] = [
  {
    key: "discovery",
    title: "Property and stay discovery",
    detail: "Search listings and stays, compare them and explain what is on each page. Uses only what is public on Vallo.",
    kind: "read",
    sensitive: false,
    floor: true,
  },
  {
    key: "saved_prefs",
    title: "Saved properties and what you like",
    detail: "Read what you saved and viewed, and keep a short list of your tastes (areas, budget, style) so it can pick for you. You can review and clear that list.",
    kind: "read",
    sensitive: false,
  },
  {
    key: "bookings_viewings",
    title: "Bookings and viewings",
    detail: "See your bookings and viewing requests, check real viewing times, and propose a viewing or a change for you to approve.",
    kind: "act",
    sensitive: false,
  },
  {
    key: "account_info",
    title: "Your account details",
    detail: "Read your name, area and settings so answers fit you. Never your password, passcode or sign-in codes.",
    kind: "read",
    sensitive: false,
  },
  {
    key: "transactions",
    title: "Transaction history",
    detail: "Read your payments, receipts, refunds and what you have spent. Read only: it cannot move money.",
    kind: "read",
    sensitive: true,
  },
  {
    key: "wallet_balance",
    title: "Wallet balance",
    detail: "Read your Vallo balance and what is pending. Read only: it cannot move money.",
    kind: "read",
    sensitive: true,
  },
  {
    key: "payment_assist",
    title: "Payment help",
    detail: "Prepare a payment summary for something you owe. Nothing is paid until you press Confirm and verify it is you. Needs transaction or booking access first.",
    kind: "act",
    sensitive: true,
  },
  {
    key: "notifications",
    title: "Reminders and updates",
    detail: "Send reminders about viewings and bookings through your normal Vallo notifications.",
    kind: "act",
    sensitive: false,
  },
];

export const SENSITIVE_PERMISSIONS: readonly AiPermission[] = PERMISSIONS.filter((p) => p.sensitive).map((p) => p.key);

export function isAiPermission(value: unknown): value is AiPermission {
  return typeof value === "string" && (AI_PERMISSIONS as readonly string[]).includes(value);
}

export function isSensitivePermission(key: AiPermission): boolean {
  return SENSITIVE_PERMISSIONS.includes(key);
}

/** What an activation may grant on its own. The sensitive ones are always a separate, deliberate step. */
export const ACTIVATION_PERMISSIONS: readonly AiPermission[] = AI_PERMISSIONS.filter((p) => !isSensitivePermission(p));

/** The assistant's state as the database reports it (`ai_assistant_state`). */
export type AssistantAccess = {
  enabled: boolean;
  permissions: readonly AiPermission[];
  epoch: number;
};

export const NO_ACCESS: AssistantAccess = { enabled: false, permissions: [], epoch: 0 };

export function hasPermission(access: AssistantAccess, key: AiPermission): boolean {
  return access.enabled && access.permissions.includes(key);
}

/** The plain words for an audit event, for the activity list. */
export const AUDIT_WORDS: Record<string, string> = {
  activated: "You turned the assistant on",
  deactivated: "The assistant was turned off",
  activate_refused: "Turning it on was refused",
  permission_granted: "You allowed",
  permission_revoked: "You took back",
  permission_refused: "A change was refused",
  preferences_cleared: "You cleared what it learned",
  tool_denied: "It asked for something you had not allowed",
  tool_used: "It looked something up for you",
};
