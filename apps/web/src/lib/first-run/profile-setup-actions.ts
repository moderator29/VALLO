"use server";

import { cookies } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { SETUP_SHOWN_COOKIE, SETUP_SKIP_COOKIE, SKIP_COOKIE_SECONDS } from "./profile-setup-core";

const cookieBase = { path: "/", sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" };

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
