import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { resolveSessionClaims } from "@/lib/actions/session";
import { signedOutStart } from "@/lib/catalogue/public-access";
import { firstRunCookieFrom, isFirstRunSeen } from "@/components/app/welcome/first-run-seen";

/**
 * WHERE THE NATIVE APP OPENS (STORE-04).
 *
 * `server.appStartPath` in `capacitor.config.ts` points the shell here rather
 * than at `/`, the marketing page a reviewer would read as "a website in a
 * frame". A session goes to `/home`. Anybody else goes to the open catalogue
 * when the founder has switched it on (`VALLO_PUBLIC_CATALOGUE`), and to the
 * first-run welcome otherwise, which is where sign-up and sign-in begin.
 *
 * THE FIRST OPEN IS THE ONBOARDING (the founder, 7 October 2026): after the
 * launch animation, a device that has never been shown it opens on the
 * carousel (`/welcome`) whatever the catalogue switch says, and its end is
 * the sign-in / sign-up choice. Once seen, the signed-out start as before.
 *
 * A 307 and no-store, because the answer changes the moment somebody signs in.
 *
 * THE DEADLINE. This is the native shell's real cold-start path, and
 * `resolveSession()` makes a live round trip to GoTrue with no deadline of
 * its own. `home-or-landing/route.ts` hung a real device on the splash for
 * fifteen minutes for exactly this reason (2 October 2026) and was fixed at
 * f82f2148f; this route carried the same hang and is fixed the same way. The
 * real answer races a deadline, and on timeout a cheap guess from the auth
 * cookie's presence decides. A wrong guess is harmless: `/home` and the
 * signed-out start both pass back through `proxy.ts`'s own time-bounded gate
 * on the very next request.
 *
 * NO COOKIE, NO ROUND TRIP (October 2026). Without a Supabase auth cookie
 * there is no session for GoTrue to confirm, so the answer is already known:
 * the signed-out start, straight away. Waiting on `resolveSession()` there
 * cost a signed-out cold start one to three seconds of native splash for an
 * answer that could only be "signed out". Only a request that carries the
 * cookie pays for the round trip, still under the deadline.
 *
 * AND WITH A COOKIE, NO GOTRUE ROUND TRIP EITHER (13 October 2026, the
 * startup track). This route only chooses where to send somebody, and
 * `/home` passes back through `proxy.ts`'s own gate on the very next request,
 * so it needs to know whether the access token is a real one, not to ask
 * GoTrue about it. `resolveSessionClaims()` verifies the token's signature
 * and expiry locally against the project's published keys (what PostgREST
 * itself does, and what the proxy has just done for this same request after
 * refreshing the token), where `resolveSession()` made an HTTPS round trip to
 * GoTrue before the first redirect of every signed-in cold start. The
 * deadline stays: a cold instance still fetches those keys once.
 */
const OPEN_TIMEOUT_MS = 800;

/** Cheap enough to call on every request: no network, just a cookie name. */
async function guessSignedIn(): Promise<boolean> {
  const jar = await cookies();
  return jar.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

async function signedInWithDeadline(): Promise<boolean> {
  if (!(await guessSignedIn())) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), OPEN_TIMEOUT_MS);
  });
  try {
    const outcome = await Promise.race([resolveSessionClaims(), timeout]);
    /* The cookie is there (checked above), so the guess is "signed in". */
    if (outcome === "timeout") return true;
    return outcome.state === "signed-in";
  } finally {
    clearTimeout(timer);
  }
}

/** This device has been shown the onboarding (`first-run-seen.ts`). */
async function onboardingSeen(): Promise<boolean> {
  return isFirstRunSeen(firstRunCookieFrom((await headers()).get("cookie")));
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = (await signedInWithDeadline())
    ? "/home"
    : (await onboardingSeen())
      ? signedOutStart()
      : "/welcome";
  return NextResponse.redirect(new URL(target, request.url), {
    status: 307,
    headers: { "cache-control": "no-store" },
  });
}
