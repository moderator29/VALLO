"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { LogoWordmark, wordmarkWidth } from "@/design-system/brand/Logo";
import { banner } from "@/lib/ui/toast";
import {
  INTEL_PATH,
  IntelFetchError,
  clearRecentSearches,
  fetchDiscover,
  fetchSearch,
  intelHref,
  parseIntelUrl,
  removeRecentSearch,
  searchKey,
  sendIntelEvent,
  withFilters,
  withoutFilters,
  type IntelUrlState,
} from "@/lib/intelligence/client";
import type { DiscoverResponse, IntelligenceResult, IntelligenceTab, SearchResponse, Suggestion } from "@/lib/intelligence/contract";
import { IntelField } from "./IntelField";
import { IntelDiscover, type DiscoverView } from "./IntelDiscover";
import { IntelCategory, IntelCategoryBody } from "./IntelCategory";
import { IntelResults, type SearchView } from "./IntelResults";
import { IntelFilters } from "./IntelFilters";
import { IntelAssist } from "./IntelAssist";
import { Aurora } from "./IntelArt";
import { isExploreTab, mayAskModel, understoodChips, type ExploreTab, type IntelligenceCopy } from "./model";
import { runFlow, useOnline, usePastTop } from "./use-intel";
import "./intelligence.css";

/**
 * WHAT A VISIT KEPT, FOR THE WAY BACK. Module state, so it lives exactly as
 * long as this tab's app does: open a result, press Back, and the same
 * results draw at once at the same scroll, with no wait and no second read.
 * Nothing is stored on the device. Written only in the browser (effects and
 * handlers), so the server never shares it between people.
 */
type Kept = { data: SearchResponse; more: IntelligenceResult[]; next?: string; scrollY?: number };
const KEPT = new Map<string, Kept>();
const KEPT_MAX = 12;
let keptDiscover: DiscoverResponse | null = null;

function keep(key: string, value: Kept) {
  KEPT.delete(key);
  KEPT.set(key, value);
  while (KEPT.size > KEPT_MAX) KEPT.delete(KEPT.keys().next().value!);
}

/** The analytics route is live (POST /api/intelligence/event); flip off to silence it. */
const EVENTS_LIVE = true;

/** The tile a category grows out of, and the header it grows into. */
const tileOf = (tab: IntelligenceTab) => document.querySelector<HTMLElement>(`[data-intel-tile="${tab}"]`);
const catheadOf = () => document.querySelector<HTMLElement>("[data-intel-cathead]");

/** Where the discovery home was scrolled to when a category opened, for the way back. */
let homeScrollY = 0;

/**
 * VALLO INTELLIGENCE, THE SCREEN (the founder's direction, 16 November 2026).
 *
 * One wide field over everything Vallo holds. Empty, it is a quiet discovery
 * page; typing, a grouped list of suggestions; submitted, the results with
 * what was understood, per kind. Built against `lib/intelligence/contract.ts`
 * only, through `lib/intelligence/client.ts`.
 *
 * The address is the state (`client.ts` says how), changed with the History
 * API so a refinement costs no server round trip, and read back on Back.
 */
export function IntelligenceScreen({
  copy,
  locale,
  signedIn,
  greeting = null,
  initial,
  focusOnOpen = false,
}: {
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  /** "Good morning, Ada.", for a member with a first name; null for everyone else. */
  greeting?: string | null;
  initial: IntelUrlState;
  /** Arrived from a search launcher (Home, Cmd/Ctrl+K): the caret goes straight to the field. */
  focusOnOpen?: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<IntelUrlState>(initial);
  const [input, setInput] = useState(initial.q);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const online = useOnline();
  const [assistOpen, setAssistOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const key = searchKey(url);
  const keyRef = useRef(key);
  const urlRef = useRef(url);
  useEffect(() => {
    keyRef.current = key;
    urlRef.current = url;
  }, [key, url]);
  /* The category page was opened from a tile on this visit, so its own back is the browser's. */
  const pushedCategory = useRef(false);

  /* -------------------------------------------------------- the address */
  const navigate = useCallback((next: IntelUrlState, options: { replace?: boolean } = {}) => {
    const href = intelHref(next);
    try {
      if (options.replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    } catch {
      /* A sandboxed frame: the screen still changes. */
    }
    setUrl((prev) => {
      if (prev.q !== next.q) window.scrollTo({ top: 0 });
      return next;
    });
    setInput(next.q);
  }, []);

  /* A server render with other words (a link to /intelligence from elsewhere):
     adopted while rendering, React's pattern for state that follows a prop. */
  const initialKey = searchKey(initial);
  const [adopted, setAdopted] = useState(initialKey);
  if (initialKey !== adopted) {
    setAdopted(initialKey);
    setUrl(initial);
    setInput(initial.q);
  }

  /* Back and Forward through the searches this screen pushed. */
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname !== INTEL_PATH) return;
      const next = parseIntelUrl(new URLSearchParams(window.location.search));
      const prev = urlRef.current;
      const apply = () => {
        setUrl(next);
        setInput(next.q);
      };
      /* Between the home and a category's page: the header folds back into its tile (or out of it, going forward). */
      if (!prev.q && !next.q && prev.tab !== next.tab) {
        const closing = prev.tab !== "all" && next.tab === "all";
        if (closing) pushedCategory.current = false;
        runFlow(
          () => {
            apply();
            window.scrollTo({ top: closing ? homeScrollY : 0 });
          },
          closing ? catheadOf() : tileOf(next.tab),
          () => (closing ? tileOf(prev.tab) : catheadOf()),
        );
        return;
      }
      apply();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* Arrived from a launcher: drop `focus=1` from the address so Back and a reload do not refocus. */
  useEffect(() => {
    if (!focusOnOpen) return;
    try {
      window.history.replaceState(null, "", intelHref(parseIntelUrl(new URLSearchParams(window.location.search))));
    } catch {
      /* Nothing to tidy. */
    }
  }, [focusOnOpen]);

  /* Cmd/Ctrl+K on this screen puts the caret in the field. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------- the empty page */
  const [discover, setDiscover] = useState<DiscoverView>(() => (keptDiscover ? { status: "ready", data: keptDiscover } : { status: "loading" }));
  const discoverTick = useRef(0);
  useEffect(() => {
    if (url.q || keptDiscover) return;
    const controller = new AbortController();
    const mine = ++discoverTick.current;
    fetchDiscover(controller.signal)
      .then((data) => {
        if (mine !== discoverTick.current) return;
        keptDiscover = data;
        setDiscover({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError" || mine !== discoverTick.current) return;
        setDiscover({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [url.q]);

  /* ------------------------------------------------------------ results */
  /* The last answer, for the search it answered. What is on screen is derived
     from it, the visit's keep and the connection, so a newer search never
     shows an older answer. */
  const [answer, setAnswer] = useState<{ key: string; view: SearchView } | null>(null);
  const searchSeq = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  /* The search the person just submitted: its first read says so (`submit=1`). */
  const submitted = useRef<string | null>(null);
  /* The same, kept for drawing: the model's "Reading your words" line and the
     chips' flight from the words both belong to a search just submitted, never
     to a tab switch, a chip removed or a way Back. */
  const [asked, setAsked] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const kept = url.q ? KEPT.get(key) : undefined;
  const view: SearchView =
    answer && answer.key === key && !(answer.view.status === "offline" && online)
      ? answer.view
      : kept
        ? { status: "ready", data: kept.data, more: kept.more, next: kept.next, loadingMore: false }
        : !online
          ? { status: "offline" }
          : { status: "loading" };

  useEffect(() => {
    const state = parseIntelUrl(new URLSearchParams(key));
    if (!state.q) {
      searchSeq.current += 1;
      searchController.current?.abort();
      return;
    }
    const keptNow = KEPT.get(key);
    if (keptNow) {
      /* Back from a result: the same results, at the same place. */
      if (keptNow.scrollY !== undefined) {
        const y = keptNow.scrollY;
        keptNow.scrollY = undefined;
        window.requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
      return;
    }
    if (!online) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const mine = ++searchSeq.current;
    const submit = submitted.current === key;
    submitted.current = null;
    fetchSearch(state, undefined, controller.signal, { submit })
      .then((data) => {
        if (mine !== searchSeq.current) return;
        keep(key, { data, more: [], next: data.next });
        setAnswer({ key, view: { status: "ready", data, more: [], next: data.next, loadingMore: false } });
      })
      .catch((error: unknown) => {
        if (mine !== searchSeq.current || (error as { name?: string })?.name === "AbortError") return;
        setAnswer({ key, view: { status: error instanceof IntelFetchError && error.offline ? "offline" : "error" } });
      });
  }, [key, retry, online]);

  const onRetry = () => {
    KEPT.delete(key);
    setAnswer(null);
    setRetry((n) => n + 1);
  };

  const onShowMore = () => {
    if (view.status !== "ready" || !view.next || view.loadingMore) return;
    const startedFor = key;
    const cursor = view.next;
    const base = view;
    setAnswer({ key, view: { ...base, loadingMore: true } });
    fetchSearch(url, cursor)
      .then((page) => {
        if (keyRef.current !== startedFor) return;
        const seen = new Set([...base.data.results, ...base.more].map((r) => r.key));
        const more = [...base.more, ...page.results.filter((r) => !seen.has(r.key))];
        keep(startedFor, { data: base.data, more, next: page.next });
        setAnswer({ key: startedFor, view: { ...base, more, next: page.next, loadingMore: false } });
      })
      .catch(() => {
        if (keyRef.current !== startedFor) return;
        setAnswer({ key: startedFor, view: { ...base, loadingMore: false } });
        banner.error(copy.errorTitle);
      });
  };

  /* --------------------------------------------------------------- acts */
  /* A search the person asked for: a submitted search, so its first read says so. */
  const runState = useCallback(
    (next: IntelUrlState) => {
      submitted.current = searchKey(next);
      setAsked(searchKey(next));
      navigate(next);
      try {
        if (window.matchMedia("(pointer: coarse)").matches) inputRef.current?.blur();
      } catch {
        /* Keep the caret. */
      }
    },
    [navigate],
  );
  const runQuery = useCallback((q: string) => runState({ q, tab: url.tab, filters: {}, drop: [] }), [runState, url.tab]);

  const onPick = (suggestion: Suggestion) => {
    if (suggestion.href) {
      if (suggestion.href.startsWith(`${INTEL_PATH}?`)) {
        navigate(parseIntelUrl(new URLSearchParams(suggestion.href.slice(INTEL_PATH.length + 1))));
      } else {
        router.push(suggestion.href);
      }
      return;
    }
    if (suggestion.query) runQuery(suggestion.query);
  };

  const onOpen = (result: IntelligenceResult, position: number) => {
    const kept = KEPT.get(key);
    if (kept) kept.scrollY = window.scrollY;
    if (EVENTS_LIVE) sendIntelEvent({ event: "click", q: url.q, tab: url.tab, kind: result.kind, position });
  };

  const onRemoveRecent = (q: string) => {
    if (discover.status !== "ready") return;
    const before = discover.data;
    const after = { ...before, recent: before.recent.filter((r) => r.query !== q) };
    keptDiscover = after;
    setDiscover({ status: "ready", data: after });
    void removeRecentSearch(q).then((ok) => {
      if (ok) return;
      keptDiscover = before;
      setDiscover({ status: "ready", data: before });
      banner.error(copy.recent.removeFailed);
    });
  };

  const onClearRecent = () => {
    if (discover.status !== "ready") return;
    const before = discover.data;
    const after = { ...before, recent: [] };
    keptDiscover = after;
    setDiscover({ status: "ready", data: after });
    void clearRecentSearches().then((ok) => {
      if (ok) {
        banner.success(copy.recent.cleared);
        return;
      }
      keptDiscover = before;
      setDiscover({ status: "ready", data: before });
      banner.error(copy.recent.removeFailed);
    });
  };

  /* ------------------------------------------------- the category pages */
  const openCategory = (tab: ExploreTab, tile: HTMLElement) => {
    homeScrollY = window.scrollY;
    runFlow(
      () => {
        navigate({ q: "", tab, filters: {}, drop: [] });
        pushedCategory.current = true;
        window.scrollTo({ top: 0 });
      },
      tile,
      catheadOf,
    );
  };

  const closeCategory = () => {
    if (pushedCategory.current) {
      /* Opened from a tile: the browser's own Back, so the history stays one step. */
      window.history.back();
      return;
    }
    const from = url.tab;
    runFlow(
      () => {
        navigate({ ...url, tab: "all" }, { replace: true });
        window.scrollTo({ top: 0 });
      },
      catheadOf(),
      () => tileOf(from),
    );
  };

  /* ------------------------------------------------------------ drawing */
  const empty = !url.q;
  const category = empty && isExploreTab(url.tab) ? url.tab : null;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const condensed = usePastTop(sentinelRef);
  const data = view.status === "ready" ? view.data : null;
  const chips = useMemo(() => (data ? understoodChips(data.understood, copy, locale, url.tab) : []), [data, copy, locale, url.tab]);
  const examples = category ? copy.category.examples[category] : copy.examples;
  /* Honest thinking: only while a just-submitted search waits, and only when
     the engine may be handing the words to the model (`mayAskModel`). */
  const thinking = view.status === "loading" && asked === key && Boolean(url.q) && mayAskModel(url.q);
  const headerRef = useRef<HTMLElement | null>(null);
  const pastTop = usePastTop(headerRef);
  const drawerCurrent = { ...(data?.understood ?? {}), ...url.filters };

  return (
    <div className="nf-intel" data-state={category ? "category" : empty ? "empty" : "results"} data-testid="intel-screen">
      <header className="nf-intel-top" ref={headerRef}>
        <span className="nf-intel-top__brand">
          <LogoWordmark width={wordmarkWidth(15)} height={15} className="nf-intel-top__word" />
          <span className="sr-only">{copy.wordmark}</span>
        </span>
        <button
          type="button"
          className="nf-intel-spark"
          aria-haspopup="dialog"
          aria-expanded={assistOpen}
          aria-label={copy.assist.openLabel}
          onClick={() => setAssistOpen(true)}
          data-testid="intel-assist-open"
        >
          <UiIcon name="spark" size={18} />
          <span>{copy.assist.open}</span>
        </button>
      </header>

      {category ? (
        <IntelCategory tab={category} view={discover} copy={copy} locale={locale} onBack={closeCategory} />
      ) : empty ? (
        <div className="nf-intel-hero" data-testid="intel-hero">
          <Aurora />
          {greeting ? (
            <p className="nf-intel-hero__greet" data-testid="intel-greeting">
              {greeting}
            </p>
          ) : null}
          <h1 className="nf-intel-hero__title">{copy.title}</h1>
          <p className="nf-intel-hero__lede">{copy.lede}</p>
        </div>
      ) : (
        <h1 className="sr-only">{copy.name}</h1>
      )}

      {/* The field sticks under the top of the screen and condenses once the page moves under it. */}
      <div className="nf-intel-sentinel" ref={sentinelRef} aria-hidden="true" />
      <div className="nf-intel-dock" data-condensed={condensed ? "true" : undefined} data-intel-flow-field="" data-testid="intel-dock">
        <IntelField
          copy={copy}
          value={input}
          onValueChange={setInput}
          onSubmit={runQuery}
          onPick={onPick}
          tab={url.tab}
          inputRef={inputRef}
          examples={examples}
          autoFocus={focusOnOpen}
        />
      </div>

      {thinking ? (
        <div className="nf-intel-thinking" role="status" data-testid="intel-thinking">
          <span className="nf-intel-thinking__beam" aria-hidden="true" />
          <span className="nf-intel-thinking__step">
            <UiIcon name="spark" size={14} />
            {copy.thinking.reading}
          </span>
        </div>
      ) : null}

      {category ? (
        <IntelCategoryBody
          tab={category}
          view={discover}
          copy={copy}
          locale={locale}
          signedIn={signedIn}
          url={url}
          runQuery={runQuery}
          onSearch={runState}
        />
      ) : empty ? (
        <IntelDiscover
          view={discover}
          copy={copy}
          locale={locale}
          signedIn={signedIn}
          url={url}
          runQuery={runQuery}
          onChooseCategory={openCategory}
          onRemoveRecent={onRemoveRecent}
          onClearRecent={onClearRecent}
        />
      ) : (
        <IntelResults
          url={url}
          view={view}
          copy={copy}
          locale={locale}
          signedIn={signedIn}
          navigate={navigate}
          onShowMore={onShowMore}
          onRetry={onRetry}
          onOpenFilters={() => setFiltersOpen(true)}
          onOpen={onOpen}
          fieldRef={inputRef}
          flyChipsFor={asked === key ? key : null}
        />
      )}

      {/* On a phone, once the header has scrolled away: the panel, one tap up. */}
      <button
        type="button"
        className="nf-intel-askpill"
        data-shown={pastTop && !assistOpen && !filtersOpen ? "true" : undefined}
        aria-hidden={pastTop ? undefined : true}
        tabIndex={pastTop ? undefined : -1}
        onClick={() => setAssistOpen(true)}
        data-testid="intel-askpill"
      >
        <UiIcon name="spark" size={16} />
        <span>{copy.askPill}</span>
      </button>

      <IntelFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        tab={url.tab}
        current={drawerCurrent}
        copy={copy}
        onApply={(set, cleared) => navigate(withFilters(withoutFilters(url, cleared.filter((k) => drawerCurrent[k] !== undefined)), set))}
      />
      <IntelAssist
        open={assistOpen}
        onOpenChange={setAssistOpen}
        copy={copy}
        q={url.q}
        chips={chips}
        results={data ? [...data.results, ...(data.groups ?? []).flatMap((g) => g.results)] : []}
        place={data?.understood.place}
        alternatives={data?.alternatives}
        runQuery={runQuery}
      />
    </div>
  );
}
