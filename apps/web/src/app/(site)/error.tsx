"use client";

import { useErrorReport } from "@/lib/observability/use-error-report";
import { useSignalHold } from "@/lib/offline/use-offline";
import { SignalHold } from "@/components/app/SignalHold";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * The marketing site's error boundary. There was none.
 *
 * A failure on any public page fell through to the root boundary, which
 * replaces the entire document with a branded full-screen page - taking the
 * site header and footer with it. On a marketing page that is the worst
 * possible trade: those two carry every route the visitor has, and this is a
 * visitor who does not have an account and has no other way back in.
 *
 * This boundary sits inside the `(site)` layout, so the header, the navigation
 * and the footer stay exactly where they are and only the article is replaced.
 * Somebody who hits a broken help page can still reach Terms, Contact, or the
 * product.
 *
 * The digest rather than the message, for the same reason every other boundary
 * here does it: `error.message` from a server component is either meaningless
 * to a reader or says something about our database that should not be
 * published.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = useErrorReport(error, "client.site_boundary", "[vallo] site route error");
  /* A weak signal is not a fault (13 November 2026): the page's shape stays
     and the screen is tried again by itself (lib/offline/use-offline.ts). */
  const hold = useSignalHold(error, reset);
  if (hold.view === "retrying") return <SignalHold tries={hold.tries} onRetry={reset} />;
  if (hold.view) {
    return (
      <section className="nf-shell py-section">
        <div className="mx-auto max-w-[34rem] text-center" role="status">
          <h1 className="nf-h1">{hold.view === "offline" ? "You are offline" : "Weak connection"}</h1>
          <p className="mt-group text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
            {hold.view === "offline" ? "This page needs a connection. It loads by itself when your signal comes back." : "This page did not finish loading on the connection you have. Vallo tries again by itself when the signal settles, or tap Try again."}
          </p>
          <div className="mt-block flex justify-center">
            <Button variant="primary" size="lg" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="nf-shell py-section">
      <div className="mx-auto max-w-[34rem] text-center">
        <h1 className="nf-h1">This page did not load</h1>
        <p className="mt-group text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
          Something on our side stopped part way through. The rest of the site is
          working, and trying again usually settles it.
        </p>

        <div className="mt-block flex flex-wrap justify-center gap-row">
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            Back to the home page
          </ButtonLink>
        </div>

        <p className="nf-caption mt-heading">
          Reference <span className="nf-numeric select-all">{reference}</span>. Quote this to support.
        </p>
      </div>
    </section>
  );
}
