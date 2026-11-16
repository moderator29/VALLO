import { z } from "zod";

/**
 * QUESTION CARDS, FOR EVERY CHAT ON VALLO (the founder, 16 November 2026,
 * from a ChatGPT screenshot: "add stuff like this, all these options, submit
 * answers"). The console copilot and the member assistant ask with the same
 * card, checked against the same schema.
 *
 * When a chat needs details before it can act ("which area, what budget, how
 * many bedrooms", "which desk, which week"), it does not ask in a paragraph the person must
 * answer by typing. It puts a card on screen: up to five questions, each a
 * set of choices to tap (one or several), yes or no, a 1 to 5 scale, a short
 * text, a number or a date, and one button whose words say what happens next
 * ("Show me the tickets", "Draft the reply"). The answers go back as the
 * person's next message, in plain words, and the card locks showing them.
 *
 * Pure: the schema the server checks a card against (the tool's input and
 * again before it is sent to the browser), and how answers become words.
 */

export const FIELD_KINDS = ["single", "multi", "yesno", "scale", "text", "number", "date"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

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

export type FormField = z.infer<typeof formFieldSchema>;
export type CopilotForm = z.infer<typeof copilotFormSchema> & { id: string };

/** What the person chose, by field id: one choice, several, a number, or words. */
export type FormAnswers = Record<string, string | string[] | number | null>;

/** The starting answers: the card's own suggestions, where it gave any. */
export function initialAnswers(form: Pick<CopilotForm, "fields">): FormAnswers {
  const out: FormAnswers = {};
  for (const f of form.fields) {
    const init = f.initial;
    if (f.kind === "multi") out[f.id] = Array.isArray(init) ? init.filter((v) => f.options?.includes(v)) : [];
    else if (f.kind === "single") out[f.id] = typeof init === "string" && f.options?.includes(init) ? init : null;
    else if (f.kind === "yesno") out[f.id] = init === "yes" || init === "no" ? init : null;
    else if (f.kind === "scale") out[f.id] = typeof init === "number" && init >= 1 && init <= 5 ? Math.round(init) : null;
    else if (f.kind === "number") out[f.id] = typeof init === "number" ? init : null;
    else out[f.id] = typeof init === "string" ? init : null;
  }
  return out;
}

function filled(v: FormAnswers[string]): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return Number.isFinite(v);
}

/** The first question still missing a required answer, or null when the card can be sent. */
export function missingAnswer(form: Pick<CopilotForm, "fields">, answers: FormAnswers): FormField | null {
  for (const f of form.fields) {
    const v = answers[f.id] ?? null;
    if (f.required !== false && !filled(v)) return f;
    if (f.kind === "number" && typeof v === "number") {
      if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) return f;
    }
  }
  return null;
}

/** One answer, as words. */
export function answerWords(f: FormField, v: FormAnswers[string]): string {
  if (!filled(v)) return "No answer";
  if (Array.isArray(v)) return v.join(", ");
  if (f.kind === "yesno") return v === "yes" ? "Yes" : "No";
  if (f.kind === "scale") return `${v} out of 5`;
  return String(v).trim();
}

/** The answers as the person's next message: the card's title, then one line per question. */
export function answersToMessage(form: Pick<CopilotForm, "title" | "fields">, answers: FormAnswers): string {
  const lines = form.fields.map((f) => `- ${f.label.replace(/[?:]\s*$/, "")}: ${answerWords(f, answers[f.id] ?? null)}`);
  return [form.title ? `${form.title}:` : "My answers:", ...lines].join("\n");
}
