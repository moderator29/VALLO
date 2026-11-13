import { safeReturnPath } from "@/lib/security/return-path";

/**
 * THE PROFILE PHOTO, AS THE LAST STEP OF SIGN-UP (13 November 2026, the
 * founder: "put it in the sign-up flow before you finish signing up ... with a
 * Skip button, clean, high end"). It used to be a sheet that rose over the
 * first page after sign-up; now every path that makes an account (the email
 * form and its code or link, Google or Apple through "Finish setting up")
 * sends the new account here before it lands, carrying where it was going.
 *
 * Skipping is always one tap and is never asked about again here: the
 * profile is where a photo is added later.
 */
export const PHOTO_STEP_PATH = "/sign-up/photo";

/** The photo step, then `next` (a same-site path only; never the step itself). */
export function photoStepHref(next: string | null | undefined): string {
  const safe = typeof next === "string" ? safeReturnPath(next, "") : null;
  const onward = safe && safe !== PHOTO_STEP_PATH && !safe.startsWith(`${PHOTO_STEP_PATH}?`) ? safe : null;
  return onward ? `${PHOTO_STEP_PATH}?next=${encodeURIComponent(onward)}` : PHOTO_STEP_PATH;
}

/** Where the step goes afterwards: a same-site path, never the step, else /home. */
export function photoStepOnward(raw: string | string[] | undefined): string {
  const candidate = typeof raw === "string" ? safeReturnPath(raw, "") : null;
  return candidate && candidate !== PHOTO_STEP_PATH && !candidate.startsWith(`${PHOTO_STEP_PATH}?`) ? candidate : "/home";
}
