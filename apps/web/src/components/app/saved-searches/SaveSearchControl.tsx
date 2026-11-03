"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { saveSearch } from "@/lib/saved/searches-actions";
import type { SavedSearchParams, SavedSearchView } from "@/lib/saved/searches";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * SAVE THIS SEARCH, ON THE SEARCH ITSELF.
 *
 * ---------------------------------------------------------------------------
 * IT WRITES THE FILTERS THAT ARE ACTUALLY IN EFFECT.
 *
 * `params` is the canonical form of the address the reader is looking at,
 * built on the server by `canonicalSearch` from the same parsed query the
 * results below were fetched with. Not the raw address bar, which can carry
 * rubbish; not a snapshot taken when the page loaded, which a filter change
 * would leave stale, because changing a filter is a navigation in this product
 * and the server renders this control again with the new parameters.
 *
 * ---------------------------------------------------------------------------
 * AND IT READS THE STORED STATE BACK.
 *
 * `saved` is the row the server found for this exact search, under the
 * account's own policy, in this request. That is the half a saved-search
 * feature usually drops: the control says Saved after a RELOAD because a row
 * exists, not because a tap set some state a minute ago. Nothing here writes
 * to the device, and nothing is remembered between renders.
 *
 * ---------------------------------------------------------------------------
 * SIGNED OUT IT IS A LINK, NOT A REFUSAL. A saved search has to belong to an
 * account: it follows a person between devices and it is what the alert is
 * addressed to, and there is no honest local half of it the way there is for
 * a hearted listing. So the control is a link to sign in that comes straight
 * back to this same search, rather than a button that takes a tap and then
 * explains why it could not keep it.
 */
export function SaveSearchControl({
  params,
  saved,
  signedIn,
  signInHref,
  searchesHref = "/saved/searches",
}: {
  /** The canonical parameters of the search on screen. */
  params: SavedSearchParams;
  /** The stored row for this exact search, or null when it is not kept. */
  saved: SavedSearchView | null;
  signedIn: boolean;
  /** Sign in and return to this search. */
  signInHref: string;
  searchesHref?: string;
}) {
  const [row, setRow] = useState<SavedSearchView | null>(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  const save = useCallback(() => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveSearch({ params });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        /* The row the database returned, so the name and the alert state on
           screen are the stored ones rather than this component's guess. */
        setRow(result.data);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }, [params, pending]);

  if (!signedIn) {
    return (
      <div className="mt-inline" data-testid="save-search">
        <ButtonLink
          href={signInHref}
          variant="glass"
          size="sm"
          leadingIcon="bookmark"
          data-testid="save-search-signin"
        >
          Save this search
        </ButtonLink>
      </div>
    );
  }

  if (row) {
    return (
      <div className="mt-inline flex flex-wrap items-center gap-2xs" data-testid="save-search">
        <span
          className="nf-body-sm inline-flex items-center gap-2xs text-[var(--nf-content-secondary)]"
          data-testid="save-search-state"
          data-saved="true"
        >
          <UiIcon name="bookmark" size={16} filled />
          Saved as {row.label}
        </span>
        <Link
          href={searchesHref}
          prefetch
          className="nf-link-quiet nf-body-sm text-[var(--nf-content-link)]"
          data-testid="save-search-manage"
        >
          {row.alertEnabled ? "Alerts on. Change" : "Alerts off. Change"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-inline" data-testid="save-search">
      <Button
        variant="glass"
        size="sm"
        leadingIcon="bookmark"
        loading={pending}
        onClick={save}
        data-testid="save-search-save"
        data-saved="false"
      >
        Save this search
      </Button>
      {error && (
        <p role="status" className="nf-body-sm mt-2xs text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
