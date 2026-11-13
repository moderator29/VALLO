"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { ICON_PLATE_GLYPH, IconPlate } from "@/components/ui/IconPlate";
import { KIND_GLYPH } from "@/components/ui/State";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useErrorReport } from "@/lib/observability/use-error-report";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";
import { PlainSystemMoment } from "./offline/SystemFrame";

/**
 * Route level error boundary: the brand moment.
 *
 * The lockup over the aurora plate, one glass card, an honest sentence, the
 * reference, and two ways on. Same anatomy as the sign-in render, because a
 * crash is the one screen where the product has nothing to show but itself,
 * and it should look like itself rather than like a browser.
 *
 * The plain-image variant (`PlainSystemMoment`): this boundary is in the
 * bundle of every route, so it must not bring `next/image` with it.
 *
 * The raw error never reaches the screen. The digest is surfaced because it
 * is the id support needs to find the matching server log, which is the
 * whole point of having one.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Logs to the console (the only record when `SENTRY_DSN` is unset), sends
     the scrubbed report, and returns the short reference (C13). */
  const reference = useErrorReport(error, "client.route_boundary", "[vallo] route error");
  /*
   * A WEAK SIGNAL IS NOT A FAULT HERE EITHER (13 November 2026, the founder's
   * screenshot inside the app: this screen, "Reference C-...", on a slow
   * connection). This boundary catches what the app's own boundaries cannot:
   * a failure in a segment's LAYOUT (the app shell itself), and every route
   * group without a boundary of its own. It had no signal handling at all, so
   * a request that died on a weak signal there drew the fault screen. Now it
   * holds the page's shape and tries again by itself, like the app's boundary.
   */
  const hold = useSignalHold(error, reset);
  if (hold.view === "retrying") {
    return (
      <main id="main" className="px-gutter py-section">
        <SignalHold tries={hold.tries} onRetry={reset} />
      </main>
    );
  }
  if (hold.view === "offline" || hold.view === "weak") {
    return (
      <PlainSystemMoment home="/home-or-landing">
        <div data-state-kind="offline" role="status">
          <p className="nf-system__overline">Connection</p>
          <h1 className="nf-system__title">{hold.view === "offline" ? "You are offline" : "Weak connection"}</h1>
          <p className="nf-system__body">
            {hold.view === "offline"
              ? "This screen needs a connection. It loads by itself when your signal comes back."
              : "This screen did not finish loading on the connection you have. Vallo tries again by itself when the signal settles, or tap Try again."}
          </p>
        </div>
        <div className="nf-system__actions">
          <Button variant="primary" size="lg" full onClick={reset}>
            Try again
          </Button>
        </div>
      </PlainSystemMoment>
    );
  }

  return (
    /* The lockup links to `/home-or-landing`, not `/`. An error boundary is
       a client component by requirement, so it cannot read a session and the
       auth cookies are httpOnly by design. That route answers the question
       on the server and sends the reader to whichever home is theirs. */
    <PlainSystemMoment home="/home-or-landing">
      {/* WHAT HAPPENED, WHAT IS SAFE, WHAT TO DO (W2, round 5). The overline
          said "Something went wrong", the one phrase the voice bans because
          it says nothing. The card now leads with the failure's small mark,
          names what did not happen, says what a failed load cannot have
          touched (it undoes nothing already sent or saved; it can lose what
          was typed here), and gives the next step. The cut is immediate
          (system.css: an error fades in on the fast rung, nothing rises). */}
      <div data-state-kind="error" role="alert">
        <IconPlate size="md" tone="error" className="nf-system__mark">
          <UiIcon name={KIND_GLYPH.error} size={ICON_PLATE_GLYPH.md} />
        </IconPlate>
        <p className="nf-system__overline">Not loaded</p>
        <h1 className="nf-system__title">This screen did not load</h1>
        <p className="nf-system__body">
          A screen that fails to load undoes nothing you had already sent or
          saved. What you typed here may need typing again, and trying again
          usually settles it. If it keeps happening, tell support and quote
          the reference below.
        </p>
      </div>

      <p className="nf-system__ref">
        Reference <span className="nf-numeric select-all">{reference}</span>. Quote this to support.
      </p>

      <div className="nf-system__actions">
        <Button variant="primary" size="lg" full onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/home-or-landing" variant="secondary" size="lg" full>
          Back to home
        </ButtonLink>
      </div>
    </PlainSystemMoment>
  );
}
