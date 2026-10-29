import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { resolveSession } from "@/lib/actions/session";
import { firstRunCookieFrom, isFirstRunSeen } from "@/components/app/welcome/first-run-seen";
import { isShellRequest, shellStartPath } from "@/lib/native/shell";

/**
 * THE HANG THIS ROUTE USED TO BE ABLE TO CAUSE, FOUND FROM A REAL DEVICE
 * STUCK ON THE NATIVE SPLASH SCREEN FOR MORE THAN FIFTEEN MINUTES (2 October
 * 2026), on a connection good enough to run every other app on the phone.
 *
 * This route is the native shell's cold-start entry point: `proxy.ts` sends
 * every shell request for `/` straight here before anything else runs. The
 * comment at the top of this file claims "the answer depends entirely on the
 * caller's own cookies", but `resolveSession()` does not read cookies alone:
 * it calls `supabase.auth.getUser()`, a live HTTPS round trip to GoTrue, with
 * no deadline of its own. `proxy.ts`'s equivalent check already learned this
 * lesson once (`AUTH_ANSWER_TIMEOUT_MS`, OPS-05) and races it against a
 * timeout; this route, being newer and believing its own claim, never did.
 * A slow or momentarily unreachable GoTrue left this request simply never
 * resolving. The native web view's main-frame navigation then never
 * completes: no page is ever delivered, so no client script -- including the
 * splash's own failsafe timers -- ever gets the chance to run. A person on a
 * phone sees exactly what was reported: the branded splash, forever, no
 * matter how long they wait, indistinguishable from the app being broken.
 *
 * The fix races the real resolution against a deadline and falls back to a
 * cheap guess from the session cookie's bare presence, which costs nothing to
 * read. A wrong guess here is not a correctness bug: `/home` and `/welcome`
 * both pass back through `proxy.ts`'s own already time-bounded gate on the
 * very next request, which is what actually decides who may stay. This route
 * only has to stop hanging; it never had to be right on its own.
 */
const HOME_OR_LANDING_TIMEOUT_MS = 800;

/** Cheap enough to call on every timeout: no network, just a cookie name. */
async function guessSignedIn(): Promise<boolean> {
  const jar = await cookies();
  return jar.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Signed in or not, inside the deadline above, and never left hanging.
 * `resolveSession()` already treats "unconfigured" as signed-out for this
 * route's purposes (see the comment on `target` below), so a boolean is the
 * whole answer this route needs.
 */
async function signedInWithDeadline(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), HOME_OR_LANDING_TIMEOUT_MS);
  });
  try {
    const outcome = await Promise.race([resolveSession(), timeout]);
    if (outcome === "timeout") return guessSignedIn();
    return outcome.state === "signed-in";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * "Home", resolved by who is asking.
 *
 * There are two homes in this product and only one word for them. `/` is the
 * landing page, which exists to explain Vallo to somebody who has never seen
 * it. `/home` is the first screen inside the platform, which is what "home"
 * means to anybody who has signed in.
 *
 * Every dead end offered "Back to home" and half of them pointed at `/`. So a
 * signed-in person who hit a 404 was thrown out of the product and onto the
 * marketing page, which reads as being logged out. The owner put it plainly:
 * that button should never take them to the landing page.
 *
 * The 404 page can answer this for itself because it renders on the server.
 * The error boundaries cannot: an error boundary is a client component by
 * requirement, so it has no session to read and the auth cookies are httpOnly
 * by design. Rather than give the two cases different answers, or have a
 * client guess from something it should not be able to see, both ask here.
 *
 * A redirect, not a page. There is nothing to render and nothing to cache: the
 * answer depends entirely on the caller's own cookies.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const signedIn = await signedInWithDeadline();
  const url = new URL(request.url);
  /*
   * THE STORE SHELL NEVER GETS THE LANDING PAGE (V-11). `?app=1`, or the
   * shell's own user agent mark, resolves to `/home`, `/welcome` or
   * `/sign-in`, and never to `/`. See `lib/native/shell.ts` for why this is
   * decided here rather than by pointing `server.url` at a path.
   */
  if (isShellRequest({ userAgent: request.headers.get("user-agent"), app: url.searchParams.get("app") })) {
    const seen = isFirstRunSeen(firstRunCookieFrom((await headers()).get("cookie")));
    const start = shellStartPath({ signedIn, firstRunSeen: seen });
    return NextResponse.redirect(new URL(start, request.url), { status: 307 });
  }
  /* Unconfigured is landing too, and deliberately so. With no platform keys
     nothing inside can load, so sending somebody to `/home` would swap one
     dead end for another. `signedInWithDeadline` already answers false for
     "unconfigured", the same as a real signed-out session. */
  const target = signedIn ? "/home" : "/";
  return NextResponse.redirect(new URL(target, request.url), {
    /* 307, not 308. Where somebody belongs changes when they sign in or out,
       so this answer must never be cached by a browser as permanent. */
    status: 307,
  });
}
