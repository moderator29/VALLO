import "server-only";

import type { User } from "@supabase/supabase-js";
import { confirmedPhoneLookup } from "../identity/phone-gate";
import { phoneConfirmationOn } from "./flag";
import { isQaTester } from "./qa";
import { signupPhoneOwed, SIGNUP_PHONE_FROM } from "./signup-gate";
import { otpTransport } from "./transport";

/**
 * Does this signed-in account still owe its phone number? Cheap for everybody
 * who does not: an account older than the rollout answers from its own
 * `created_at` with no read at all. A read that fails answers "not owed",
 * because the step is a door and a broken read must not lock a member out
 * (the money paths that need a confirmed phone fail closed on their own).
 */
export async function phoneOwedAtSignup(client: unknown, user: Pick<User, "id" | "created_at">): Promise<boolean> {
  const made = user.created_at ? Date.parse(user.created_at) : Number.NaN;
  if (!Number.isFinite(made) || made < Date.parse(SIGNUP_PHONE_FROM)) return false;
  try {
    const [flagOn, qa, phone] = await Promise.all([
      phoneConfirmationOn(),
      isQaTester(user.id),
      confirmedPhoneLookup(client)(user.id),
    ]);
    return signupPhoneOwed({
      createdAt: user.created_at,
      confirmed: phone !== null,
      flagOn,
      transportReady: otpTransport().name !== "unconfigured",
      qa,
    });
  } catch {
    return false;
  }
}
