"use server";

import { inviteDoor } from "./server";
import { parseInviteInput } from "./code";

/**
 * WHAT THE SIGN-UP FORM'S "Referral code or invite link" FIELD ASKS, as it
 * loses focus. Pasting a code or a whole link both work. Answers a first name
 * at most (the invite door's own rule, rate limited and failing closed), so a
 * stranger cannot walk codes to collect names. Never throws, never blocks the
 * form: "busy" only means nothing is shown and the server checks again at
 * sign-up.
 */
export type ReferrerLookup =
  | { state: "empty" }
  | { state: "unreadable" }
  | { state: "unknown" }
  | { state: "busy" }
  | { state: "found"; code: string; firstName: string | null };

export async function lookupReferrer(raw: string): Promise<ReferrerLookup> {
  try {
    if (typeof raw !== "string" || raw.trim() === "") return { state: "empty" };
    const code = parseInviteInput(raw.slice(0, 300));
    if (!code) return { state: "unreadable" };
    const door = await inviteDoor(code);
    if (!door) return { state: "busy" };
    return door.found ? { state: "found", code, firstName: door.firstName } : { state: "unknown" };
  } catch {
    return { state: "busy" };
  }
}
