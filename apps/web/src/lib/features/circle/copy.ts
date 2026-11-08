/**
 * The words of Vallo Circle (SW11). The source of truth is now
 * `packages/i18n/src/locales/circle.en.ts`; this re-export keeps every
 * consumer's import unchanged.
 */
import { circleEn } from "@vallo/i18n/en/circle";

export const CIRCLE_COPY = circleEn;
export type CircleCopy = typeof CIRCLE_COPY;
