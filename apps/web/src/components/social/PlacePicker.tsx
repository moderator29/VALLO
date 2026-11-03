"use client";

import { Button } from "@/components/ui/Button";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { matchesSearch } from "@/lib/places/reference";
import { enterPlace } from "@/lib/social/areas-actions";
import {
  PLACE_COPY,
  type LgaNode,
  type OpenPlace,
  type PlaceTree,
} from "@/lib/social/places-model";
import { countOf } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The way in.
 *
 * Thirty-seven containers, one per state and the Federal Capital Territory.
 * Tap one and its local governments appear as containers of their own. Tap a
 * local government and you are standing in it, whether or not anybody has ever
 * been there before: `public.enter_place` opens the door the first time
 * somebody walks through it and hands back the same place every time after.
 *
 * Three decisions worth stating, because each had a plausible alternative.
 *
 * **The chips wrap, they do not scroll sideways.** A horizontal strip of 37
 * states hides thirty of them behind a blind swipe with no affordance saying
 * how far it goes, and the one thing this control must never do is make a
 * state feel unreachable. Wrapping shows all thirty-seven at 390px in six
 * rows, and the same wrap holds Kano's 44 without a single hidden chip.
 *
 * **Search spans the whole country until a state is chosen, and that state
 * afterwards.** Somebody who knows they want Eti-Osa types three letters and
 * skips the state step entirely; somebody who has already tapped Kano is
 * searching Kano and would be confused by Kogi appearing underneath. The
 * scope is written on the field so it is never a guess.
 *
 * **Nothing here is pinned.** The state is a chip you can change, not a
 * setting you saved, and it lives in the query string so a reload and a shared
 * link both land in the same place. `history.replaceState` rather than a
 * router navigation, because re-rendering a dynamic page to record which chip
 * is lit would put a round trip in front of every tap.
 *
 * This control lives on `/around/settings` now that `/around` itself is the feed,
 * which is why the sign-in return path below points there: sending somebody
 * back to the feed after they asked to open a door would lose the door.
 */
export function PlacePicker({
  tree,
  open,
  signedIn,
  initialStateCode,
}: {
  tree: PlaceTree;
  open: OpenPlace[];
  signedIn: boolean;
  initialStateCode: string | null;
}) {
  const locale = useClientLocale();
  const router = useRouter();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [stateCode, setStateCode] = useState<string | null>(() => {
    if (!initialStateCode) return null;
    return tree.some((state) => state.code === initialStateCode) ? initialStateCode : null;
  });

  const openByCode = useMemo(() => {
    const map = new Map<string, OpenPlace>();
    for (const place of open) map.set(place.lgaCode, place);
    return map;
  }, [open]);

  const selectedState = useMemo(
    () => tree.find((state) => state.code === stateCode) ?? null,
    [tree, stateCode],
  );

  /** Record the chosen state in the address bar without re-rendering the page. */
  const rememberInUrl = useCallback((code: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("state", code);
    else url.searchParams.delete("state");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const chooseState = (code: string | null) => {
    setStateCode(code);
    setQuery("");
    setError(null);
    rememberInUrl(code);
    if (code) window.setTimeout(() => searchRef.current?.focus(), 60);
  };

  /**
   * What the grid is showing right now. One shape for all three cases, so the
   * markup below never branches on which of them it is.
   */
  const results = useMemo((): {
    kind: "states" | "lgas";
    states: { code: string; name: string; count: number }[];
    lgas: { lga: LgaNode; stateCode: string; stateName: string }[];
    total: number;
  } => {
    const trimmed = query.trim();

    if (trimmed.length === 0 && !selectedState) {
      return {
        kind: "states",
        states: tree.map((state) => ({
          code: state.code,
          name: state.name,
          count: state.lgas.length,
        })),
        lgas: [],
        total: tree.length,
      };
    }

    if (selectedState) {
      const matched = selectedState.lgas
        .filter((lga) => matchesSearch(lga.name, trimmed))
        .map((lga) => ({
          lga,
          stateCode: selectedState.code,
          stateName: selectedState.name,
        }));
      return { kind: "lgas", states: [], lgas: matched, total: matched.length };
    }

    /* No state chosen and something typed: search the whole country. States
       whose own name matches come first, because "Kano" typed by somebody who
       wants the state should not be buried under Kano's 44 local governments. */
    const states = tree
      .filter((state) => matchesSearch(state.name, trimmed))
      .map((state) => ({
        code: state.code,
        name: state.name,
        count: state.lgas.length,
      }));

    const lgas: { lga: LgaNode; stateCode: string; stateName: string }[] = [];
    for (const state of tree) {
      for (const lga of state.lgas) {
        if (matchesSearch(lga.name, trimmed)) {
          lgas.push({ lga, stateCode: state.code, stateName: state.name });
        }
      }
    }

    return {
      kind: "lgas",
      states,
      lgas: lgas.slice(0, 60),
      total: states.length + lgas.length,
    };
  }, [query, selectedState, tree]);

  const enter = (lga: LgaNode, lgaStateCode: string) => {
    if (isPending) return;
    setError(null);

    const already = openByCode.get(lga.code);
    if (already) {
      router.push(`/around/${already.slug}`);
      return;
    }

    /* Nobody has been through this door, so opening it is a write, and a write
       needs an account. Sending them back to the state they were looking at
       means one tap after signing in rather than starting over. */
    if (!signedIn) {
      const back = `/around/settings?state=${encodeURIComponent(lgaStateCode)}`;
      router.push(`/sign-in?next=${encodeURIComponent(back)}`);
      return;
    }

    setPendingCode(lga.code);
    startTransition(async () => {
      try {
        const result = await enterPlace({ lgaCode: lga.code });
        if (!result.ok) {
          setPendingCode(null);
          setError(result.error);
          return;
        }
        router.replace(`/around/${result.data.slug}`);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  if (tree.length === 0) {
    return (
      <section className="nf-enter" aria-labelledby="nf-enter-title">
        <h2 id="nf-enter-title" className="nf-enter__title">
          {PLACE_COPY.title}
        </h2>
        <p className="nf-enter__lede">{PLACE_COPY.couldNotLoad}</p>
      </section>
    );
  }

  return (
    <section className="nf-enter" aria-labelledby="nf-enter-title">
      <h2 id="nf-enter-title" className="nf-enter__title">
        {PLACE_COPY.title}
      </h2>
      <p className="nf-enter__lede">{PLACE_COPY.lede}</p>

      {selectedState ? (
        <div className="nf-enter__crumb">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon="arrow-left"
            onClick={() => chooseState(null)}
            className="nf-enter__back"
            data-testid="place-picker-back"
          >
            {PLACE_COPY.backToStates}
          </Button>
          <span className="nf-enter__state" data-testid="place-picker-state">
            {selectedState.name}
          </span>
        </div>
      ) : null}

      <div className="nf-enter__search nf-focus-well">
        <UiIcon name="search" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            selectedState
              ? PLACE_COPY.searchInState(selectedState.name)
              : PLACE_COPY.searchStates
          }
          aria-label={
            selectedState
              ? PLACE_COPY.searchInState(selectedState.name)
              : PLACE_COPY.searchStates
          }
          autoComplete="off"
          spellCheck={false}
          data-testid="place-picker-search"
        />
      </div>

      {error ? (
        <p role="alert" className="nf-enter__error">
          {error}
        </p>
      ) : null}

      {results.total === 0 ? (
        <div className="nf-enter__empty">
          <p className="nf-enter__empty-title">{PLACE_COPY.nothingMatches}</p>
          <p className="nf-enter__empty-body">{PLACE_COPY.nothingMatchesBody}</p>
        </div>
      ) : (
        <>
          {results.states.length > 0 ? (
            <ul className="nf-enter__grid" data-testid="place-picker-states">
              {results.states.map((state) => (
                <li key={state.code}>
                  <button
                    type="button"
                    className="nf-chip nf-enter__chip"
                    onClick={() => chooseState(state.code)}
                    data-state-code={state.code}
                    aria-label={`${state.name}, ${countOf(state.count, "localGovernments", locale)}`}
                  >
                    {state.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {results.lgas.length > 0 ? (
            <ul className="nf-enter__grid" data-testid="place-picker-lgas">
              {results.lgas.map(({ lga, stateCode: code, stateName }) => {
                const already = openByCode.get(lga.code);
                const busy = pendingCode === lga.code;
                return (
                  <li key={lga.code}>
                    <button
                      type="button"
                      className="nf-chip nf-enter__chip"
                      data-lga-code={lga.code}
                      data-open={already ? "true" : undefined}
                      aria-busy={busy || undefined}
                      disabled={isPending && !busy}
                      /* The chip shows a bare number because there is no room
                         for the word beside it, and a number without its word
                         is meaningless. The label carries the word, so the
                         count means something to a screen reader and to
                         anybody who holds the chip. */
                      aria-label={
                        already
                          ? `${lga.name}, ${stateName}. ${PLACE_COPY.alreadyOpen}, ${countOf(already.memberCount, "members", locale)}.`
                          : `${lga.name}, ${stateName}. ${PLACE_COPY.notOpenYet}`
                      }
                      title={
                        already
                          ? countOf(already.memberCount, "members", locale)
                          : undefined
                      }
                      onClick={() => enter(lga, code)}
                    >
                      <span className="nf-enter__chip-name">{lga.name}</span>
                      {/* Only when the search spans the country, because inside
                          one state every chip would carry the same word. */}
                      {!selectedState ? (
                        <span className="nf-enter__chip-state">{stateName}</span>
                      ) : null}
                      {already ? (
                        <span className="nf-enter__chip-count nf-numeric">
                          {already.memberCount.toLocaleString("en-NG")}
                        </span>
                      ) : null}
                      {busy ? (
                        <span className="nf-enter__chip-state">{PLACE_COPY.opening}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}

      <p className="nf-enter__hint" aria-live="polite">
        {selectedState
          ? PLACE_COPY.lgaHint(selectedState.name, results.lgas.length)
          : query.trim().length > 0
            ? `${countOf(results.total, "matches", locale)} across Nigeria.`
            : `${tree.length} states and territories. Every one of the 774 local governments is behind them.`}
      </p>
    </section>
  );
}
