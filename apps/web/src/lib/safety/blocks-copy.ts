/**
 * The words a person reads before they block somebody.
 *
 * SW11: source of truth is now `packages/i18n/src/locales/safety.en.ts`.
 */
import { getDictionary } from "@vallo/i18n";
export const BLOCK_CONFIRM_COPY = getDictionary("en").safety.blocks.blockConfirm;
