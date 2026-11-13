import "server-only";

import { admin } from "../security/money-step-up";
import { clearResetIntent, clearUnlock } from "./state";

/**
 * TURNING THE PASSCODE OFF, THE PART AFTER THE PROOF (13 November 2026, the
 * founder: "same as Face ID, build it end to end". The passcode is off by
 * default and the member turns it on in Settings; until now a member who
 * turned it on could never turn it off).
 *
 * Called only by the two proven paths (`turnOffPasscodeAction`, the current
 * code; `finishPasscodeOffWithKey`, Face ID or a fingerprint), never on a tap.
 *
 *   - The member's row in `public.member_passcodes` is deleted with the
 *     service client: the table grants authenticated no delete, on purpose, so
 *     only this server path can do it. With no row, `passcode_status` answers
 *     "unset", and the gate (`decideGate`) shows every page with nothing
 *     drawn in front of it. That is what makes a stale unlock cookie
 *     harmless: the gate never asks for one when nothing is set.
 *   - This browser's unlock cookie and any reset intent are cleared anyway.
 *   - The platform keys (`money_credentials`) are NOT removed: the same key
 *     confirms payments (the money lock), so none is "used only for the lock".
 *     Settings, Privacy, Money lock is where a key is removed.
 *   - One audit line, `passcode.off`, with how it was proven. Best effort: a
 *     lost audit line never keeps a lock on.
 *
 * Turning it on again is the first-time setup, from scratch: there is no row.
 */
export async function turnPasscodeOff(userId: string, proof: "code" | "key"): Promise<boolean> {
  const a = admin();
  if (!a) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = a as any;
  try {
    const { error } = await loose.from("member_passcodes").delete().eq("user_id", userId);
    if (error) return false;
  } catch {
    return false;
  }
  await clearUnlock();
  await clearResetIntent();
  try {
    await loose.from("audit_log").insert({ actor_id: userId, action: "passcode.off", entity_type: "user", entity_id: userId, metadata: { proof } });
  } catch {
    /* The lock is off; the record is best effort. */
  }
  return true;
}
