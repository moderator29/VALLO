import type { NoticeTopic } from "./model";
import { getDictionary } from "@vallo/i18n";

/**
 * The words of the reminders screen (SW11). The source of truth is now
 * `packages/i18n/src/locales/reminders.en.ts`; this re-export keeps every
 * consumer's import unchanged and applies the `satisfies` that checks the
 * rows against `NoticeTopic`.
 */
const _r = getDictionary("en").reminders;
export const REMINDERS_COPY = {
  ..._r,
  rows: _r.rows satisfies Record<NoticeTopic, { label: string; sub: string }>,
} as const;
