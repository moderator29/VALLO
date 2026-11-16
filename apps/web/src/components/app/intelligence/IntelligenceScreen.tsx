"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { LogoWordmark, wordmarkWidth } from "@/design-system/brand/Logo";
import { banner } from "@/lib/ui/toast";
import { BackControl } from "@/components/ui/BackControl";
import { BarBack } from "@/components/app/BarBack";
import { useBack } from "@/lib/nav/use-back";
import { NATIVE_BACK_EVENT } from "@/lib/native/native-back-event";
import { whenSheetsClosed } from "@/lib/ui/use-sheet-history";
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
import { fill, isExploreTab, mayAskModel, understoodChips, type ExploreTab, type IntelligenceCopy } from "./model";
import { INTEL_STATE_KEY, backTargetOf, isHome, ownState, parentOf, readIntelEntry, type IntelEntry } from "./intel-history";
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

/* ------------------------------------------------ the screen's history */

/** Said after the screen writes its own history entry, so the back control's name follows. */
const HISTORY_EVENT = "vallo:intel-history";

function subscribeHistory(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(HISTORY_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(HISTORY_EVENT, onChange);
  };
}
/* A string, so the snapshot is stable between reads. */
const readTopEntry = () => {
  const entry = readIntelEntry(window.history.state);
  return entry ? `${entry.suggest ? "s" : "p"}|${entry.from}` : "";
};
const noTopEntry = () => "";
function entryOf(snapshot: string): IntelEntry | null {
  if (!snapshot) return null;
  return { from: snapshot.slice(2), ...(snapshot.startsWith("s|") ? { suggest: true } : {}) };
}

const hereHref = () => `${window.location.pathname}${window.location.search}`;
const told = () => window.dispatchEvent(new Event(HISTORY_EVENT));
const MODAL_OPEN = '[aria-modal="true"]:not([data-closing])';

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
  /* Leaving the screen altogether: back to where the person came from, else Home (`useBack`). */
  const leave = useBack("/home");
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
  /* The suggestions list: open now, its own history entry on top, and a take-back of ours in flight. */
  const [listOpen, setListOpen] = useState(false);
  const listOpenRef = useRef(false);
  const suggestEntry = useRef(false);
  const takingBack = useRef(false);
  /* A link to another screen was followed while the list was open: leave its entry alone. */
  const leaving = useRef(false);
  const fieldControl = useRef<{ close: () => void } | null>(null);

  /* -------------------------------------------------------- the address */
  /* Every step is its own entry, stamped with the step before it (`intel-history.ts`),
     so the on-screen back, the browser's Back and Android's all walk the same steps. */
  const navigate = useCallback((next: IntelUrlState, options: { replace?: boolean } = {}) => {
    const href = intelHref(next);
    try {
      const top = readIntelEntry(window.history.state);
      const here = hereHref();
      if (options.replace) {
        window.history.replaceState(ownState(window.history.state), "", href);
      } else if (suggestEntry.current && top?.suggest) {
        /* The suggestions' entry becomes this step: Back from it goes to before the typing. */
        suggestEntry.current = false;
        if (href === top.from) {
          takingBack.current = true;
          window.history.back();
        } else {
          window.history.replaceState(ownState(null, { [INTEL_STATE_KEY]: { from: top.from } }), "", href);
        }
      } else if (href !== here) {
        window.history.pushState(ownState(null, { [INTEL_STATE_KEY]: { from: here } }), "", href);
      }
      told();
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

  /* The suggestions list opened or closed: its own entry goes on, or comes off. */
  const syncSuggestEntry = useCallback(() => {
    if (takingBack.current || typeof window === "undefined" || window.location.pathname !== INTEL_PATH) return;
    try {
      if (listOpenRef.current && !suggestEntry.current) {
        if (document.querySelector(MODAL_OPEN)) return;
        const here = hereHref();
        window.history.pushState(ownState(null, { [INTEL_STATE_KEY]: { from: here, suggest: true } }), "", here);
        suggestEntry.current = true;
        leaving.current = false;
        told();
      } else if (!listOpenRef.current && suggestEntry.current) {
        suggestEntry.current = false;
        /* Only our own entry, still on top, and not while a link is taking the person elsewhere. */
        if (!leaving.current && readIntelEntry(window.history.state)?.suggest) {
          takingBack.current = true;
          window.history.back();
        }
      }
    } catch {
      /* A sandboxed frame: the list still opens and closes. */
    }
  }, []);

  const onListOpenChange = useCallback(
    (open: boolean) => {
      listOpenRef.current = open;
      setListOpen(open);
      syncSuggestEntry();
    },
    [syncSuggestEntry],
  );

  /* A link to another screen tapped while the list is open: its entry stays, healed on the way back. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!suggestEntry.current) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      try {
        if (new URL((link as HTMLAnchorElement).href, window.location.href).pathname !== INTEL_PATH) leaving.current = true;
      } catch {
        /* Not an address. */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /* Back and Forward through the steps this screen pushed. */
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname !== INTEL_PATH) return;
      if (takingBack.current) {
        /* Our own take-back of the suggestions' entry: the address is the same, the words stay. */
        takingBack.current = false;
        syncSuggestEntry();
        return;
      }
      if (suggestEntry.current) {
        /* Back while the suggestions were open closes them, and only them. */
        suggestEntry.current = false;
        fieldControl.current?.close();
      } else if (readIntelEntry(window.history.state)?.suggest && !listOpenRef.current) {
        /* Forward onto a spent suggestions entry: step straight off it again. */
        takingBack.current = true;
        window.history.back();
        return;
      }
      const next = parseIntelUrl(new URLSearchParams(window.location.search));
      /* The same step (a sheet's entry coming off, the suggestions closing): nothing on screen changes. */
      if (searchKey(next) === keyRef.current) return;
      const prev = urlRef.current;
      const apply = () => {
        setUrl(next);
        setInput(next.q);
      };
      /* Between the home and a category's page: the header folds back into its tile (or out of it, going forward). */
      if (!prev.q && !next.q && prev.tab !== next.tab) {
        const closing = prev.tab !== "all" && next.tab === "all";
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
  }, [syncSuggestEntry]);

  /* ON ARRIVAL: the address tidied, and a step with nothing of ours behind it
     given its parent behind it, so Back from a search or a category opened by
     a link lands on this screen's home rather than leaving it. */
  useEffect(() => {
    try {
      const state = window.history.state;
      const here = parseIntelUrl(new URLSearchParams(window.location.search));
      const href = intelHref(here);
      const entry = readIntelEntry(state);
      if (entry?.suggest) {
        /* Back onto the suggestions' entry from another screen: step off it, it is spent. */
        takingBack.current = true;
        window.history.back();
        return;
      }
      /* `focus=1` (a launcher) comes off, so Back and a reload do not refocus; this entry's own keys stay. */
      if (hereHref() !== href) window.history.replaceState(ownState(state), "", href);
      const parent = parentOf(here);
      if (!entry && parent) {
        window.history.replaceState(ownState(window.history.state), "", intelHref(parent));
        window.history.pushState(ownState(null, { [INTEL_STATE_KEY]: { from: intelHref(parent) } }), "", href);
      }
      told();
    } catch {
      /* A sandboxed frame: Back still leaves, as before. */
    }
  }, []);

  /* Cmd/Ctrl+K on this screen puts the caret in the field, never from behind an open sheet. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (document.querySelector(MODAL_OPEN)) return;
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
  /* Asked again when the connection comes back, so a page that failed offline does not stay half drawn. */
  useEffect(() => {
    if (url.q || keptDiscover || !online) return;
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
  }, [url.q, online]);

  /* Offline, nothing is coming: no skeleton waiting for it. */
  const discoverView: DiscoverView = !online && discover.status === "loading" ? { status: "unavailable" } : discover;

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
  /* On a phone the keyboard goes once a search is on its way: the results are what to look at. */
  const dropKeyboard = useCallback(() => {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) inputRef.current?.blur();
    } catch {
      /* Keep the caret. */
    }
  }, []);
  /* A search the person asked for: a submitted search, so its first read says so. */
  const runState = useCallback(
    (next: IntelUrlState) => {
      submitted.current = searchKey(next);
      setAsked(searchKey(next));
      navigate(next);
      dropKeyboard();
    },
    [navigate, dropKeyboard],
  );
  const runQuery = useCallback((q: string) => runState({ q, tab: url.tab, filters: {}, drop: [] }), [runState, url.tab]);

  const onPick = (suggestion: Suggestion) => {
    if (suggestion.href) {
      if (suggestion.href.startsWith(`${INTEL_PATH}?`)) {
        navigate(parseIntelUrl(new URLSearchParams(suggestion.href.slice(INTEL_PATH.length + 1))));
        dropKeyboard();
      } else if (suggestEntry.current && readIntelEntry(window.history.state)?.suggest) {
        /* Another screen takes the suggestions' place in history, so Back returns to the words. */
        suggestEntry.current = false;
        router.replace(suggestion.href);
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
        window.scrollTo({ top: 0 });
      },
      tile,
      catheadOf,
    );
  };

  /* THE ONE BACK, for the drawn control and Android's button alike:
       suggestions open    close them (their own entry comes off)
       a step of ours      the browser's Back, so history stays one step
       a step opened by a link with nothing of ours behind it
                           its parent (the home), in place
       the home            leave the screen: where the person came from, else Home */
  const goBack = () => {
    if (listOpenRef.current) {
      if (suggestEntry.current && readIntelEntry(window.history.state)?.suggest) window.history.back();
      else fieldControl.current?.close();
      return;
    }
    if (isHome(url)) {
      leave();
      return;
    }
    if (readIntelEntry(window.history.state)) {
      window.history.back();
      return;
    }
    const parent = parentOf(url) ?? { q: "", tab: "all" as const, filters: {}, drop: [] };
    const from = url.tab;
    const fromCategory = !url.q && isExploreTab(from);
    runFlow(
      () => {
        navigate(parent, { replace: true });
        window.scrollTo({ top: fromCategory ? homeScrollY : 0 });
      },
      fromCategory ? catheadOf() : null,
      () => (fromCategory ? tileOf(from) : null),
    );
  };
  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  });

  /* Android's back button and gesture, inside the app, take the same step
     (`lib/native/back-button.ts` offers it here first). An open sheet is
     left to the overlay registry, and on the home Back leaves as everywhere. */
  useEffect(() => {
    const claim = (event: Event) => {
      if (document.querySelector(MODAL_OPEN)) return;
      if (!listOpenRef.current && isHome(urlRef.current)) return;
      event.preventDefault();
      goBackRef.current();
    };
    document.addEventListener(NATIVE_BACK_EVENT, claim);
    return () => document.removeEventListener(NATIVE_BACK_EVENT, claim);
  }, []);

  /* What the back control returns to, for its name: read from history after the first paint. */
  const topSnapshot = useSyncExternalStore(subscribeHistory, readTopEntry, noTopEntry);

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

  /* THE BACK CONTROL, the app's own (`BackControl`): on a phone it rides the
     app's bar beside the screen's name (`BarBack`, as every inner screen's
     does), from 64rem it leads this header. A step inside the screen is
     `goBack`; on the home it is the platform's own way back. */
  const stepBack = listOpen || !isHome(url);
  const topEntry = entryOf(topSnapshot);
  const target = backTargetOf(topEntry && !topEntry.suggest ? topEntry : null, url);
  const backLabel = listOpen
    ? copy.back.closeSuggestions
    : category
      ? copy.category.backLabel
      : target.kind === "search"
        ? copy.back.toSearch
        : target.kind === "category" && isExploreTab(target.tab)
          ? fill(copy.back.toCategory, { category: copy.categories[target.tab] })
          : copy.back.toHome;
  const backControl = (place: "bar" | "page") =>
    stepBack ? (
      <BackControl
        onBack={goBack}
        label={backLabel}
        {...(place === "bar" ? { className: "nf-bar-back" } : { surface: "round" as const })}
        data-testid={place === "bar" ? "intel-bar-back" : "intel-back"}
      />
    ) : (
      <BackControl
        fallback="/home"
        {...(place === "bar" ? { className: "nf-bar-back" } : { surface: "round" as const })}
        data-testid={place === "bar" ? "intel-bar-back" : "intel-back"}
      />
    );
  /* Never over the suggestions (the field lifted the header away to show them) or an open sheet. */
  const askShown = pastTop && !assistOpen && !filtersOpen && !listOpen;

  return (
    <div
      className="nf-intel"
      data-state={category ? "category" : empty ? "empty" : "results"}
      data-signed-in={signedIn ? "true" : undefined}
      data-testid="intel-screen"
    >
      <BarBack title={category ? copy.explore.tiles[category].title : copy.name} back={backControl("bar")} />
      <header className="nf-intel-top" ref={headerRef}>
        <span className="nf-intel-top__lead">
          {backControl("page")}
          <span className="nf-intel-top__brand">
            <LogoWordmark width={wordmarkWidth(15)} height={15} className="nf-intel-top__word" />
            <span className="sr-only">{copy.wordmark}</span>
          </span>
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
        <IntelCategory tab={category} view={discoverView} copy={copy} locale={locale} />
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
          onOpenChange={onListOpenChange}
          controlRef={fieldControl}
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
          view={discoverView}
          copy={copy}
          locale={locale}
          signedIn={signedIn}
          url={url}
          runQuery={runQuery}
          onSearch={runState}
        />
      ) : empty ? (
        <IntelDiscover
          view={discoverView}
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
        data-shown={askShown ? "true" : undefined}
        aria-hidden={askShown ? undefined : true}
        tabIndex={askShown ? undefined : -1}
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
        locale={locale}
        onApply={(set, cleared) => {
          const next = withFilters(withoutFilters(url, cleared.filter((k) => drawerCurrent[k] !== undefined)), set);
          /* After the sheet's own entry has come off, so Back from the new results is one step, not two. */
          whenSheetsClosed(() => navigate(next));
        }}
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
