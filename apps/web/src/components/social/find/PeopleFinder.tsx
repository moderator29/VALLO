"use client";

import { typedOf } from "./typed";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { searchPeople } from "@/lib/social/people-search-actions";
import type { PersonHit } from "@/lib/social/people-hits";
import { PersonRowItem, type PersonCardData } from "./PersonCards";
import "./people-v2.css";

export type FinderWords = {
  searchLabel: string;
  searchPlaceholder: string;
  clear: string;
  searching: string;
  resultsFor: string;
  noResultsTitle: string;
  noResultsBody: string;
  unavailable: string;
  roleLandlord: string;
  roleAgent: string;
  openProfile: string;
  you: string;
};


/** A search result as a row of the vertical list. */
export function cardOfHit(hit: PersonHit, words: Pick<FinderWords, "roleLandlord" | "roleAgent" | "you">): PersonCardData {
  return {
    key: hit.handle,
    href: `/u/${hit.handle}`,
    name: hit.displayLabel,
    handle: hit.handle,
    avatarUrl: hit.avatarUrl || null,
    tier: hit.tier,
    roleWord: hit.role === "landlord" ? words.roleLandlord : hit.role === "agent" ? words.roleAgent : null,
    facts: [],
    action: hit.isViewer
      ? { kind: "you", label: words.you }
      : { kind: "follow", handle: hit.handle, following: hit.viewerFollows },
  };
}

/**
 * THE PEOPLE PAGE'S SEARCH: a big field at the top that searches handle and
 * display name through the existing people search action as you type. While
 * two or more characters are typed the results take the sections' place;
 * clearing the field brings the sections back. A plain GET form to the same
 * page, so a search works before any script has loaded and an address that
 * carries `?q=` arrives with its answer already drawn (`initialHits`).
 *
 * An answer is shown only for what is in the box now, so a slow older search
 * never overwrites a newer one. The address is kept in step with
 * `history.replaceState`, which costs no server round trip.
 */
export function PeopleFinder({
  words,
  initialQuery,
  initialHits,
  signedIn,
  children,
}: {
  words: FinderWords;
  initialQuery: string;
  initialHits: PersonHit[] | null;
  signedIn: boolean;
  /** The sections, drawn while nothing is being searched. */
  children: React.ReactNode;
}) {
  const [value, setValue] = useState(initialQuery);
  const typed = typedOf(value);
  const active = typed.length >= 2;
  const [answer, setAnswer] = useState<{ q: string; hits: PersonHit[]; signedIn: boolean; failed: boolean } | null>(
    initialHits && typedOf(initialQuery).length >= 2
      ? { q: typedOf(initialQuery), hits: initialHits, signedIn, failed: false }
      : null,
  );
  const latest = useRef(typed);

  useEffect(() => {
    latest.current = typed;
    try {
      const next = typed.length >= 2 ? `${window.location.pathname}?q=${encodeURIComponent(typed)}` : window.location.pathname;
      window.history.replaceState(window.history.state, "", next);
    } catch {
      /* The address is a convenience; the search works without it. */
    }
    if (typed.length < 2 || answer?.q === typed) return;
    const timer = window.setTimeout(async () => {
      const result = await searchPeople(typed, true);
      if (latest.current !== typed) return;
      setAnswer({
        q: typed,
        hits: result.ok ? result.data.hits : [],
        signedIn: result.ok ? result.data.signedIn : signedIn,
        failed: !result.ok,
      });
    }, 250);
    return () => window.clearTimeout(timer);
    // The typed text drives the search; `answer` is read only to skip a repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  const current = answer && answer.q === typed ? answer : null;

  return (
    <>
      <form
        role="search"
        action="/around/people"
        method="get"
        onSubmit={(event) => event.preventDefault()}
        data-testid="people-finder"
      >
        <label className="nf-ppl__search">
          <UiIcon name="search" size={22} />
          <input
            className="nf-ppl__field"
            type="text"
            name="q"
            inputMode="search"
            enterKeyHint="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={words.searchPlaceholder}
            aria-label={words.searchLabel}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
          />
          {value ? (
            <button type="button" className="nf-ppl__clear" aria-label={words.clear} onClick={() => setValue("")}>
              <UiIcon name="close" size={18} />
            </button>
          ) : null}
        </label>
      </form>

      {active ? (
        <section className="nf-ppl__section" aria-live="polite" data-testid="people-results">
          {current === null ? (
            <>
              <p className="nf-ppl__status">{words.searching}</p>
              <ul className="nf-ppl__list" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="nf-ppl__rowitem">
                    <Skeleton circle width="3rem" className="shrink-0" />
                    <span className="nf-ppl__who">
                      <Skeleton width="8rem" height="1rem" radius="sm" />
                      <Skeleton width="5rem" height="0.75rem" radius="sm" />
                    </span>
                    <Skeleton width="5.5rem" height="2.5rem" radius="pill" className="shrink-0" />
                  </li>
                ))}
              </ul>
            </>
          ) : current.failed ? (
            <p className="nf-ppl__status">{words.unavailable}</p>
          ) : current.hits.length === 0 ? (
            <div className="nf-ppl__section">
              <h2 className="nf-ppl__title">{words.noResultsTitle.replace("{query}", `@${typed}`)}</h2>
              <p className="nf-ppl__note">{words.noResultsBody}</p>
            </div>
          ) : (
            <>
              <h2 className="nf-ppl__title">{words.resultsFor.replace("{query}", typed)}</h2>
              <ul className="nf-ppl__list">
                {current.hits.map((hit) => (
                  <PersonRowItem
                    key={hit.handle}
                    card={cardOfHit(hit, words)}
                    signedIn={current.signedIn}
                    openLabel={words.openProfile.replace("{name}", hit.displayLabel)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        children
      )}
    </>
  );
}
