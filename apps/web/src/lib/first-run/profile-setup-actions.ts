"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { contentRefusal } from "@/lib/safety/content-refusal";
import { markFirstRunSeen } from "./store";
import {
  NAME_CONFIRMED_FEATURE,
  SETUP_SHOWN_COOKIE,
  SETUP_SKIP_COOKIE,
  SKIP_COOKIE_SECONDS,
  splitFullName,
} from "./profile-setup-core";

const TWO_NAMES = "Enter your first name and your surname.";
const SAVE_FAILED = "We could not save your name just now. Check your connection and try again.";

const cookieBase = { path: "/", sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" };

/** Save the full name and record that it was confirmed. */
export async function confirmProfileName(input: unknown): Promise<ActionResult<{ firstName: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const raw = typeof input === "object" && input !== null ? (input as { fullName?: unknown }).fullName : null;
  const name = typeof raw === "string" ? splitFullName(raw) : null;
  if (!name) return fail(TWO_NAMES, { fullName: TWO_NAMES });

  const { supabase, user } = session;
  /* display_name follows from these two by the database's own trigger. */
  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name: name.firstName, surname: name.surname })
    .eq("id", user.id)
    .select("first_name")
    .maybeSingle();
  if (error) {
    const refused = contentRefusal(error);
    return fail(refused ?? SAVE_FAILED);
  }
  if (!data) return fail(SAVE_FAILED);

  await markFirstRunSeen(NAME_CONFIRMED_FEATURE);
  revalidatePath("/profile");
  revalidatePath("/settings");
  return ok({ firstName: data.first_name ?? name.firstName });
}

/** The sheet opened: not again in this session. A session cookie, so it dies with the browser. */
export async function markProfileSetupShown(): Promise<ActionResult<null>> {
  try {
    (await cookies()).set(SETUP_SHOWN_COOKIE, "1", cookieBase);
    return ok(null);
  } catch {
    return fail("Could not note that the sheet was shown");
  }
}

/** "Skip for now": not again for the quiet days (profile-setup-core.ts). */
export async function skipProfileSetup(): Promise<ActionResult<null>> {
  try {
    (await cookies()).set(SETUP_SKIP_COOKIE, String(Date.now()), { ...cookieBase, maxAge: SKIP_COOKIE_SECONDS });
    return ok(null);
  } catch {
    return fail("Could not note the skip");
  }
}
