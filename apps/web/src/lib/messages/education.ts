/**
 * The in-chat safety education moment. Client-safe module: no server imports.
 *
 * The first time a draft in a session drifts towards money talk, the composer
 * shows the canonical safety copy (docs/HYBRID_INVENTORY.md section 6) once,
 * inline and dismissible. The wording is owner canon and must not be edited.
 */

/** Draft patterns that surface the safety card. */
export const MONEY_TALK_RE = /\b(pay|payment|transfer|account|acct|bank)\b/i;

/** SW11: source of truth is now `packages/i18n/src/locales/safety.en.ts`. */
import { getDictionary } from "@vallo/i18n";
export const SAFETY_EDUCATION_COPY = getDictionary("en").safety.education;

/** Session storage key: the card shows once per browsing session. */
export const SAFETY_EDUCATION_SEEN_KEY = "nf_money_edu_seen";
