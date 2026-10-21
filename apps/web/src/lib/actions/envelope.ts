import type { z } from "zod";

/**
 * The one result shape every server action returns.
 *
 * A mutation either succeeded with data, or failed with a plain-language
 * message and, when a form was involved, per-field errors keyed by input name.
 * Uniformity is the point: thirty forms stay honest because they all speak
 * this envelope, and the UI never has to guess what an error looks like.
 * Error messages state what happened and what to do next, never raw codes.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      /**
       * The refusal is the phone gate (`lib/phone-otp/gate.ts`): the screen
       * draws the button to Settings, Phone beside the words
       * (`components/app/PhoneGateLink.tsx`), which brings the member back.
       */
      gate?: "phone";
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** A refusal from the phone gate. Assignable to any `ActionResult<T>`. */
export type PhoneGateRefusal = { ok: false; error: string; gate?: "phone" };

/**
 * The phone gate's refusal. `link` is false for the try-again sentence a
 * fail-closed moment answers with when its read failed: there is nothing to
 * confirm, so there is no button.
 */
export function phoneGateRefusal(error: string, link = true): PhoneGateRefusal {
  return link ? { ok: false, error, gate: "phone" } : { ok: false, error };
}

/** Did this result come back from the phone gate? For the screen's button. */
export function isPhoneGate(result: { ok: boolean; gate?: "phone" } | null | undefined): boolean {
  return Boolean(result && !result.ok && result.gate === "phone");
}

/**
 * The opening words of `SIGNED_OUT_MESSAGE` ("Sign in to continue."), which
 * lives in a `server-only` module a client component cannot import. A screen
 * that offers a sign-in link beside a signed-out refusal asks this rather
 * than matching the sentence itself; `session.test.ts` keeps the two equal.
 */
export const SIGNED_OUT_LEAD = "Sign in";

/** Is this refusal the signed-out one? */
export function isSignedOutRefusal(error: string): boolean {
  return error.startsWith(SIGNED_OUT_LEAD);
}

export function fail<T = null>(
  error: string,
  fieldErrors?: Record<string, string>,
): ActionResult<T> {
  return { ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

/**
 * Validate unknown input against a Zod schema into the envelope. On failure
 * the first issue per field becomes that field's message, so forms can light
 * up exactly the inputs that need attention.
 */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    error: "Please check the highlighted fields and try again.",
    fieldErrors,
  };
}

/** Read FormData into a plain object Zod can parse (multi-values join last-wins). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value.trim();
  }
  return out;
}
