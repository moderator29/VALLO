"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { formatNumber, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { State } from "@/components/ui/State";
import { motionQuiet } from "@/lib/motion/gate";
import { Skeleton } from "@/components/ui/Skeleton";
import { ResultListSkeleton } from "@/components/app/search/ResultSkeleton";
import {
  clearedFilters,
  filtersFrom,
  intelHref,
  isTab,
  withFilters,
  withoutFilters,
  type IntelUrlState,
} from "@/lib/intelligence/client";
import type { IntelligenceKind, IntelligenceResult, IntelligenceTab, SearchResponse } from "@/lib/intelligence/contract";
import { IntelResultItem, listClassFor } from "./IntelResultItem";
import { OpenDoor } from "./IntelArt";
import { CHIP_ICON, fill, lagosToday, propertiesSearchHref, refineChips, understoodChips, wordOrigin, type IntelligenceCopy } from "./model";
import "@/components/ui/underline-tabs.css";

export type SearchView =
  | { status: "loading" }
  | { status: "error" }
  | { status: "offline" }
  | { status: "ready"; data: SearchResponse; more: IntelligenceResult[]; next?: string; loadingMore: boolean };

/** Tabs with filters in the drawer; the rest have nothing to narrow. */
export const FILTERABLE_TABS: readonly IntelligenceTab[] = ["all", "property", "stay", "restaurant", "roommate", "person", "community"];

/** A link that is also a client navigation: a plain click stays on the page, a new-tab click still opens a tab. */
function plainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

function RowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="nf-intel-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="nf-intel-row nf-intel-row--skeleton">
          <span className="nf-intel-row__link">
            <Skeleton width="3rem" height="3rem" radius="md" />
            <span className="nf-intel-row__text">
              <Skeleton width="58%" height="0.9375rem" radius="xs" />
              <Skeleton width="36%" height="0.75rem" radius="xs" />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The wait, in the shape of the tab that is coming. */
export function ResultsSkeleton({ tab }: { tab: IntelligenceTab }) {
  if (tab === "property" || tab === "stay") return <ResultListSkeleton count={3} />;
  if (tab === "all") {
    return (
      <div className="nf-intel-groups">
        <RowsSkeleton count={2} />
        <ResultListSkeleton count={1} />
        <RowsSkeleton count={2} />
      </div>
    );
  }
  return <RowsSkeleton />;
}

/**
 * THE RESULTS UNDER THE FIELD: what was understood, a spelling offered, a
 * question when the words were unclear, the tabs, then the results, drawn
 * per kind. Every change here is a new address (`navigate`), so Back walks
 * each one and a reload lands on the same screen.
 */
export function IntelResults({
  url,
  view,
  copy,
  locale,
  signedIn,
  navigate,
  onShowMore,
  onRetry,
  onOpenFilters,
  onOpen,
  fieldRef,
  flyChipsFor = null,
}: {
  url: IntelUrlState;
  view: SearchView;
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  navigate: (next: IntelUrlState) => void;
  onShowMore: () => void;
  onRetry: () => void;
  onOpenFilters: () => void;
  onOpen: (result: IntelligenceResult, position: number) => void;
  /** The field, so the understood chips can rise from the words they were read from. */
  fieldRef?: RefObject<HTMLInputElement | null>;
  /** The search key whose chips should fly in (a search just submitted), or null. */
  flyChipsFor?: string | null;
}) {
  const [keptSpelling, setKeptSpelling] = useState<string | null>(null);
  const chipRow = useRef<HTMLUListElement | null>(null);
  const flown = useRef<string | null>(null);
  const ready = view.status === "ready" ? view.data : null;

  /* THE SIGNATURE MOMENT: the chips come out of the sentence. Each one starts
     at the word it was read from (measured in the field's own font) and
     settles into its place, 30ms apart, in the base duration on the entrance
     curve (both read from the tokens). Transform and opacity only, once per
     submitted search, never for a reader who asked for less motion. */
  useLayoutEffect(() => {
    if (!ready || !flyChipsFor || flown.current === flyChipsFor) return;
    const row = chipRow.current;
    const input = fieldRef?.current;
    if (!row || !input) return;
    flown.current = flyChipsFor;
    if (motionQuiet() || typeof row.animate !== "function") return;
    flyChips(row, input, ready.understood);
  }, [ready, flyChipsFor, fieldRef]);

  if (view.status === "offline") {
    return (
      <State
        kind="offline"
        title={copy.offlineTitle}
        body={copy.offlineBody}
        action={
          <Button variant="secondary" leadingIcon="repost-loop" onClick={onRetry} data-testid="intel-retry">
            {copy.retry}
          </Button>
        }
        data-testid="intel-offline"
      />
    );
  }
  if (view.status === "error") {
    return (
      <State
        kind="error"
        title={copy.errorTitle}
        body={copy.errorBody}
        action={
          <Button variant="secondary" leadingIcon="repost-loop" onClick={onRetry} data-testid="intel-retry">
            {copy.retry}
          </Button>
        }
        data-testid="intel-error"
      />
    );
  }
  if (view.status === "loading") {
    return (
      <div className="nf-intel-results" aria-busy="true" data-testid="intel-loading">
        <span className="sr-only" role="status">
          {copy.loading}
        </span>
        <ResultsSkeleton tab={url.tab} />
      </div>
    );
  }

  const { data } = view;
  const understood = data.understood;
  const chips = understoodChips(understood, copy, locale, url.tab);
  const showing = data.showing ?? null;
  const dym = !showing && understood.didYouMean && understood.didYouMean !== keptSpelling ? understood.didYouMean : null;
  const tabs = data.tabs.filter((t) => isTab(t.tab));
  const showTabs = tabs.length > 1 || (tabs.length === 1 && tabs[0]!.tab !== "all");
  const results = [...data.results, ...view.more];
  const groups = url.tab === "all" ? (data.groups ?? []).filter((g) => g.results.length > 0) : [];
  const nothing = results.length === 0 && groups.length === 0;
  const tabKinds = new Set(tabs.map((t) => t.tab));

  const go = (next: IntelUrlState) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    navigate(next);
  };

  /* Each result's place in what the person sees, from 1, in drawing order. */
  const shown = groups.length > 0 ? groups.flatMap((g) => g.results) : results;
  const positions = new Map(shown.map((r, i) => [r.key, i + 1] as const));
  const item = (result: IntelligenceResult, eager = false, grouped = false) => (
    <IntelResultItem
      key={result.key}
      result={result}
      position={positions.get(result.key) ?? 0}
      copy={copy}
      locale={locale}
      signedIn={signedIn}
      onOpen={onOpen}
      eager={eager}
      grouped={grouped}
    />
  );

  return (
    <div className="nf-intel-results" data-testid="intel-results">
      {/* ------------------------------------------- Search understood */}
      {chips.length > 0 ? (
        <section className="nf-intel-understood" aria-labelledby="intel-understood" data-testid="intel-understood">
          <div className="nf-intel-understood__head">
            <h2 id="intel-understood" className="nf-intel-overline">
              {copy.understood.title}
            </h2>
            {understood.via === "model" ? (
              <span className="nf-intel-readby" data-testid="intel-read-by-model">
                <UiIcon name="spark" size={12} />
                {copy.thinking.readBy}
              </span>
            ) : null}
          </div>
          <ul className="nf-intel-chiprow" role="list" ref={chipRow}>
            {chips.map((chip) => (
              <li key={chip.id} data-chip={chip.id}>
                <button
                  type="button"
                  className="nf-chip nf-chip--active nf-intel-chip nf-intel-chip--read"
                  aria-label={fill(copy.understood.remove, { filter: chip.label })}
                  data-testid={`intel-chip-${chip.id}`}
                  onClick={() => navigate(withoutFilters(url, chip.keys))}
                >
                  <UiIcon name={CHIP_ICON[chip.id] ?? "check"} size={14} className="nf-intel-chip__glyph" />
                  <span>{chip.label}</span>
                  <UiIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="nf-intel-understood__acts">
            {FILTERABLE_TABS.includes(url.tab) ? (
              <button type="button" className="nf-intel-textbtn" onClick={onOpenFilters} data-testid="intel-edit-filters">
                <UiIcon name="sliders" size={16} />
                {copy.understood.edit}
              </button>
            ) : null}
            <button
              type="button"
              className="nf-intel-textbtn"
              aria-label={copy.understood.clearLabel}
              onClick={() => navigate(clearedFilters(url, understood))}
              data-testid="intel-clear-filters"
            >
              {copy.understood.clear}
            </button>
          </div>
        </section>
      ) : FILTERABLE_TABS.includes(url.tab) ? (
        <div className="nf-intel-understood__acts nf-intel-understood__acts--alone">
          <button type="button" className="nf-intel-textbtn" onClick={onOpenFilters} data-testid="intel-edit-filters">
            <UiIcon name="sliders" size={16} />
            {copy.filters.open}
          </button>
        </div>
      ) : null}

      {/* ------------------------------------------------ did you mean */}
      {dym ? (
        <p className="nf-intel-dym" data-testid="intel-dym">
          <span>{fill(copy.didYouMean.question, { query: dym })}</span>
          <a
            href={intelHref({ ...url, q: dym, filters: {}, drop: [] })}
            className="nf-intel-textbtn nf-intel-textbtn--lit"
            onClick={go({ ...url, q: dym, filters: {}, drop: [] })}
            data-testid="intel-dym-accept"
          >
            {fill(copy.didYouMean.accept, { query: dym })}
          </a>
          <button type="button" className="nf-intel-textbtn" onClick={() => setKeptSpelling(dym)} data-testid="intel-dym-keep">
            {fill(copy.didYouMean.keep, { query: understood.raw || url.q })}
          </button>
        </p>
      ) : null}

      {/* ------------------------------- the engine searched its fix instead */}
      {showing ? (
        <p className="nf-intel-dym" data-testid="intel-showing">
          <span>{fill(copy.showing.line, { query: showing.query })}</span>
          <a
            href={intelHref({ ...url, drop: [...new Set([...url.drop, "didYouMean" as const])] })}
            className="nf-intel-textbtn nf-intel-textbtn--lit"
            onClick={go({ ...url, drop: [...new Set([...url.drop, "didYouMean" as const])] })}
            data-testid="intel-showing-instead"
          >
            {fill(copy.showing.instead, { query: showing.insteadOf })}
          </a>
        </p>
      ) : null}

      {/* ------------------------------------------------------ clarify */}
      {understood.clarify && understood.clarify.options.length > 0 ? (
        <section className="nf-intel-clarify" aria-labelledby="intel-clarify" data-testid="intel-clarify">
          <p className="nf-intel-overline">{copy.clarifyLabel}</p>
          <h2 id="intel-clarify" className="nf-intel-clarify__q">
            {understood.clarify.question}
          </h2>
          <div className="nf-intel-chiprow">
            {understood.clarify.options.map((option) => {
              const patch = option.patch ?? {};
              const kindTab = patch.kind && isTab(patch.kind) ? patch.kind : null;
              const next = withFilters({ ...url, ...(kindTab ? { tab: kindTab } : {}) }, filtersFrom(patch));
              return (
                <a key={option.label} href={intelHref(next)} className="nf-chip nf-intel-chip" onClick={go(next)} data-testid="intel-clarify-option">
                  {option.label}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- tabs */}
      {showTabs ? (
        <nav aria-label={copy.tabsLabel} className="nf-utabs nf-intel-tabs" data-testid="intel-tabs">
          <ul className="nf-utabs__row" role="list">
            {tabs.map((t) => {
              const next: IntelUrlState = { ...url, tab: t.tab };
              return (
                <li key={t.tab}>
                  <a
                    href={intelHref(next)}
                    className="nf-utabs__tab"
                    aria-current={t.tab === url.tab ? "page" : undefined}
                    data-testid={`intel-tab-${t.tab}`}
                    onClick={go(next)}
                  >
                    {copy.tabs[t.tab]}
                    {typeof t.count === "number" ? <span className="nf-utabs__count nf-numeric">{formatNumber(t.count, locale)}</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {data.partial ? (
        <p className="nf-intel-note" role="status" data-testid="intel-partial">
          <UiIcon name="info" size={16} />
          {copy.partial}
        </p>
      ) : null}

      {/* ------------------------------------------------------ results */}
      {nothing ? (
        <NoResults url={url} data={data} copy={copy} navigate={navigate} />
      ) : groups.length > 0 ? (
        <div className="nf-intel-groups nf-intel-fade" key={`${url.q}|${url.tab}`}>
          {groups.map((group, gi) => {
            const kind = group.kind;
            const asTab = isTab(kind) && tabKinds.has(kind as IntelligenceTab) ? (kind as IntelligenceTab) : null;
            const seeAllNext: IntelUrlState | null = asTab ? { ...url, tab: asTab } : null;
            return (
              <section key={kind} className="nf-intel-group" aria-labelledby={`intel-g-${kind}`} data-testid={`intel-group-${kind}`}>
                <div className="nf-intel-head">
                  <h2 id={`intel-g-${kind}`} className="nf-intel-overline">
                    {copy.kinds[kind]}
                  </h2>
                  {seeAllNext ? (
                    <a
                      href={intelHref(seeAllNext)}
                      className="nf-intel-textbtn nf-intel-textbtn--lit"
                      aria-label={fill(copy.seeAllLabel, { kind: copy.kinds[kind] })}
                      onClick={go(seeAllNext)}
                    >
                      {copy.seeAll}
                    </a>
                  ) : group.more ? (
                    <Link href={group.more} className="nf-intel-textbtn nf-intel-textbtn--lit" aria-label={fill(copy.seeAllLabel, { kind: copy.kinds[kind] })}>
                      {copy.seeAll}
                    </Link>
                  ) : null}
                </div>
                <ul className={`${listClassFor(kind)} nf-arrive-list`} role="list">
                  {group.results.map((r, i) => item(r, gi === 0 && i === 0, true))}
                </ul>
                {kind === "property" ? <SeeAllProperties url={url} data={data} copy={copy} /> : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="nf-intel-fade" key={`${url.q}|${url.tab}`}>
          {url.tab === "personal" ? <p className="nf-intel-overline">{copy.yours}</p> : null}
          <FlatList results={results} tab={url.tab} item={item} />
          {url.tab === "property" ? <SeeAllProperties url={url} data={data} copy={copy} /> : null}
        </div>
      )}

      {/* ------------------------------------------------------- refine */}
      {!nothing ? <Refine url={url} data={data} copy={copy} locale={locale} navigate={navigate} /> : null}

      {view.next ? (
        <div className="nf-intel-more">
          <Button variant="secondary" full loading={view.loadingMore} onClick={onShowMore} data-testid="intel-show-more">
            {view.loadingMore ? copy.loadingMore : copy.showMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * QUICK REFINEMENTS, from what this search understood (`refineChips`): a
 * bigger budget, one more bedroom, the whole city, this weekend. Each is a
 * new address with that filter set, so Back undoes it.
 */
function Refine({
  url,
  data,
  copy,
  locale,
  navigate,
}: {
  url: IntelUrlState;
  data: SearchResponse;
  copy: IntelligenceCopy;
  locale: Locale;
  navigate: (next: IntelUrlState) => void;
}) {
  const chips = refineChips({ ...data.understood, ...url.filters }, url.tab, lagosToday(), copy, locale);
  if (chips.length === 0) return null;
  return (
    <section className="nf-intel-refine" aria-labelledby="intel-refine" data-testid="intel-refine">
      <h2 id="intel-refine" className="nf-intel-overline">
        {copy.refine.title}
      </h2>
      <ul className="nf-intel-chiprow nf-intel-chiprow--rail" role="list">
        {chips.map((chip) => {
          const next = withFilters(url, chip.set);
          return (
            <li key={chip.id}>
              <a
                href={intelHref(next)}
                className="nf-chip nf-intel-chip nf-intel-chip--refine"
                data-testid={`intel-refine-${chip.id}`}
                onClick={(event) => {
                  if (!plainClick(event)) return;
                  event.preventDefault();
                  navigate(next);
                }}
              >
                <UiIcon name={chip.icon} size={14} className="nf-intel-chip__glyph" />
                <span>{chip.label}</span>
                <UiIcon name="plus" size={14} className="nf-intel-chip__glyph" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A tab's results; on "all" without groups, runs of one kind are drawn together. */
function FlatList({
  results,
  tab,
  item,
}: {
  results: IntelligenceResult[];
  tab: IntelligenceTab;
  item: (result: IntelligenceResult, eager?: boolean) => ReactNode;
}) {
  const runs: { kind: IntelligenceKind; results: IntelligenceResult[] }[] = [];
  for (const result of results) {
    const last = runs[runs.length - 1];
    if (last && last.kind === result.kind) last.results.push(result);
    else runs.push({ kind: result.kind, results: [result] });
  }
  return (
    <div className="nf-intel-groups" data-tab={tab}>
      {runs.map((run, ri) => (
        <ul key={`${run.kind}-${ri}`} className={`${listClassFor(run.kind)} nf-arrive-list`} role="list">
          {run.results.map((r, i) => item(r, ri === 0 && i === 0))}
        </ul>
      ))}
    </div>
  );
}

function SeeAllProperties({ url, data, copy }: { url: IntelUrlState; data: SearchResponse; copy: IntelligenceCopy }) {
  return (
    <ButtonLink href={propertiesSearchHref(data.understood, url.q)} variant="secondary" size="sm" trailingIcon="arrow-right" className="nf-intel-seeall" data-testid="intel-see-all-properties">
      {copy.seeAllProperties}
    </ButtonLink>
  );
}

/** Nothing matched: a door left open, a warm line, the engine's real ways forward, then the catalogue. */
function NoResults({ url, data, copy, navigate }: { url: IntelUrlState; data: SearchResponse; copy: IntelligenceCopy; navigate: (next: IntelUrlState) => void }) {
  const alternatives = (data.alternatives ?? []).filter((a) => a.query || a.href);
  return (
    <div className="nf-intel-empty" role="status" data-testid="intel-empty">
      <OpenDoor />
      <p className="nf-intel-empty__title">{fill(copy.emptyTitle, { query: url.q })}</p>
      <p className="nf-intel-empty__warm">{copy.emptyWarm}</p>
      <p className="nf-intel-empty__body">{alternatives.length > 0 ? copy.emptyBody : copy.emptyNoAlternatives}</p>
      <div className="nf-intel-empty__acts">
        {alternatives.length > 0 ? (
          <ul className="nf-intel-chiprow nf-intel-chiprow--center" role="list">
            {alternatives.map((alt) => (
              <li key={`${alt.label}|${alt.query ?? alt.href}`}>
                {alt.query ? (
                  <a
                    href={intelHref({ ...url, q: alt.query, filters: {}, drop: [] })}
                    className="nf-chip nf-intel-chip"
                    data-testid="intel-alternative"
                    onClick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      navigate({ ...url, q: alt.query!, filters: {}, drop: [] });
                    }}
                  >
                    <UiIcon name="arrow-up-right" size={14} />
                    {alt.label}
                  </a>
                ) : (
                  <Link href={alt.href!} className="nf-chip nf-intel-chip" data-testid="intel-alternative">
                    <UiIcon name="arrow-up-right" size={14} />
                    {alt.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <ButtonLink href="/search" variant="secondary" data-testid="intel-browse-popular">
          {copy.browsePopular}
        </ButtonLink>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- the chips' flight */

function tokenMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** The x of a character in the field, in the page, measured in the field's own font. */
function caretX(input: HTMLInputElement, index: number): number {
  const box = input.getBoundingClientRect();
  if (index <= 0) return box.left;
  try {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (!measureCtx) return box.left;
    const style = getComputedStyle(input);
    measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = measureCtx.measureText(input.value.slice(0, index)).width;
    return Math.min(box.right - 8, box.left + width - input.scrollLeft);
  } catch {
    return box.left;
  }
}

function flyChips(row: HTMLUListElement, input: HTMLInputElement, understood: SearchResponse["understood"]) {
  const field = input.getBoundingClientRect();
  if (field.bottom < 0 || field.top > window.innerHeight) return;
  const duration = tokenMs("--nf-duration-base", 240);
  /* The fallback is the token's own value, never the browser's keyword. */
  const easing = getComputedStyle(document.documentElement).getPropertyValue("--nf-ease-entrance").trim() || "cubic-bezier(0.16, 1, 0.3, 1)";
  const items = [...row.querySelectorAll<HTMLLIElement>(":scope > li[data-chip]")];
  /* Read every box first, then write: one layout read, no thrash. */
  const plans = items.map((li) => {
    const box = li.getBoundingClientRect();
    const at = wordOrigin(input.value, li.dataset.chip ?? "", understood);
    const fromX = caretX(input, Math.max(0, at));
    const fromY = field.top + field.height / 2;
    return { li, dx: fromX - box.left, dy: fromY - (box.top + box.height / 2) };
  });
  plans.forEach(({ li, dx, dy }, i) => {
    /* Far away (the field scrolled off), a short rise reads better than a long flight. */
    const far = Math.abs(dy) > 320;
    li.animate(
      [
        { transform: far ? "translate3d(0, 12px, 0)" : `translate3d(${dx}px, ${dy}px, 0) scale(0.6)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration, delay: Math.min(i, 5) * 30, easing, fill: "backwards" },
    );
  });
}

