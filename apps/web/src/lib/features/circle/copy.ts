/**
 * The words of Vallo Circle (SW11). The source of truth is now
 * `packages/i18n/src/locales/circle.en.ts`; this re-export keeps every
 * consumer's import unchanged.
 */
import { getDictionary } from "@vallo/i18n";

export const CIRCLE_COPY = getDictionary("en").circle;
export type CircleCopy = typeof CIRCLE_COPY;
