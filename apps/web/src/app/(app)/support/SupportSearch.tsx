"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { plural, type Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { searchHelpArticles, type HelpArticle } from "@/lib/support/help-search";
import { useInboxLocale, useInboxPart } from "@/components/app/threads/use-inbox-copy";
import "./support-palette.css";

/**
 * "Search for help", as a command palette (reference 7067, adapted).
 *
 * One Card holds a search field and its results, the way a command palette
 * does: type, and the answers that match stand beneath the field as rows, the
 * first one lit. The arrow keys move the lit row, Enter opens its answer in
 * place under the row, Escape clears. Before anybody types, the popular
 * articles stand in the list. Matching runs on the device against the list
 * the page handed down (`lib/support/help-search.ts`), so a keystroke costs no
 * round trip.
 *
 * It is the ARIA combobox pattern with a listbox, not a pile of `details`:
 * focus stays in the field, the lit row is `aria-activedescendant`, and each
 * row is an option. An opened answer is a region under its row, and a touch
 * reader taps a row to open it, so nothing needs a keyboard. The keyboard hint
 * is drawn only where there is a fine pointer.
 */
export function SupportSearch({
  articles,
  popular,
  supportCopy,
}: {
  articles: HelpArticle[];
  popular: HelpArticle[];
  /** `experienceInbox.support` from the server page (no client dictionary read). */
  supportCopy?: Dictionary["experienceInbox"]["support"];
}) {
  const copy = useInboxPart("support", supportCopy).palette;
  const locale = useInboxLocale();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchHelpArticles(articles, query), [articles, query]);
  const shown = searching ? results : popular;
  const current = Math.min(active, Math.max(0, shown.length - 1));
  const optionId = (index: number) => `${listId}-opt-${index}`;
  /* The list is open when it is drawn: there is at least one row in it. */
  const listOpen = shown.length > 0;
  /* The opened answer is drawn BELOW the listbox, not inside it: a listbox may
     hold only options, and the answer (a region with text) between two of them
     broke that for a screen reader (auditor A3, S3). */
  const openArticle = shown.find((article) => article.q === openQ) ?? null;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(shown.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = shown[current];
      if (row) setOpenQ((q) => (q === row.q ? null : row.q));
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
      setActive(0);
    }
  };

  return (
    <section aria-labelledby="support-search-heading" className="space-y-row">
      <h2 id="support-search-heading" className="nf-sgroup__label">
        {copy.heading}
      </h2>

      <div className="nf-panel nf-panel--card nf-palette" data-testid="support-palette">
        <div className="nf-palette__field">
          <UiIcon name="search" size={20} className="nf-palette__glyph" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={listOpen ? optionId(current) : undefined}
            aria-label={copy.heading}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
            placeholder={copy.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="nf-palette__input"
            data-testid="support-search-input"
          />
          {query ? (
            <Button
              variant="icon"
              leadingIcon="close"
              aria-label={copy.clear}
              className="nf-palette__clear"
              onClick={() => {
                setQuery("");
                setActive(0);
                inputRef.current?.focus();
              }}
            />
          ) : null}
        </div>

        <p className="nf-palette__status nf-caption" role="status">
          {searching ? (results.length === 0 ? copy.none : plural(results.length, copy.matching, locale)) : copy.popular}
        </p>

        {shown.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={copy.heading}
            className="nf-palette__list"
            data-testid={searching ? "support-search-results" : "support-popular"}
          >
            {shown.map((article, index) => {
              const open = openQ === article.q;
              return (
                <li key={article.q} role="presentation" className="nf-palette__item">
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === current}
                    tabIndex={-1}
                    className="nf-palette__row"
                    data-active={index === current || undefined}
                    onMouseMove={() => setActive(index)}
                    onClick={() => {
                      setActive(index);
                      setOpenQ(open ? null : article.q);
                    }}
                  >
                    <span className="nf-palette__plate" aria-hidden="true">
                      <UiIcon name="info" size={16} />
                    </span>
                    <span className="nf-palette__q">{article.q}</span>
                    <UiIcon
                      name={open ? "chevron-down" : "chevron-right"}
                      size={16}
                      className="nf-palette__enter"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="nf-palette__none nf-body-sm">{copy.noneHelp}</p>
        )}

        {openArticle ? (
          <div className="nf-palette__answer" role="region" aria-label={copy.openAnswer} data-testid="support-answer">
            <p className="nf-overline nf-palette__cat">{openArticle.category}</p>
            <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{openArticle.q}</p>
            <p className="nf-body-sm">{openArticle.a}</p>
          </div>
        ) : null}

        <p className="nf-palette__hint nf-caption" aria-hidden="true">
          {copy.hint}
        </p>
      </div>

      <Link
        href="/help"
        className="nf-link-quiet nf-body-sm inline-flex min-h-11 items-center gap-3xs font-semibold text-[var(--nf-content-link)]"
      >
        {copy.browseAll}
        <UiIcon name="arrow-right" size={16} />
      </Link>
    </section>
  );
}
