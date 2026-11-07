import { z } from "zod";
import { REACTION_EMOJI } from "./reactions";
import { VOICE_SERVER_MAX_MS } from "./voice-note";

/**
 * Messaging input schemas.
 *
 * Every write into the messaging loop is validated here, on the server, before
 * any database work happens. Identifiers are UUIDs except the listing id in
 * startConversation, which may arrive as a seed catalogue id; the action
 * decides what an honest answer looks like for those.
 */

/** The longest message the platform accepts. */
export const MAX_MESSAGE_LENGTH = 2000;

export const startConversationSchema = z.object({
  listingId: z.string().min(1, "This listing could not be identified."),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

/*
 * The two context threads. Each is keyed to a transaction object the caller
 * already holds, so the id is a plain uuid: there is no seed catalogue shape
 * to be honest about, and no listing to resolve.
 */
export const startReservationThreadSchema = z.object({
  reservationId: z.uuid("This reservation could not be identified."),
});

export type StartReservationThreadInput = z.infer<typeof startReservationThreadSchema>;

export const startBookingThreadSchema = z.object({
  bookingId: z.uuid("This booking could not be identified."),
});

export type StartBookingThreadInput = z.infer<typeof startBookingThreadSchema>;

export const sendMessageSchema = z.object({
  conversationId: z.uuid("This conversation could not be identified."),
  body: z
    .string()
    .trim()
    .min(1, "Type a message before sending.")
    .max(MAX_MESSAGE_LENGTH, "Keep messages under 2,000 characters."),
  replyToId: z.uuid().nullable().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Attachment paths follow the bucket convention <conversation_id>/<uuid>.<ext>.
// The shape is checked here and the conversation prefix is re-checked in the
// action against the validated conversation id.
const STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/i;

export const attachImageSchema = z.object({
  conversationId: z.uuid("This conversation could not be identified."),
  messageId: z.uuid("This message could not be identified.").optional(),
  storagePath: z
    .string()
    .regex(STORAGE_PATH_RE, "This photo could not be identified."),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

export type AttachImageInput = z.infer<typeof attachImageSchema>;

// A voice note: the same folder rule, an audio ending only, its length and its
// bars (GRADE 1, P1.3; `lib/messages/voice-note.ts`).
const VOICE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|m4a|mp4|aac|mp3|ogg)$/i;

export const attachVoiceSchema = z.object({
  conversationId: z.uuid("This conversation could not be identified."),
  storagePath: z.string().regex(VOICE_PATH_RE, "This voice note could not be identified."),
  durationMs: z
    .number("This voice note has no length.")
    .int("This voice note has no length.")
    .min(1, "This voice note is empty.")
    .max(VOICE_SERVER_MAX_MS, "Voice notes can be up to 2 minutes long."),
  peaks: z.array(z.number().min(0).max(1)).max(64).nullable().optional(),
  replyToId: z.uuid().nullable().optional(),
});

export type AttachVoiceInput = z.infer<typeof attachVoiceSchema>;

/** A reaction: one of the eight, on one message (`lib/messages/reactions.ts`). */
export const setReactionSchema = z.object({
  messageId: z.uuid("This message could not be identified."),
  emoji: z.enum(REACTION_EMOJI, "Choose one of the reactions."),
});

export const clearReactionSchema = z.object({
  messageId: z.uuid("This message could not be identified."),
});

export const confirmInspectionSchema = z.object({
  conversationId: z.uuid("This conversation could not be identified."),
  listingId: z.uuid("This listing could not be identified."),
});

export type ConfirmInspectionInput = z.infer<typeof confirmInspectionSchema>;

export const markThreadReadSchema = z.object({
  conversationId: z.uuid("This conversation could not be identified."),
});

export type MarkThreadReadInput = z.infer<typeof markThreadReadSchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

/** Delete a message for me, or for everyone inside the window (the database decides the window). */
export const deleteMessageSchema = z.object({
  messageId: z.uuid("This message could not be identified."),
  scope: z.enum(["me", "everyone"]),
});

export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;

/** Forward a message's words into another conversation of the sender's. */
export const forwardMessageSchema = z.object({
  messageId: z.uuid("This message could not be identified."),
  conversationId: z.uuid("This conversation could not be identified."),
});

export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;
