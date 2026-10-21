"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { loadSupportIndex } from "@/lib/support/search-actions";
import { prepare, searchPrepared, SECTION_LABEL, type PreparedEntry, type SearchHit } from "@/lib/support/search";

/**
 * ONE SEARCH for Help, Docs, Guides and the legal pages.
 *
 * `useSupportSearch` loads the index the first time the field is focused (so
 * a page nobody searches on pays nothing) and answers on the device, with no
 * round trip per keystroke. `SupportSearchField` is a combobox: arrow keys
 * move through the results, Enter opens one, Escape clears, and "/" focuses
 * the field from anywhere on the page. `SupportResults` draws the rows, each
 * naming the section it came from.
 *
 * Two layouts share it. On Help the results replace the answer list while
 * somebody is searching ("inline"). In the Docs frame they drop under the field
 * ("popover") so the chapter beneath stays where it is.
 */

export function useSupportSearch(query: string) {
  const [index, setIndex] = useState<PreparedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    loadSupportIndex().then(
      (entries) => setIndex(prepare(entries)),
      () => {
        started.current = false;
        setFailed(true);
      },
    );
  }, []);

  /* A query typed before the field was focused (a ?q= link) loads it too. */
  useEffect(() => {
    if (query.trim()) load();
  }, [query, load]);

  const hits = useMemo<SearchHit[]>(() => (index && query.trim() ? searchPrepared(index, query) : []), [index, query]);
  const loading = query.trim().length > 0 && !index && !failed;
  return { hits, loading, failed, load, ready: index !== null };
}

export function SectionChip({ section }: { section: SearchHit["entry"]["section"] }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-inset)] px-xs py-3xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-secondary)]">
      {SECTION_LABEL[section]}
    </span>
  );
}

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  hits: SearchHit[];
  onFocus: () => void;
  listId: string;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  placeholder: string;
  label: string;
  /** Open a hit. The caller decides: the router, or a state change. */
  onOpen: (hit: SearchHit) => void;
  showShortcut?: boolean;
};

export function SupportSearchField({
  value,
  onChange,
  hits,
  onFocus,
  listId,
  activeIndex,
  setActiveIndex,
  placeholder,
  label,
  onOpen,
  showShortcut = true,
}: FieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  /* "/" focuses the field, the way every documentation site does. It never
     steals the key from a field somebody is already typing in. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      event.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && hits.length > 0) {
      event.preventDefault();
      setActiveIndex((activeIndex + 1) % hits.length);
    } else if (event.key === "ArrowUp" && hits.length > 0) {
      event.preventDefault();
      setActiveIndex((activeIndex - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter" && hits.length > 0) {
      event.preventDefault();
      const hit = hits[Math.max(0, activeIndex)];
      if (hit) onOpen(hit);
    } else if (event.key === "Escape" && value) {
      event.preventDefault();
      onChange("");
    }
  };

  return (
    <div className="relative">
      <UiIcon
        name="search"
        size={20}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--nf-content-muted)]"
      />
      <input
        ref={ref}
        type="search"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 && hits[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(0);
        }}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="nf-field ps-[calc(0.875rem+1.25rem+var(--nf-gap-row))] pe-2xl"
      />
      {showShortcut && !value && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--nf-border-subtle)] px-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)] sm:block"
        >
          /
        </kbd>
      )}
    </div>
  );
}

type ResultsProps = {
  hits: SearchHit[];
  listId: string;
  activeIndex: number;
  /** Help answers open in place when the list is inline. */
  inline?: boolean;
  onNavigate?: () => void;
};

export function SupportResults({ hits, listId, activeIndex, inline = false, onNavigate }: ResultsProps) {
  return (
    <ul id={listId} role="listbox" aria-label="Search results" className="space-y-row">
      {hits.map((hit, i) => {
        const active = i === activeIndex;
        const id = `${listId}-${i}`;
        const common = active ? "ring-2 ring-[var(--nf-brand-primary)]" : "";
        if (inline && hit.entry.section === "help") {
          return (
            <li key={hit.entry.id} id={id} role="option" aria-selected={active}>
              <details className={`nf-panel nf-panel--card nf-m-details group block p-0 ${common}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-row p-card-sm font-semibold leading-snug [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 flex-col items-start gap-2xs">
                    <SectionChip section="help" />
                    <span>{hit.entry.title}</span>
                  </span>
                  <UiIcon name="chevron-down" size={20} className="nf-m-chevron shrink-0 text-[var(--nf-content-muted)]" />
                </summary>
                <p className="max-w-measure-body px-group pb-group text-[length:var(--nf-text-row)] leading-[1.6] text-[var(--nf-content-secondary)] sm:px-heading sm:pb-heading">
                  {hit.entry.text}
                </p>
              </details>
            </li>
          );
        }
        return (
          <li key={hit.entry.id} id={id} role="option" aria-selected={active}>
            <Link
              href={hit.entry.href}
              onClick={onNavigate}
              className={`nf-panel nf-panel--card nf-tap block p-card-sm hover:underline-offset-4 ${common}`}
            >
              <span className="flex flex-wrap items-center gap-inline">
                <SectionChip section={hit.entry.section} />
                <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{hit.entry.trail}</span>
              </span>
              <span className="mt-2xs block font-semibold leading-snug">{hit.entry.title}</span>
              {hit.snippet && (
                <span className="mt-2xs block text-[length:var(--nf-text-row)] leading-[1.5] text-[var(--nf-content-secondary)]">
                  {hit.snippet}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NoResults({ failed }: { failed: boolean }) {
  return (
    <div className="nf-panel nf-panel--card block p-card text-center-lg">
      <h2 className="nf-h3">{failed ? "Search is not available right now" : "Nothing matches that yet"}</h2>
      <p className="mx-auto mt-inline max-w-[46ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {failed
          ? "Try again in a moment, or browse the topics and chapters."
          : "Try a shorter word, or ask us directly. A person reads every message."}
      </p>
      <p className="mt-heading">
        <Link href="/contact" className="font-semibold text-[var(--nf-content-link)] hover:underline">
          Contact support
        </Link>
      </p>
    </div>
  );
}

/**
 * The compact search for the Docs frame: the field, and a panel of results
 * that opens under it. Choosing a result navigates and closes the panel.
 */
export function DocsSearch() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { hits, loading, failed, load } = useSupportSearch(query);
  const open = query.trim().length > 0;

  const go = (hit: SearchHit) => {
    setQuery("");
    router.push(hit.entry.href);
  };

  return (
    <div className="mx-auto mb-heading max-w-6xl">
      <SupportSearchField
        value={query}
        onChange={setQuery}
        hits={hits}
        onFocus={load}
        listId={listId}
        activeIndex={active}
        setActiveIndex={setActive}
        placeholder="Search the docs, help and guides, e.g. is Vallo free"
        label="Search documentation, help, guides and policies"
        onOpen={go}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {open && !loading ? `${hits.length} results` : ""}
      </p>
      {open && (
        <div className="mt-row">
          {loading ? (
            <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">Searching...</p>
          ) : hits.length > 0 ? (
            <SupportResults hits={hits.slice(0, 8)} listId={listId} activeIndex={active} onNavigate={() => setQuery("")} />
          ) : (
            <NoResults failed={failed} />
          )}
        </div>
      )}
    </div>
  );
}
