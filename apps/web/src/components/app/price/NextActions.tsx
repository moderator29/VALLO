"use client";

import { useState, type ReactNode } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { saveSearch } from "@/lib/saved/searches-actions";
import { listingSearchHref, listingSearchParams, type CheckFacts } from "@/lib/price-check/next-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * WHAT NEXT, beneath an answered Price Check (track L). Three steps a person
 * can take with the range they were just shown: look at what is listed there,
 * be told when something new is, or send the area card to somebody. Each is a
 * real action on a real surface: the search shelf, a saved search with its
 * alert on, and the share card that already existed (passed in as `share`).
 */
export function NextActions({
  facts,
  copy,
  signedIn,
  share,
}: {
  facts: CheckFacts;
  copy: Dictionary["priceCheck"]["next"];
  signedIn: boolean;
  share: ReactNode;
}) {
  const href = listingSearchHref(facts);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  const setAlert = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveSearch({ params: listingSearchParams(facts) });
      if (result.ok) setState("saved");
      else {
        setState("failed");
        setError(result.error);
      }
    });
  };

  return (
    <section aria-labelledby="nf-pc-next" className="nf-pc-next" data-testid="nf-pc-next">
      <h3 id="nf-pc-next" className="nf-h4">
        {copy.heading}
      </h3>
      {/* Three steps, one primary. The glyph plates that stood beside each
          button came off (premium pass, 7 October): each button already says
          what it does, and the plates took 52px from a button whose label
          then wrapped onto two lines at 390. */}
      <ol className="mt-row grid gap-md">
        <li className="nf-pc-next__step">
          <div className="min-w-0 flex-1">
            <ButtonLink href={href} variant="primary" full data-testid="nf-pc-see-listings">
              {copy.seeListings}
            </ButtonLink>
            <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">{copy.seeListingsBody}</p>
          </div>
        </li>
        <li className="nf-pc-next__step">
          <div className="min-w-0 flex-1">
            {signedIn ? (
              state === "saved" ? (
                <div role="status" data-testid="nf-pc-alert-saved">
                  <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{copy.alertSaved}</p>
                  <ButtonLink href="/saved/searches" variant="ghost" size="sm" className="mt-inline-tight">
                    {copy.alertOpen}
                  </ButtonLink>
                </div>
              ) : (
                <Button variant="secondary" full loading={pending} onClick={setAlert} data-testid="nf-pc-set-alert">
                  {copy.setAlert}
                </Button>
              )
            ) : (
              <ButtonLink
                href={`/sign-in?next=${encodeURIComponent("/price")}`}
                variant="secondary"
                full
                data-testid="nf-pc-set-alert"
              >
                {copy.setAlertSignedOut}
              </ButtonLink>
            )}
            {state !== "saved" && (
              <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">{copy.alertBody}</p>
            )}
            {error && (
              <p role="alert" className="mt-inline-tight nf-caption text-[var(--nf-state-error)]">
                {error}
              </p>
            )}
          </div>
        </li>
        <li className="nf-pc-next__step">
          <div className="min-w-0 flex-1">
            {share}
            <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">{copy.shareBody}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
