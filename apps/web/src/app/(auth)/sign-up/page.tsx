import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveProviderStates } from "@/lib/auth/providers";
import { requestSurface } from "@/lib/auth/surface";
import { phoneSignInEnabled } from "@/lib/auth/phone-sign-in-flag";
import { SignUpOptions } from "@/components/auth/SignUpOptions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIRST_RUN_COOKIE } from "@/components/app/welcome/first-run-seen";
import { doorFirstRunRedirect, hasSessionCookie } from "../sign-in/first-run-gate";
import { safeReturnPath } from "@/lib/security/return-path";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("signUp", { robots: { index: false, follow: false } });
}

/**
 * The sign-up OPTIONS page, where Get started leads (the founder, 29
 * September): Sign up with email (to the two-step form at
 * `/sign-up/email`), Google and Apple where they work, and "I already have
 * an account". The pieces are `SignUpOptions` and the Slate system.
 *
 * IT CARRIES `next`, AND UNTIL 23 SEPTEMBER IT WAS THE ONE HOP THAT DROPPED IT.
 *
 * The chain a shared address travels is: `proxy.ts` bounces a stranger to
 * `/sign-in?next=/listing/abc`, `AuthChoices` rides `next` into
 * `/sign-in/email` or into the Google door, and `/auth/callback` lands them
 * back on the listing. `/sign-up` sat in that chain reading nothing, so a
 * person who pressed Create an account, or who was linked straight here,
 * reached the form with no destination and finished on `/home`.
 *
 * That was survivable while browsing was open, because almost nobody met a
 * sign-in wall. After item 8 EVERY shared listing, search and profile address
 * on this platform goes through this screen, so a dropped `next` is every
 * shared link on Vallo ending somewhere other than the thing that was shared.
 *
 * It is read and passed on, never trusted: `safeReturnPath` in `proxy.ts` is
 * what put the value in the URL, every door here carries it on, the form
 * re-reads it into its own hidden field, and the auth action validates it again before redirecting. A
 * `next` typed by hand into this address is checked at the same gate as one
 * the middleware wrote.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  /* The first Sign up on a device meets the onboarding first, once, and
     comes back here with its address intact (`first-run-gate.ts`, the
     founder, 7 October). Never a signed-in member. */
  const jar = await cookies();
  const firstRun = doorFirstRunRedirect({
    door: "/sign-up",
    cookie: jar.get(FIRST_RUN_COOKIE)?.value,
    signedIn: hasSessionCookie(jar.getAll().map((c) => c.name)),
    params,
  });
  if (firstRun) redirect(firstRun);
  /* Through the one return-path guard before anything on the screen uses
     it: the client doors (passkey, Apple) navigate to it themselves. */
  const next = (typeof params.next === "string" && safeReturnPath(params.next, "")) || undefined;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const surface = await requestSurface();
  const providers = await resolveProviderStates(surface);
  const ready = (id: "google" | "apple") => providers.some((p) => p.id === id && p.configured);
  return (
    <SignUpOptions
      t={t}
      googleReady={ready("google")}
      appleReady={ready("apple")}
      surface={surface}
      next={next}
      phoneReady={phoneSignInEnabled()}
    />
  );
}
