import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIRST_RUN_COOKIE } from "@/components/app/welcome/first-run-seen";
import { hasSessionCookie, signInFirstRunRedirect } from "./first-run-gate";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveProviderStates } from "@/lib/auth/providers";
import { requestSurface } from "@/lib/auth/surface";
import { chooserEmail, signInWithEmail, signUpMethodForEmail } from "@/lib/auth/actions";
import type { EmailStatus } from "@/lib/auth/form-state";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { AltSignInDoors } from "@/components/auth/AltSignInDoors";
import { emailFromQuery } from "@/components/auth/auth-intent";
import { arrivalOf } from "@/app/welcome/plan";
import { wallHeading } from "@/components/app/welcome/wall-heading";
import { safeReturnPath } from "@/lib/security/return-path";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("signIn", { robots: { index: false, follow: false } });
}

/**
 * Notices the auth callback can send here. A link that has expired or been
 * used already is the common case and deserves a plain sentence, not a silent
 * return to an empty form where the person cannot tell what went wrong.
 *
 * They land on the chooser rather than the form because every one of them is
 * about getting in at all, not about the email route specifically.
 */
/* The sentences are `authFlow.notices` in the dictionary, keyed by the
   notice name the callback and the middleware send. */

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  /* A device that has never met the onboarding meets it now, once, and comes
     back here with everything it asked for (`first-run-gate.ts`, the
     founder, 7 October). Never a signed-in member. */
  const jar = await cookies();
  const firstRun = signInFirstRunRedirect({
    cookie: jar.get(FIRST_RUN_COOKIE)?.value,
    signedIn: hasSessionCookie(jar.getAll().map((c) => c.name)),
    params,
  });
  if (firstRun) redirect(firstRun);

  const locale = await getLocale();
  const t = getDictionary(locale);
  const notice = typeof params.notice === "string" ? params.notice : undefined;
  /* Through the one return-path guard before anything on the screen uses
     it: the client doors (passkey, Apple) navigate to it themselves. */
  const next = (typeof params.next === "string" && safeReturnPath(params.next, "")) || undefined;
  /* THE WALL NAMES WHAT THEY ASKED FOR (V-18), here as well as on first
     run. A device that has already seen first run comes straight to this
     screen from the wall, and "Sign in to open that" said nothing about what
     "that" was. The same pure heading first run uses names it. */
  const arrival = notice === "sign-in-required" && next ? arrivalOf(next) : null;
  const wall = arrival ? wallHeading(arrival.reason, t.shape.wall) : null;
  /* The key comes from the URL, so only the table's own keys count
     (`?notice=constructor` must not reach the prototype). */
  const noticeText = wall
    ? `${wall.titleA} ${wall.titleB}. ${wall.body}`
    : notice && Object.hasOwn(t.authFlow.notices, notice)
      ? t.authFlow.notices[notice]
      : undefined;

  /*
   * B-1: ONE SCREEN, EMAIL AND PASSWORD TOGETHER (refs 12 and 14). This used
   * to draw an email-only chooser and send the address on to
   * `/sign-in/email` for the password; that route now forwards here.
   *
   * What the split was protecting is kept. The one action is still
   * `signInWithEmail` (per-connection and per-address limits, the neutral
   * "do not match" refusal, `next` re-checked on the server). An address that
   * arrives already filled in (`?email=` on a link, or the old chooser's
   * cookie) is looked up exactly as the second step did, and "none" draws
   * the ordinary password step, so the screen never says whether an account
   * exists (F-08); only a clear "google" changes what is drawn.
   */
  const surface = await requestSurface();
  const providers = await resolveProviderStates(surface);
  const configured = (id: "email" | "google" | "apple") =>
    providers.some((p) => p.id === id && p.configured);
  const address = emailFromQuery(params.email) || (await chooserEmail());

  let accountMethod: EmailStatus = "unknown";
  if (address) {
    try {
      const method = await signUpMethodForEmail(address);
      accountMethod = method === "none" ? "unknown" : method;
    } catch {
      accountMethod = "unknown";
    }
  }

  return (
    <>
      <EmailAuthForm
        mode="sign-in"
        t={t}
        action={signInWithEmail}
        next={next}
        initialEmail={address}
        accountMethod={accountMethod}
        googleReady={configured("google") && surface === "web"}
        appleReady={configured("apple") && surface !== "android-native"}
        surface={surface}
        notice={noticeText}
        emailReady={configured("email")}
      />
      {/* A3 and A2: the code-by-email door, and phone and passkey when switched on. */}
      <AltSignInDoors t={t} next={next} surface={surface} />
    </>
  );
}
