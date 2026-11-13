"use server";

/**
 * The two things a person wants from the device list, and no third.
 *
 * Turn one device off, because they sold the phone or do not recognise the
 * row. Or turn every device off, which is the one they reach for when a
 * handset is lost and they are not going to enumerate anything.
 *
 * ===========================================================================
 * WHAT THESE DO AND DO NOT AFFECT, because the screen has to say it too.
 *
 * This retires PUSH TOKENS. It does not sign a device out: that is
 * `/settings/devices` and `lib/security/sessions-actions.ts`, which end
 * `auth.sessions` rows. A phone that has been thrown off here can still open
 * the application, and a phone thrown off there can no longer be notified
 * only once its token stops being re-registered. They are two different
 * screens about two different things and the copy on both says so, because a
 * person who thinks they have locked a lost phone out and has only silenced
 * it is in a worse position than one who was told nothing.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "@/lib/actions/session";
import { isDeviceRef, revokeTokens } from "./revoke";

const FAILED_MESSAGE =
  "We could not turn that device off just now. Nothing has changed, and the list below is still correct. Try again in a moment.";

const SETTINGS_PATH = "/settings/notifications";

const oneDevice = z.object({
  deviceId: z.string().uuid("That is not a device on this account."),
});

const thisDevice = z.object({
  deviceRef: z.string().refine(isDeviceRef, "That is not a device on this account."),
});

/**
 * Retire one device.
 *
 * `revoked: 0` is returned as a success with a truthful message rather than
 * as an error. It means the row was already off, or was never this person's,
 * and those two must read the same from outside. Either way the screen is
 * correct after this and telling somebody it failed would be a lie that sends
 * them round the loop again.
 */
export async function revokePushDevice(input: unknown): Promise<ActionResult<{ revoked: number }>> {
  const parsed = validate(oneDevice, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const outcome = await revokeTokens(session.user.id, { deviceId: parsed.data.deviceId });
  if (!outcome.ok) return fail(FAILED_MESSAGE);

  revalidatePath(SETTINGS_PATH);
  return ok({ revoked: outcome.revoked });
}

/** Retire every live device on this account, including the one in their hand. */
export async function revokeAllPushDevices(): Promise<ActionResult<{ revoked: number }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const outcome = await revokeTokens(session.user.id, { all: true });
  if (!outcome.ok) return fail(FAILED_MESSAGE);

  revalidatePath(SETTINGS_PATH);
  return ok({ revoked: outcome.revoked });
}

/**
 * The master switch on Settings turned OFF: retire the device in the member's
 * hand, named by the `device_ref` `/api/push/register` gave it
 * (`components/app/push/device-state.ts`). The same ownership filter as
 * above, so a ref that is not this member's retires nothing.
 */
export async function revokeThisPushDevice(input: unknown): Promise<ActionResult<{ revoked: number }>> {
  const parsed = validate(thisDevice, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const outcome = await revokeTokens(session.user.id, { deviceRef: parsed.data.deviceRef });
  if (!outcome.ok) return fail(FAILED_MESSAGE);

  revalidatePath(SETTINGS_PATH);
  return ok({ revoked: outcome.revoked });
}
