"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { loadRoommatesFeed, type FeedPage } from "@/lib/features/roommates/actions";
import {
  BUDGET_SLIDER,
  EMPTY_FEED_FILTERS,
  FEED_TABS,
  feedActiveCount,
  feedQuery,
  startCursor,
  type FeedCursor,
  type FeedFilters,
  type FeedItem,
  type FeedTab,
} from "@/lib/features/roommates/feed";
import { GENDER_PREFS, ROOMMATES_ROUTES, ROOM_TYPES } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { listSavedPlaces, savePlace, unsavePlace } from "@/lib/saved/places-actions";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { RoomCardView, RoommateCardView } from "./Cards";
import { counted, fill, lagosDay, naira } from "./format";
import { STATE_OPTIONS } from "./states";
import "./roommates-welcome.css";

/**
 * THE ROOMMATES FEED: the home's default. A search box, the three chips, a
 * Filters sheet (gender, budget range, state, area, room type, move-in), and
 * the posts as cards with a save heart and a Connect button. Every change
 * asks the database (`loadRoommatesFeed`); nothing is filtered here. The first
 * page arrives from the server, "Show more" asks for the next one, and the
 * address is kept in step so Back and a shared link land on the same list.
 * Only approved posts are ever in it.
 */
export function RoommatesFeed({
  initial,
  tab: firstTab,
  filters: firstFilters,
  signedIn,
  now,
}: {
  initial: FeedPage | null;
  tab: FeedTab;
  filters: FeedFilters;
  signedIn: boolean;
  now: number;
}) {
  const copy = useScopedCopy("roommates");
  const f = copy.feed;
  const [tab, setTab] = useState<FeedTab>(firstTab);
  const [filters, setFilters] = useState<FeedFilters>(firstFilters);
  const [items, setItems] = useState<FeedItem[]>(initial?.items ?? []);
  const [next, setNext] = useState<FeedCursor | null>(initial ? initial.next : startCursor(firstTab));
  const [note, setNote] = useState<FeedPage["peopleNote"]>(initial?.peopleNote ?? null);
  const [failed, setFailed] = useState<string | null>(initial ? null : f.error);
  const [busy, setBusy] = useState(initial === null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(firstFilters.q);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [pending, start] = useSafeTransition();
  const first = useRef(true);
  const today = lagosDay(now);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void listSavedPlaces({ entityKind: "roommate_listing" })
      .then((r) => {
        if (live && r.ok) setSaved(new Set(r.data.map((p) => p.entityId)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn]);

  const fetchPage = useCallback(
    (t: FeedTab, fl: FeedFilters, cursor: FeedCursor, append: boolean) =>
      start(async () => {
        setBusy(true);
        try {
          const r = await loadRoommatesFeed({ tab: t, filters: fl, cursor });
          if (!r.ok) {
            setFailed(r.error);
            return;
          }
          setFailed(null);
          setItems((cur) => (append ? [...cur, ...r.data.items] : r.data.items));
          setNext(r.data.next);
          setNote(r.data.peopleNote);
        } catch (error) {
          setFailed(f.error);
          if (!tapFailedOffline(error)) throw error;
        } finally {
          setBusy(false);
        }
      }),
    [start, f.error],
  );

  const apply = useCallback(
    (t: FeedTab, fl: FeedFilters) => {
      setTab(t);
      setFilters(fl);
      try {
        window.history.replaceState(null, "", `${window.location.pathname}${feedQuery(t, fl)}`);
      } catch {
        /* The address is a convenience. */
      }
      fetchPage(t, fl, startCursor(t), false);
    },
    [fetchPage],
  );

  /* The search box asks after a short pause, not on every key. */
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (q.trim() === filters.q) return;
    const id = window.setTimeout(() => apply(tab, { ...filters, q: q.trim() }), 400);
    return () => window.clearTimeout(id);
  }, [q, filters, tab, apply]);

  /* A first page that did not arrive from the server is asked for here. */
  useEffect(() => {
    if (initial === null) fetchPage(firstTab, firstFilters, startCursor(firstTab), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const toggleSave = (id: string) => {
    if (!signedIn) {
      window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const want = !saved.has(id);
    feedback("select");
    setSaved((cur) => {
      const n = new Set(cur);
      if (want) n.add(id);
      else n.delete(id);
      return n;
    });
    const flip = (on: boolean) =>
      setSaved((cur) => {
        const n = new Set(cur);
        if (on) n.add(id);
        else n.delete(id);
        return n;
      });
    void (want ? savePlace({ entityKind: "roommate_listing", entityId: id }) : unsavePlace({ entityKind: "roommate_listing", entityId: id })).then((r) => {
      if (!r.ok) {
        flip(!want);
        banner.error(r.error);
        return;
      }
      bannerWithUndo(want ? copy.actions.saved : copy.ui.profile.removedSave, {
        label: copy.area.undo,
        undone: copy.area.undone,
        undo: async () => {
          const back = await (want ? unsavePlace({ entityKind: "roommate_listing", entityId: id }) : savePlace({ entityKind: "roommate_listing", entityId: id }));
          return back.ok ? { ok: true } : { ok: false, error: back.error };
        },
        onUndone: () => flip(!want),
      });
    });
  };

  const active = feedActiveCount(filters);
  const empty = !busy && !failed && items.length === 0;

  return (
    <section className="nf-rmfd" aria-labelledby="rmfd-title" data-testid="roommates-feed">
      <div className="nf-rmfd__bar">
        <div className="nf-rmfd__search">
          <span className="nf-rmfd__glyph" aria-hidden="true">
            <UiIcon name="search" size={18} />
          </span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.search} aria-label={f.searchLabel} maxLength={80} enterKeyHint="search" data-testid="feed-search" />
        </div>
        <div className="nf-rmfd__filter">
          <Button variant="secondary" size="md" iconOnly round aria-label={f.filters} onClick={() => setOpen(true)} data-testid="feed-filters">
            <UiIcon name="filter" size={18} />
          </Button>
          {active > 0 ? (
            <span className="nf-rmfd__badge" aria-label={counted(active, f.active)}>
              {active}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="nf-rmfd__tabs" aria-label={f.tabsLabel}>
        {FEED_TABS.map((t) => (
          <li key={t}>
            <button type="button" className="nf-rmfd__tab" aria-pressed={tab === t} onClick={() => tab !== t && apply(t, filters)} data-testid={`feed-tab-${t}`}>
              {f.tabs[t]}
            </button>
          </li>
        ))}
      </ul>

      <div className="nf-rmfd__head">
        <h2 id="rmfd-title" className="nf-rmfd__title">
          {f.popular}
        </h2>
        {!busy && items.length ? <span className="nf-rmfd__count">{counted(items.length, f.results)}</span> : null}
      </div>

      {note === "need-profile" ? (
        <p className="nf-rmfd__note" data-testid="feed-need-profile">
          {f.peopleNeedProfile}{" "}
          <Link href={ROOMMATES_ROUTES.profile}>{f.makeProfile}</Link>
        </p>
      ) : null}
      {note === "signed-out" ? <p className="nf-rmfd__note">{f.peopleSignedOut}</p> : null}

      {failed ? (
        <div className="nf-rmfd__note" role="alert" data-testid="feed-error">
          <p>{failed}</p>
          <Button variant="secondary" size="sm" onClick={() => fetchPage(tab, filters, startCursor(tab), false)}>
            {f.retry}
          </Button>
        </div>
      ) : null}

      {busy && items.length === 0 ? (
        <ul className="nf-rmfd__grid" aria-busy="true" aria-label={f.loading}>
          {[0, 1, 2].map((n) => (
            <li key={n} className="nf-rmfd__skel" />
          ))}
        </ul>
      ) : (
        <ul className="nf-rmfd__grid" data-testid="feed-grid">
          {items.map((it) =>
            it.type === "room" ? (
              <li key={`r-${it.room.id}`}>
                <RoomCardView
                  room={it.room}
                  t={copy}
                  today={today}
                  action={
                    <Button variant="icon" round iconOnly aria-label={saved.has(it.room.id) ? copy.actions.saved : copy.actions.save} aria-pressed={saved.has(it.room.id)} onClick={() => toggleSave(it.room.id)}>
                      <UiIcon name="heart" size={18} filled={saved.has(it.room.id)} />
                    </Button>
                  }
                />
                <ButtonLink href={ROOMMATES_ROUTES.listing(it.room.id)} variant="secondary" size="md" full leadingIcon="chat-bubble" data-testid="feed-connect">
                  {f.connect}
                </ButtonLink>
              </li>
            ) : (
              <li key={`p-${it.person.userId}`}>
                <RoommateCardView
                  card={it.person}
                  t={copy}
                  action={
                    <ButtonLink href={ROOMMATES_ROUTES.person(it.person.userId)} variant="primary" size="sm" data-testid="feed-connect">
                      {f.connect}
                    </ButtonLink>
                  }
                />
              </li>
            ),
          )}
        </ul>
      )}

      {empty ? (
        <div className="nf-rmfd__note" data-testid="feed-empty">
          <p>{tab === "looking" ? f.emptyLooking : f.empty}</p>
          <div className="nf-rmfs__chips">
            {active > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => apply(tab, { ...EMPTY_FEED_FILTERS })}>
                {f.clear}
              </Button>
            ) : null}
            <ButtonLink href={signedIn ? ROOMMATES_ROUTES.create : `/sign-in?next=${encodeURIComponent(ROOMMATES_ROUTES.create)}`} variant="primary" size="sm" leadingIcon="plus">
              {f.emptyCta}
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {next && items.length ? (
        <div className="nf-rmfd__more">
          <Button variant="secondary" size="md" loading={pending} onClick={() => fetchPage(tab, filters, next, true)} data-testid="feed-more">
            {f.more}
          </Button>
        </div>
      ) : null}

      <FiltersSheet
        open={open}
        onOpenChange={setOpen}
        value={filters}
        onApply={(v) => {
          setOpen(false);
          apply(tab, v);
        }}
      />
    </section>
  );
}

function FiltersSheet({ open, onOpenChange, value, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; value: FeedFilters; onApply: (v: FeedFilters) => void }) {
  const copy = useScopedCopy("roommates");
  const f = copy.feed;
  const [d, setD] = useState<FeedFilters>(value);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the sheet starts from the applied filters each time it opens
    if (open) setD(value);
  }, [open, value]);
  const lo = d.minNaira ?? BUDGET_SLIDER.min;
  const hi = d.maxNaira ?? BUDGET_SLIDER.max;
  const readout =
    d.minNaira === null && d.maxNaira === null
      ? f.budgetAny
      : d.minNaira !== null && d.maxNaira !== null
        ? fill(f.budgetBetween, { min: naira(d.minNaira * 100, false), max: naira(d.maxNaira * 100, false) })
        : d.maxNaira !== null
          ? fill(f.budgetUpTo, { max: naira(d.maxNaira * 100, false) })
          : fill(f.budgetFrom, { min: naira(lo * 100, false) });
  const set = (p: Partial<FeedFilters>) => setD((x) => ({ ...x, ...p }));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={f.filtersTitle}
      description={f.filtersBody}
      closeLabel={copy.ui.flow.close}
      testId="feed-filters-sheet"
      footer={
        <div className="nf-rm-sheetfoot">
          <Button variant="secondary" size="lg" full onClick={() => setD({ ...EMPTY_FEED_FILTERS, q: d.q })}>
            {f.clear}
          </Button>
          <Button variant="primary" size="lg" full onClick={() => onApply(d)} data-testid="feed-apply">
            {f.apply}
          </Button>
        </div>
      }
    >
      <div className="nf-rmfs">
        <fieldset className="nf-rmfs__group">
          <legend className="nf-rmfs__label">{f.gender}</legend>
          <div className="nf-rmfs__chips">
            {[null, ...GENDER_PREFS.filter((g) => g !== "any")].map((g) => (
              <button key={g ?? "any"} type="button" className="nf-rmfd__tab" aria-pressed={d.genderPref === g} onClick={() => set({ genderPref: g })}>
                {g ? copy.genderPref[g] : f.genderAny}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="nf-rmfs__group">
          <legend className="nf-rmfs__label">{f.budget}</legend>
          <p className="nf-rmfs__readout" aria-live="polite" data-testid="feed-budget-readout">
            {readout}
          </p>
          <div className="nf-rmfs__range">
            <label>
              <span className="nf-rmfs__ends">{f.budgetMin}</span>
              <input
                type="range"
                min={BUDGET_SLIDER.min}
                max={BUDGET_SLIDER.max}
                step={BUDGET_SLIDER.step}
                value={lo}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ minNaira: v > 0 ? Math.min(v, hi) : null, maxNaira: v > hi ? v : d.maxNaira });
                }}
              />
            </label>
            <label>
              <span className="nf-rmfs__ends">{f.budgetMax}</span>
              <input
                type="range"
                min={BUDGET_SLIDER.min}
                max={BUDGET_SLIDER.max}
                step={BUDGET_SLIDER.step}
                value={hi}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ maxNaira: v >= BUDGET_SLIDER.max ? null : Math.max(v, lo), minNaira: v < lo ? v : d.minNaira });
                }}
              />
            </label>
          </div>
        </fieldset>

        <SelectField label={f.state} value={d.stateCode ?? ""} onChange={(e) => set({ stateCode: e.target.value || null })}>
          <option value="">{f.stateAny}</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField label={f.city} value={d.city ?? ""} maxLength={60} onChange={(e) => set({ city: e.target.value || null })} />

        <fieldset className="nf-rmfs__group">
          <legend className="nf-rmfs__label">{f.roomType}</legend>
          <div className="nf-rmfs__chips">
            {[null, ...ROOM_TYPES].map((r) => (
              <button key={r ?? "any"} type="button" className="nf-rmfd__tab" aria-pressed={d.roomType === r} onClick={() => set({ roomType: r })}>
                {r ? copy.roomTypes[r] : f.roomTypeAny}
              </button>
            ))}
          </div>
        </fieldset>

        <TextField label={f.moveBy} type="date" value={d.moveBy ?? ""} onChange={(e) => set({ moveBy: e.target.value || null })} />
      </div>
    </Sheet>
  );
}
