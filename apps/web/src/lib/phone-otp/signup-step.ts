import "server-only";
import { normalisePhone } from "../phone";
import { phoneConfirmationOn } from "./flag";
import { canSendTo } from "./transport";

/**
 * THE PHONE STEP OF SIGN-UP (2 November 2026): form, email code, phone code, in.
 *
 * After the email code, a new account confirms the mobile number it signed up
 * with, on its own screen (`/sign-up/phone`). The step is shown only when all
 * of these hold, so sign-up can never stall on a code that cannot arrive:
 *   - `phone_confirmation` is on;
 *   - the profile has a number we can read (any country);
 *   - that number is not already confirmed for this account;
 *   - this deployment can send to it (Termii for +234, Twilio for the rest).
 * Otherwise the person goes straight on, and the later moments (first
 * message, booking, payment) ask as they always have.
 */

type Reader = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

export const SIGN_UP_PHONE_PATH = "/sign-up/phone";

/** The number to confirm (E.164), or null when the step is not for this account now. */
export async function signUpPhoneToConfirm(db: unknown, userId: string): Promise<string | null> {
  try {
    if (!(await phoneConfirmationOn())) return null;
    const client = db as Reader;
    const profile = await client.from("profiles").select("phone").eq("id", userId).maybeSingle();
    const raw = (profile.data as { phone?: string | null } | null)?.phone ?? "";
    const phone = normalisePhone(raw);
    if (!phone || !canSendTo(phone)) return null;
    const confirmed = await client.from("confirmed_phones").select("phone").eq("user_id", userId).maybeSingle();
    if ((confirmed.data as { phone?: string } | null)?.phone) return null;
    return phone;
  } catch {
    /* A read that fails sends nobody into a step that may not work. */
    return null;
  }
}
