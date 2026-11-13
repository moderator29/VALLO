"use client";

import { useErrorReport } from "@/lib/observability/use-error-report";
import { useSignalHold } from "@/lib/offline/use-offline";
import { escapeTo } from "@/lib/offline/escape";
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
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16.3+: re-fetches the failed segment and re-renders it. `reset()` only redraws from what the client already holds, so a server failure stayed failed and Try again did nothing. */
  retry?: () => void;
}) {
  const again = retry ?? reset;
  const reference = useErrorReport(error, "client.site_boundary", "[vallo] site route error");
  /* A weak signal is not a fault (13 November 2026): the page's shape stays
     and the screen is tried again by itself (lib/offline/use-offline.ts). */
  const hold = useSignalHold(error, again);
  if (hold.view === "retrying") return <SignalHold tries={hold.tries} onRetry={again} />;
  if (hold.view) {
    return (
      <section className="nf-shell py-section">
        <div className="mx-auto max-w-[34rem] text-center" role="status">
          <h1 className="nf-h1">{hold.view === "offline" ? "You are offline" : "Weak connection"}</h1>
          <p className="mt-group text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
            {hold.view === "offline" ? "This page needs a connection. It loads by itself when your signal comes back." : "This page did not finish loading on the connection you have. Vallo tries again by itself when the signal settles, or tap Try again."}
          </p>
          <div className="mt-block flex justify-center">
            <Button variant="primary" size="lg" onClick={again}>
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
        {/* The calm words (13 November 2026): this screen is reached only after
            the quiet tries above ran out, so it says the page is slow, not
            broken, and that the rest of the site still works. */}
        <h1 className="nf-h1">Taking longer than usual</h1>
        <p className="mt-group text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
          Vallo tried a few times and this page has not answered yet. The rest of
          the site is working. Tap Try again in a moment.
        </p>

        <div className="mt-block flex flex-wrap justify-center gap-row">
          <Button variant="primary" size="lg" onClick={again}>
            Try again
          </Button>
          <ButtonLink href="/" onClick={escapeTo("/", again)} variant="secondary" size="lg">
            Back to the home page
          </ButtonLink>
        </div>

        <p className="nf-caption mt-heading">
          Reference <span className="nf-numeric select-all">{reference}</span>. If this keeps happening, quote it to support.
        </p>
      </div>
    </section>
  );
}
