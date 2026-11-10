import { z } from "zod";
import { DELETE_CONFIRM_PHRASE, DELETION_REASONS } from "./constants";

/**
 * Everything the deletion flow accepts from a client, validated on the server
 * before a single row is touched.
 *
 * THE PASSWORD AND THE CODE ARE NEVER STORED AND NEVER LOGGED. They exist
 * inside one action call and nowhere else. The schemas below are the only
 * place either is named.
 */

/**
 * The confirmation step: re-authenticate, then type the phrase.
 *
 * `password` is optional because a person who signed up with Google or Apple
 * has never set one. That branch re-authenticates with a one-time code sent to
 * the address on the account instead, which is `emailCode`. Exactly one of
 * them must arrive, and `refine` says so rather than letting an empty
 * confirmation through.
 */
export const confirmDeletionSchema = z
  .object({
    confirmPhrase: z
      .string({ message: `Type ${DELETE_CONFIRM_PHRASE} to confirm.` })
      .trim()
      .refine(
        (value) => value === DELETE_CONFIRM_PHRASE,
        `Type ${DELETE_CONFIRM_PHRASE} exactly, in capitals, to confirm.`,
      ),
    password: z.string().optional(),
    emailCode: z.string().trim().optional(),
    /** Why they are leaving: a code from the closed list, never free text. */
    reason: z.enum(DELETION_REASONS, { message: "Choose the closest reason." }).optional(),
  })
  .refine(
    (value) => (value.password ?? "").length > 0 || (value.emailCode ?? "").length > 0,
    {
      message: "Confirm it is you before we go on.",
      path: ["password"],
    },
  );

export type ConfirmDeletionInput = z.infer<typeof confirmDeletionSchema>;

/** The code from the confirmation email, which is the way back without a session. */
export const restoreWithCodeSchema = z.object({
  restoreCode: z
    .string({ message: "Enter the code from your email." })
    .trim()
    .min(1, "Enter the code from your email.")
    .max(64, "That is longer than a restore code."),
});

export type RestoreWithCodeInput = z.infer<typeof restoreWithCodeSchema>;
