/**
 * THE THREAD'S OWN LIMITS, for what is typed and what is pasted alike.
 *
 * `THREAD_TEXT_LIMIT` is the longest message the server accepts
 * (`MAX_MESSAGE_LENGTH` in `lib/messages/schema.ts`; `thread-paste.test.ts`
 * holds the two together, so this file stays free of the schema's imports).
 * `MAX_PENDING_PHOTOS` is how many photos one Send carries: one picked, or
 * several pasted at once.
 */
export const THREAD_TEXT_LIMIT = 2000;
export const MAX_PENDING_PHOTOS = 6;
