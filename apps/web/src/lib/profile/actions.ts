"use server";

/**
 * The profile and settings loop: edit, save, reload the truth.
 *
 * Every write here goes through the caller's own RLS-bound client, so the
 * database decides whose row may change: `profiles_update_own` allows exactly
 * one row, the caller's. Settings are merged server side against a fresh read
 * rather than overwritten from the client, so a toggle flipped on a phone
 * cannot wipe one flipped on a laptop a second earlier. Nothing here writes a
 * notification: a person changing their own preferences already knows.
 *
 * DELETION IS NOT HERE ANY MORE. This file used to carry a `deleteAccount`
 * that called `admin.auth.admin.deleteUser`, which aborts on the first row
 * whose foreign key is `on delete restrict`: every booking, every wallet. So
 * it failed for precisely the people who had paid for something and told them
 * to email support, which App Store Review guideline 5.1.1(v) names as the
 * rejection case rather than as a workaround. The whole flow, its
 * preconditions, its thirty day window and its scheduled purge now live in
 * `lib/account-deletion`. See `docs/design/audits/r3/findings.md` F-17.
 *
 * THIS MODULE IS "use server", so it exports async functions and nothing else.
 */

import { revalidatePath } from "next/cache";
import { pathInOwnFolder } from "@/lib/security/own-folder";
import { isDeviceRef, revokeTokens } from "../push/revoke";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { contentRefusal } from "../safety/content-refusal";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { SUPABASE_URL } from "../supabase/env";
import {
  avatarPublicUrl,
  composeDisplayName,
  mergeSettings,
  parseSettings,
  setAvatarSchema,
  settingsPatchSchema,
  updateProfileSchema,
  type ResolvedProfileSettings,
  type SettingsPatch,
} from "./schema";


const NO_ROW_MESSAGE =
  "We could not find your profile record. Sign out, sign back in, and try again. Your details are still on this screen.";

const SAVE_FAILED_MESSAGE =
  "We could not save that just now. Your details are still on this screen, so try again in a moment.";

const SETTINGS_FAILED_MESSAGE =
  "That preference did not save. It has been put back as it was. Check your connection and try again.";

const AVATAR_FAILED_MESSAGE =
  "The photo uploaded but we could not attach it to your profile. Try choosing it again.";

const AVATAR_FOREIGN_PATH_MESSAGE =
  "That photo was not uploaded to your own folder. Choose the photo again.";

/* ------------------------------------------------------------------- profile */

/** What a successful profile save hands back to re-render the card. */
export type ProfileSaved = {
  displayName: string;
  firstName: string;
  surname: string;
  nickname: string;
  phone: string;
};

export async function updateProfile(input: unknown): Promise<ActionResult<ProfileSaved>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(updateProfileSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const values = parsed.data;

  const { supabase, user } = session;

  // Identity lives in real columns: admin support searches people by surname,
  // the agent verification queue reads a legal name beside the documents, and
  // emails greet by first name. display_name is derived by a database trigger
  // from these parts, so it can never drift out of agreement with them.
  //
  // No state here. It carries a foreign key to public.states (code) and this
  // action used to write the state's NAME, so every save with a state chosen
  // was refused by the database and reported as a generic failure. Where
  // somebody is now belongs to /settings/place, with the local government it
  // has to agree with.
  const { data: saved, error } = await supabase
    .from("profiles")
    .update({
      first_name: values.firstName,
      surname: values.surname,
      nickname: values.nickname === "" ? null : values.nickname,
      phone: values.phone === "" ? null : values.phone,
    })
    .eq("id", user.id)
    .select("display_name, first_name, surname, nickname, phone")
    .maybeSingle();

  if (error) {
    // RM004: the content scanner on profile names (SEC-05) refused a name on
    // the objectionable-content list. The database message is written for a
    // person, so it is shown as it is.
    const refused = contentRefusal(error);
    if (refused) return fail(refused);
    return fail(SAVE_FAILED_MESSAGE);
  }
  if (!saved) return fail(NO_ROW_MESSAGE);

  revalidatePath("/profile");
  revalidatePath("/settings");

  return ok({
    displayName: saved.display_name ?? composeDisplayName(values.firstName, values.surname),
    firstName: saved.first_name ?? "",
    surname: saved.surname ?? "",
    nickname: saved.nickname ?? "",
    phone: saved.phone ?? "",
  });
}

/** Form binding for useActionState. */
export async function updateProfileAction(
  _prev: ActionResult<ProfileSaved> | null,
  formData: FormData,
): Promise<ActionResult<ProfileSaved>> {
  return updateProfile(formDataToObject(formData));
}

/* ------------------------------------------------------------------ settings */

export async function updateSettings(
  patch: SettingsPatch,
): Promise<ActionResult<ResolvedProfileSettings>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(settingsPatchSchema, patch);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { supabase, user } = session;

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) return fail(SETTINGS_FAILED_MESSAGE);
  if (!current) return fail(NO_ROW_MESSAGE);

  const merged = mergeSettings(current.settings, parsed.data);

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ settings: merged })
    .eq("id", user.id)
    .select("settings")
    .maybeSingle();

  if (error) return fail(SETTINGS_FAILED_MESSAGE);
  if (!saved) return fail(NO_ROW_MESSAGE);

  revalidatePath("/settings");
  // The same document is edited from Agent Mode, so that door has to see the
  // new answer too.
  revalidatePath("/agent/settings");
  return ok(parseSettings(saved.settings));
}

/* -------------------------------------------------------------------- avatar */

export async function setAvatar(input: unknown): Promise<ActionResult<{ avatarUrl: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(setAvatarSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { supabase, user } = session;
  const { storagePath } = parsed.data;

  // Storage policy already confines writes to the caller's own folder. This
  // second check means a forged path can never be recorded on the row either.
  if (!pathInOwnFolder(user.id, storagePath)) return fail(AVATAR_FOREIGN_PATH_MESSAGE);

  const avatarUrl = avatarPublicUrl(SUPABASE_URL, storagePath);

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .select("avatar_url")
    .maybeSingle();

  if (error) return fail(AVATAR_FAILED_MESSAGE);
  if (!saved) return fail(NO_ROW_MESSAGE);

  revalidatePath("/profile");
  return ok({ avatarUrl: saved.avatar_url ?? avatarUrl });
}

/* ------------------------------------------------------------------ sign out */

/*
 * SEC-08: "Log out" means THIS device. supabase-js defaults to
 * `scope: 'global'`, which ended every session on the account, so logging out
 * on a phone threw the laptop out too. `signOutEverywhere` is the explicit,
 * separate action for the case where that is what somebody wants.
 */
export async function signOut(deviceRef?: string): Promise<ActionResult<null>> {
  /* B-2: signing out is never held by the finish-setup step. */
  return setupExempt(() => endSessions("local", deviceRef));
}

/** Every device on the account, this one included. */
export async function signOutEverywhere(): Promise<ActionResult<null>> {
  return setupExempt(() => endSessions("global"));
}

/*
 * NATIVE RELEASE AUDIT, 28 SEPTEMBER 2026: A SIGNED-OUT PHONE KEPT RECEIVING
 * THE ACCOUNT'S PUSHES. Nothing here touched `push_tokens`, so a shared or
 * handed-on handset went on showing the previous person's messages and
 * bookings on its lock screen until somebody else enrolled on it.
 *
 * "Log out" retires THIS device's row: the client passes the `device_ref` the
 * register route gave it (`components/app/push/device-state.ts`), which is a
 * digest, never the token. "Log out everywhere" retires every row. Both go
 * through `revokeTokens`, whose ownership filter is the verified session's
 * user id, so a ref naming somebody else's device changes nothing.
 *
 * Best effort, and BEFORE the sign out, because afterwards there is no user
 * id to filter by. A failed revoke never keeps somebody signed in.
 */
async function retirePushDevices(userId: string, scope: "local" | "global", deviceRef?: string) {
  if (scope === "local" && !isDeviceRef(deviceRef)) return;
  try {
    await revokeTokens(userId, scope === "global" ? { all: true } : { deviceRef: deviceRef as string });
  } catch {
    /* The drain still stops at the provider's own "gone" for a dead token. */
  }
}

async function endSessions(scope: "local" | "global", deviceRef?: string): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return ok(null);

  await retirePushDevices(session.user.id, scope, deviceRef);

  const { error } = await session.supabase.auth.signOut({ scope });
  if (error) {
    return fail("We could not sign you out just now. Check your connection and try again.");
  }

  revalidatePath("/", "layout");
  return ok(null);
}

/* ------------------------------------------------------------------ deletion */

/*
 * `deleteAccount` and `deleteAccountAction` lived here and have been removed.
 * The replacement is `startDeletion`, `cancelDeletion` and `restoreWithCode`
 * in `lib/account-deletion/actions.ts`, with the purge on the cron harness in
 * `lib/cron/jobs/account-purge.ts`. Nothing in the app imported the old pair
 * except the settings drawer, which now draws `DeleteAccountPanel`.
 */
