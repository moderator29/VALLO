import { z } from "zod";
import { FIELD_KINDS, type CopilotForm, type FormField } from "./question-cards";

/**
 * THE QUESTION CARD'S SCHEMA, SERVER ONLY. The tool's input is checked
 * against it, and again before a card is sent to the browser. Kept apart from
 * `question-cards.ts` so no client module carries zod into a first load
 * (`app/client-import-graph.test.ts`).
 */

const slug = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
const words = (max: number) => z.string().trim().min(1).max(max);

export const formFieldSchema = z
  .object({
    id: slug,
    label: words(120),
    kind: z.enum(FIELD_KINDS),
    /** For single and multi: two to eight choices. */
    options: z.array(words(60)).min(2).max(8).optional(),
    /** single and multi: add an "Other" choice with a short text box. */
    other: z.boolean().optional(),
    /** A choice (single), choices (multi), "yes"/"no", a number or a date to start from. */
    initial: z.union([z.string().max(60), z.array(z.string().max(60)).max(8), z.number()]).optional(),
    placeholder: z.string().trim().max(80).optional(),
    required: z.boolean().optional(),
    /** number: the bounds. scale is always 1 to 5. */
    min: z.number().optional(),
    max: z.number().optional(),
    /** scale: the words under 1 and under 5. */
    lowLabel: z.string().trim().max(30).optional(),
    highLabel: z.string().trim().max(30).optional(),
  })
  .refine((f) => !(f.kind === "single" || f.kind === "multi") || (f.options && f.options.length >= 2), { message: "A choice needs at least two options." })
  .refine((f) => !(f.options && new Set(f.options.map((o) => o.toLowerCase())).size !== f.options.length), { message: "Choices must differ." });

export const copilotFormSchema = z
  .object({
    title: z.string().trim().max(80).optional(),
    /** One line under the title, if it helps. */
    intro: z.string().trim().max(200).optional(),
    fields: z.array(formFieldSchema).min(1).max(5),
    /** The button's own words: what happens when it is pressed. */
    submit: words(40),
  })
  .refine((f) => new Set(f.fields.map((x) => x.id)).size === f.fields.length, { message: "Each question needs its own id." });


/* The browser's hand-written shapes must stay the schema's shapes. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const fieldShapeAgrees: Same<z.infer<typeof formFieldSchema>, FormField> = true;
const formShapeAgrees: Same<z.infer<typeof copilotFormSchema> & { id: string }, CopilotForm> = true;
void fieldShapeAgrees;
void formShapeAgrees;
