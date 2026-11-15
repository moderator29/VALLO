"use client";

import { typedOf } from "./typed";
import { useEffect, useMemo, useRef, useState } from "react";
import { plural } from "@vallo/i18n/core";
import { clearRecent, forgetRecent, readRecent, rememberRecent } from "./recent-searches";
import { filterHits, type RoleFilter } from "./people-filters";
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
  yourProfile: string;
  filterLabel: string;
  filterAll: string;
  filterAgents: string;
  filterLandlords: string;
  filterMembers: string;
  filterVerified: string;
  filterNobody: string;
  filterReset: string;
  resultsCount: { one: string; other: string };
  recentTitle: string;
  recentClear: string;
  recentRemove: string;
  tipTitle: string;
  tipBody: string;
};



/** A search result as a row of the vertical list. */
export function cardOfHit(hit: PersonHit, words: Pick<FinderWords, "roleLandlord" | "roleAgent" | "you" | "yourProfile">): PersonCardData {
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
      ? { kind: "you", label: words.yourProfile, href: `/u/${hit.handle}` }
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
  const field = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<RoleFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [focused, setFocused] = useState(false);
  /* Read after the first paint, never during it: the server has no device
     storage, and a list that differed between the two would be a mismatch. */
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

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
  const shown = useMemo(() => (current ? filterHits(current.hits, role, verifiedOnly) : []), [current, role, verifiedOnly]);
  const filtered = role !== "all" || verifiedOnly;
  const showRecent = !active && focused && recent.length > 0;

  const pick = (query: string) => {
    setValue(query);
    field.current?.focus();
  };
  const filterChip = (value: RoleFilter, label: string) => (
    <button
      key={value}
      type="button"
      className="nf-ppl__chip"
      aria-pressed={role === value}
      onClick={() => setRole(value)}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* THE FIELD STAYS UNDER THE THUMB: pinned under the top bar while the
          rows scroll beneath it, so searching never means scrolling back up. */}
      <div className="nf-ppl__dock">
      <form
        role="search"
        action="/around/people"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          field.current?.blur();
        }}
        data-testid="people-finder"
      >
        <label className="nf-ppl__search">
          <UiIcon name="search" size={22} />
          <input
            ref={field}
            onFocus={() => setFocused(true)}
            /* A tap on a recent search lands before the blur would hide it. */
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
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
            <button
              type="button"
              className="nf-ppl__clear"
              aria-label={words.clear}
              onClick={() => {
                setValue("");
                field.current?.focus();
              }}
            >
              <UiIcon name="close" size={18} />
            </button>
          ) : null}
        </label>
      </form>

      {active && current && !current.failed && current.hits.length > 0 ? (
        <div className="nf-ppl__filters" role="group" aria-label={words.filterLabel} data-testid="people-filters">
          {filterChip("all", words.filterAll)}
          {filterChip("agent", words.filterAgents)}
          {filterChip("landlord", words.filterLandlords)}
          {filterChip("member", words.filterMembers)}
          <button
            type="button"
            className="nf-ppl__chip nf-ppl__chip--toggle"
            aria-pressed={verifiedOnly}
            onClick={() => setVerifiedOnly((on) => !on)}
          >
            <UiIcon name="check" size={14} />
            {words.filterVerified}
          </button>
        </div>
      ) : null}
      </div>

      {showRecent ? (
        <section className="nf-ppl__recent" aria-labelledby="nf-ppl-recent" data-testid="people-recent">
          <div className="nf-ppl__recent-head">
            <h2 id="nf-ppl-recent" className="nf-ppl__eyebrow">
              {words.recentTitle}
            </h2>
            <button
              type="button"
              className="nf-ppl__link"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setRecent(clearRecent())}
            >
              {words.recentClear}
            </button>
          </div>
          <ul className="nf-ppl__recent-list">
            {recent.map((query) => (
              <li key={query} className="nf-ppl__recent-item">
                <button
                  type="button"
                  className="nf-ppl__recent-pick"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(query)}
                >
                  <UiIcon name="clock" size={16} />
                  <span>{query}</span>
                </button>
                <button
                  type="button"
                  className="nf-ppl__recent-x"
                  aria-label={words.recentRemove.replace("{query}", query)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRecent(forgetRecent(query))}
                >
                  <UiIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            <div className="nf-ppl__empty">
              <span className="nf-ppl__empty-mark" aria-hidden="true">
                <UiIcon name="search" size={24} />
              </span>
              <h2 className="nf-ppl__title">{words.noResultsTitle.replace("{query}", `@${typed}`)}</h2>
              <p className="nf-ppl__note">{words.noResultsBody}</p>
            </div>
          ) : (
            <>
              <div className="nf-ppl__results-head">
                <h2 className="nf-ppl__title">{words.resultsFor.replace("{query}", typed)}</h2>
                <span className="nf-ppl__count nf-numeric">{plural(shown.length, words.resultsCount)}</span>
              </div>
              {shown.length === 0 && filtered ? (
                <div className="nf-ppl__nomatch">
                  <p className="nf-ppl__note">{words.filterNobody}</p>
                  <button
                    type="button"
                    className="nf-ppl__link"
                    onClick={() => {
                      setRole("all");
                      setVerifiedOnly(false);
                    }}
                  >
                    {words.filterReset}
                  </button>
                </div>
              ) : (
                <ul className="nf-ppl__list">
                  {shown.map((hit) => (
                    <PersonRowItem
                      key={hit.handle}
                      card={cardOfHit(hit, words)}
                      signedIn={current.signedIn}
                      openLabel={words.openProfile.replace("{name}", hit.displayLabel)}
                      onOpen={() => setRecent(rememberRecent(typed))}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ) : (
        children
      )}
    </>
  );
}
