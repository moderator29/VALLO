"use client";
import "@/app/css/auth.css";

import { useErrorReport } from "@/lib/observability/use-error-report";
import { useSignalHold } from "@/lib/offline/use-offline";
import { escapeTo } from "@/lib/offline/escape";
import { SignalHold } from "@/components/app/SignalHold";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useClientCopy } from "@/lib/i18n/client-copy";

/**
 * The auth group's error boundary. There was none.
 *
 * A failure here used to fall all the way through to the root boundary, which
 * draws a full-screen branded page with its own logo lockup - on top of the
 * auth layout, which is ALSO a full-screen branded page with a logo lockup. Two
 * stacked brand pages, and every route out of the auth flow gone.
 *
 * This one stays inside the panel, so the aurora and the lockup behind it are
 * untouched and the person can still see they are on Vallo's sign-in screen.
 *
 * WHY THE COPY IS SPECIFIC. "Something went wrong" on an auth screen is
 * genuinely frightening: the two things a person immediately suspects are that
 * their password was wrong in some way that broke the page, or that their
 * account is gone. Neither is what a render failure means, so this says what it
 * does mean - nothing was submitted and no account changed - before it offers
 * the retry.
 *
 * The raw error never reaches the screen. `error.message` on an auth path is
 * exactly the kind of string that leaks whether an address exists. The digest
 * is shown instead: it finds the matching server log, which is the whole reason
 * Next generates one.
 */
export default function AuthError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16.3+: re-fetches the failed segment and re-renders it. `reset()` only redraws from what the client already holds, so a server failure stayed failed and Try again did nothing. */
  retry?: () => void;
}) {
  const again = retry ?? reset;
  const a = useClientCopy().authFlow;
  const reference = useErrorReport(error, "client.auth_boundary", "[vallo] auth route error");
  /* A weak signal is not a fault (13 November 2026): the page's shape stays
     and the screen is tried again by itself (lib/offline/use-offline.ts). */
  const hold = useSignalHold(error, again);
  if (hold.view === "retrying") return <SignalHold tries={hold.tries} onRetry={again} />;
  if (hold.view) {
    return (
      <div className="text-center" role="status">
        <h1 className="nf-h3">{hold.view === "offline" ? a.offlineTitle : a.weakTitle}</h1>
        <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {hold.view === "offline" ? a.offlineBody : a.weakBody}
        </p>
        <div className="mt-md flex flex-col">
          <Button variant="primary" size="lg" full onClick={again}>
            {a.tryAgain}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="nf-h3">{a.errorTitle}</h1>
      <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {a.errorBody}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="primary" size="lg" full onClick={again}>
          {a.tryAgain}
        </Button>
        <Link
          href="/"
          onClick={escapeTo("/", again)}
          className="nf-tap py-2 text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-muted)] transition-colors hover:text-[var(--nf-content-primary)]"
        >
          {a.backHome}
        </Link>
      </div>

      <p className="nf-numeric mt-md select-all text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        {a.reference.replace("{digest}", reference)}
      </p>
    </div>
  );
}
