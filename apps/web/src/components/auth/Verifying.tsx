"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/design-system/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { VerifyingPanel, type AuthMoment } from "./VerifyingPanel";
import type { VerificationOutcome } from "@/lib/auth/form-state";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { playThreshold, thresholdAllowed } from "@/lib/motion/threshold";

/**
 * The moment after somebody taps the button in their email.
 *
 * This used to be nothing at all. `/auth/callback` was a route handler that
 * exchanged the code and answered with a 307, so the browser sat on a blank
 * white document for however long the round trip took and then jumped. On a
 * good connection that is a flicker. On a Nigerian mobile connection it is a
 * second or two of a page that appears to have failed, at the exact moment
 * somebody is deciding whether this platform works.
 *
 * So the screen exists, it says what is happening, and then it takes them in.
 *
 * It also does something the route handler could not. The implicit flow puts
 * the session in the URL FRAGMENT, and a fragment never leaves the browser: a
 * server literally cannot see it. Anybody arriving that way was told their link
 * had expired. Reading it needs code running in the page, which is what this
 * is.
 *
 * WITHOUT JAVASCRIPT this screen cannot finish, and it says so rather than
 * sitting on "Verifying" forever. Reading a fragment and writing a session both
 * need code running here. The `<noscript>` below sends those readers to the six
 * digit code instead, which is a plain form and needs nothing.
 */

/**
 * The shortest a verification is allowed to be on screen.
 *
 * The work itself can finish in 200ms, and a screen that appears and vanishes
 * inside a blink is worse than no screen: it reads as a flicker, or as a fault.
 * Holding it for a beat is what makes it a moment somebody remembers rather
 * than a frame they half saw. Two seconds is long enough to read the sentence
 * and short enough that nobody waits.
 */
const MIN_ON_SCREEN_MS = 2000;

export function Verifying({
  code,
  tokenHash,
  type,
  next,
  moment = "sign-up",
  complete,
}: {
  code?: string | undefined;
  tokenHash?: string | undefined;
  type?: string | undefined;
  next?: string | undefined;
  /**
   * Which event this is, so the screen can name it.
   *
   * Sign-in and sign-up land on this same callback, because the OAuth
   * handshake is identical either way. Nothing here can tell them apart, so
   * the intent travels from the button that started it.
   */
  moment?: AuthMoment;
  complete: (input: {
    code?: string | undefined;
    tokenHash?: string | undefined;
    type?: string | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    next?: string | undefined;
  }) => Promise<VerificationOutcome>;
}) {
  const a = useClientCopy().authFlow;
  const router = useRouter();
  const [failed, setFailed] = useState<Extract<VerificationOutcome, { ok: false }> | null>(null);
  /* Runs once. A second call would exchange a code that has already been
     spent, which comes back as an error and would turn a success into an
     expired-link screen. */
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    /* The fragment, if this is the implicit flow. Read before anything else
       touches the URL, and cleared from the address bar afterwards so a
       session token is not left sitting in history. */
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token") ?? undefined;
    const refreshToken = hash.get("refresh_token") ?? undefined;
    if (accessToken) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const opened = Date.now();
    /* The floor applies to success only. A refusal has something to read and
       something to do, so holding it back would be delay for its own sake. */
    const settle = (run: () => void) => {
      const left = MIN_ON_SCREEN_MS - (Date.now() - opened);
      if (left <= 0) run();
      else window.setTimeout(run, left);
    };

    void complete({ code, tokenHash, type, accessToken, refreshToken, next }).then((result) => {
      if (result.ok) {
        /* The success moment is not in the address: the server action set a
           one-shot cookie (`rememberSuccess`), and `SuccessFlagHost` asks for
           it on the next screen, so a link cannot forge it. */
        const go = () => {
          router.replace(result.next);
          /* The tree behind this screen was rendered signed out. */
          router.refresh();
        };
        /* Track M: a new account walks through the door, which is itself
           the moment on screen, so it replaces the two-second floor. */
        if (moment === "sign-up" && thresholdAllowed()) void playThreshold("door").then(go);
        else settle(go);
        return;
      }
      setFailed(result);
    });
  }, [code, tokenHash, type, next, complete, router, moment]);

  if (failed) {
    const said =
      failed.reason === "provider-off"
        ? a.providerOff
        : failed.reason === "unconfigured"
        ? a.unconfigured
        : failed.reason === "invalid"
          ? a.invalidLink
          : a.expiredLink;

    if (failed.reason === "provider-off") {
      return (
        <div className="w-full max-w-[26rem] text-center" data-testid="verify-failed" data-reason="provider-off">
          <span className="flex justify-center">
            <LogoMark size={44} title="Vallo" />
          </span>
          <h1 className="nf-h2 mt-md">{a.signInWithYourEmail}</h1>
          <p className="mt-sm leading-relaxed text-[var(--nf-content-secondary)]">{said}</p>
          <ButtonLink href="/sign-in" variant="primary" size="lg" className="mt-lg">
            {a.signInWithEmail}
          </ButtonLink>
        </div>
      );
    }

    return (
      <div className="w-full max-w-[26rem] text-center" data-testid="verify-failed">
        {/* Its own centring wrapper. `text-center` centres inline content and
            the mark renders as a block, so it hung on the left edge above a
            centred column. */}
        <span className="flex justify-center">
          <LogoMark size={44} title="Vallo" />
        </span>
        <h1 className="nf-h2 mt-5">{a.linkFailedTitle}</h1>
        <p className="mt-3 leading-relaxed text-[var(--nf-content-secondary)]">{said}</p>
        <p className="mt-3 leading-relaxed text-[var(--nf-content-secondary)]">
          {a.codeStillWorks}
        </p>
        <ButtonLink href="/sign-up/verify" variant="primary" size="lg" className="mt-7">
          {a.enterCodeInstead}
        </ButtonLink>
        <p className="mt-5 text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          <Link
            href="/sign-in"
            className="nf-tap underline-offset-4 hover:text-[var(--nf-content-secondary)] hover:underline"
          >
            {a.alreadyConfirmed}
          </Link>
        </p>
      </div>
    );
  }

  return <VerifyingPanel moment={moment} />;
}
