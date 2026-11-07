"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Reveal } from "@/components/site/Reveal";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { toggleSave } from "@/lib/saved/actions";
import {
  saveRestaurant,
  saveStay,
  unsaveRestaurant,
  unsaveStay,
} from "@/lib/saved/places-actions";
import type { SavePlaceTarget } from "@/components/app/SaveControl";
import { addLocalSave, readLocalSaves, removeLocalSave, writeLocalSaves } from "@/lib/saved/local";
import { MetaStrip } from "@/components/ui/MetaStrip";
import { ICON } from "@/components/app/Screen";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { countOf, formatNumber, intlTag, type Locale } from "@vallo/i18n/core";
import { CountUp } from "@/components/motion/CountUp";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { savedBoardKey, uniqueBoardKeys } from "./saved-board-key";
import { motionQuiet } from "@/lib/motion/gate";
import { SwipeToRemove } from "./SwipeToRemove";
import { changeLine, type SavedChange, type SavedChangeCopy } from "@/lib/saved/changes";
import Link from "next/link";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The shortlist, made interactive.
 *
 * Cards arrive already rendered by the server, so the design is the same one
 * discovery uses and nothing about it is duplicated here. This component owns
 * three things only: the heart, the undo chip that replaces a card the moment
 * it is unsaved, and the one-time reconciliation of device saves.
 *
 * Every tap flips instantly and settles against the truth. A failed write puts
 * the card straight back and says why in a sentence. An unsave never opens a
 * dialogue: the card becomes an undo chip in its own slot, and the row it
 * removed is restored by hearting it again from that chip.
 *
 * TWO SHELVES ARRIVE ON ONE BOARD. A saved property is a `saved_items` row or
 * a device save; a saved stay or restaurant is a `saved_places` row under its
 * entity kind. They interleave by `savedAt`, which is epoch seconds on both
 * sides, so the board is the shortlist in the order the person built it. The
 * only thing the board has to know about the difference is which write to
 * call, which is what `item.place` carries: `toggleSave` cannot reach
 * `saved_places` at all, so sending a hotel to it would report a success that
 * removed nothing.
 */

export type SavedBoardItem = {
  id: string;
  /** Where this save is kept: a row under RLS, or the device. */
  mode: "db" | "local";
  /** Epoch seconds, so an undo can restore the original ordering. */
  savedAt: number;
  /**
   * Set on a saved stay or restaurant, which lives in `saved_places` rather
   * than `saved_items`. The remove and the undo below are two different
   * tables, and `toggleSave` can only ever reach the listing one: sending an
   * accommodation id to it removes nothing and reports success, which is the
   * worst of the three possible outcomes. So the kind travels with the item.
   */
  place?: SavePlaceTarget;
  card: ReactNode;
  /** B13: what moved on this listing lately (lib/saved/changes.ts). */
  changes?: SavedChange[];
  /** Under the card: which lists it is in, and the sheet to change that (signed in, saved to the account). */
  lists?: ReactNode;
  /** B13: where "See similar nearby" goes when it is no longer available. */
  similarHref?: string;
};

type Phase = "removed" | "restoring";

/** B13: the last time this phone opened Saved. */
const SAVED_VISIT_KEY = "vallo_saved_last_visit";

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

type SlotCopy = { remove: string; removeLabel: string; removed: string; restoring: string; undo: string };

const SLOT_ENGLISH: SlotCopy = {
  remove: "Remove",
  removeLabel: "Remove from saved",
  removed: "Removed from saved",
  restoring: "Putting it back",
  undo: "Undo",
};

export function SavedBoard({
  items,
  comparable = 0,
  compare,
  copy = { shortlist: "Your shortlist", ready: "Ready to compare" },
  changeCopy,
  emptyCopy,
  slotCopy = SLOT_ENGLISH,
}: {
  items: SavedBoardItem[];
  /** B3: how many saved properties the compare can take as columns. */
  comparable?: number;
  /** B3: the compare control (SavedCompare), drawn beside the count. */
  compare?: ReactNode;
  copy?: { shortlist: string; ready: string };
  /** B13: the change lines' words; without them no line is drawn. */
  changeCopy?: SavedChangeCopy & { similar: string };
  /**
   * The empty shortlist's words (Session 3, W2), from the dictionary. Without
   * them the board falls back to the English it always drew.
   */
  emptyCopy?: {
    title: string;
    body: string;
    hydratingTitle: string;
    hydratingBody: string;
    action: string;
    captureLead: string;
    capture: string;
  };
  /**
   * The words on and under each saved card (Remove, its spoken name, the
   * undo chip). They were English literals; the page now passes the
   * dictionary's, and a surface that passes nothing keeps the English.
   */
  slotCopy?: SlotCopy;
}) {
  const locale = useClientLocale();
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [hydrating, setHydrating] = useState(false);
  /* Plan item 28: a removed card fades (160ms) and then folds its height away
     (240ms) before the Undo chip takes the slot; under reduced motion, Calm
     and Off it is replaced at once. */
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const synced = useRef(false);
  /* B13: when this phone last opened Saved, read once per mount (the
     LastVisit pattern), so a change line says "since you last looked". */
  const [lastSaved, setLastSaved] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let before: number | null = null;
    try {
      const raw = window.localStorage.getItem(SAVED_VISIT_KEY);
      const parsed = raw === null ? Number.NaN : Number(raw);
      before = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      window.localStorage.setItem(SAVED_VISIT_KEY, String(Date.now()));
    } catch {
      before = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSaved(before);
  }, []);

  /* Slots and phases are keyed by shelf and id (`savedBoardKey`),
     never by id alone: a listing and a place are two tables, and a repeated
     row must be one slot rather than two cards under one React key. */
  const ids = useMemo(() => uniqueBoardKeys(items), [items]);
  const [slots, setSlots] = useState<string[]>(() => uniqueBoardKeys(items));
  /* The item behind an undo chip, kept after a refresh drops it from the
     payload, so Undo still knows its shelf and its saved time. */
  const removedItems = useRef(new Map<string, SavedBoardItem>());

  // Slots hold their place across server refreshes, so a card that has just
  // become an undo chip does not jump to the end of the grid.
  useEffect(() => {
    setSlots((prev) => {
      const incoming = new Set(ids);
      const next = prev.filter((id) => incoming.has(id) || id in phase);
      for (const id of ids) if (!next.includes(id)) next.push(id);
      return sameOrder(prev, next) ? prev : next;
    });
    // A restore is complete once the card is back in the server payload.
    setPhase((prev) => {
      const present = new Set(ids);
      const next: Record<string, Phase> = {};
      let changed = false;
      for (const [id, value] of Object.entries(prev)) {
        if (value === "restoring" && present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = value;
      }
      return changed ? next : prev;
    });
    setHydrating(false);
  }, [ids, phase]);

  // Device saves made on other surfaces are mirrored into the cookie the page
  // reads, then the server tree is refreshed once so they render as real
  // cards. Runs at most once per mount, so a save that cannot be resolved can
  // never spin the page.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const local = readLocalSaves();
    if (local.length === 0) return;
    const known = new Set(items.map((i) => i.id));
    if (local.every((save) => known.has(save.id))) return;
    writeLocalSaves(local);
    setHydrating(true);
    startTransition(() => router.refresh());
  }, [items, router]);

  const byKey = new Map<string, SavedBoardItem>();
  for (const item of items) {
    const key = savedBoardKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }

  /** The write behind one card, whichever shelf it belongs to. */
  async function write(item: { id: string; place?: SavePlaceTarget }, on: boolean) {
    if (item.place) {
      if (item.place.kind === "accommodation") {
        return on
          ? await saveStay({ accommodationId: item.place.id })
          : await unsaveStay({ accommodationId: item.place.id });
      }
      return on
        ? await saveRestaurant({ restaurantId: item.place.id })
        : await unsaveRestaurant({ restaurantId: item.place.id });
    }
    return await toggleSave({ listingId: item.id });
  }

  function unsave(item: SavedBoardItem) {
    const key = savedBoardKey(item);
    if (motionQuiet()) {
      commitUnsave(item);
      return;
    }
    setLeaving((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setLeaving((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      commitUnsave(item);
    }, 400);
  }

  function commitUnsave(item: SavedBoardItem) {
    const key = savedBoardKey(item);
    removedItems.current.set(key, item);
    setPhase((prev) => ({ ...prev, [key]: "removed" }));
    if (item.mode === "local") removeLocalSave(item.id);

    startTransition(async () => {
      try {
        const result = await write(item, false);
        if (result.ok) return;
        // Nothing was removed, so the card goes back exactly as it was.
        if (item.mode === "local") addLocalSave(item.id, item.savedAt);
        setPhase((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        /* Said by the one banner at the top of the screen (Grade 1). */
        banner.error(result.error, { retry: () => commitUnsave(item) });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  function undo(key: string) {
    const item = byKey.get(key) ?? removedItems.current.get(key);
    if (!item) return;
    const id = item.id;
    setPhase((prev) => ({ ...prev, [key]: "restoring" }));
    if (item.mode === "local") addLocalSave(id, item.savedAt);

    startTransition(async () => {
      try {
        const result = await write({ id, place: item.place }, true);
        if (!result.ok) {
          if (item.mode === "local") removeLocalSave(id);
          setPhase((prev) => ({ ...prev, [key]: "removed" }));
          banner.error(result.error, { retry: () => undo(key) });
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  const rendered = slots
    .map((key) => ({ key, item: byKey.get(key), state: phase[key] }))
    .filter((slot) => slot.item !== undefined || slot.state !== undefined);
  const visible = rendered.filter((slot) => slot.state === undefined && slot.item).length;

  if (items.length === 0 && rendered.length === 0) {
    return (
      /*
       * THE EMPTY SHORTLIST (Stage 5: empty states are the current product).
       * The house with a heart settles in (Tier B, a symbol of a kept place),
       * the reason says where the heart is, the one action goes to the
       * shelves, and the want is captured another way: a saved search tells
       * the person the minute a match goes live, which is the shortlist's
       * other half and one tap away.
       *
       * CLEARANCE FOR THE FLOATING DOCK (`pb-4xl`): `/saved` is a tab-bar route
       * and this is the whole page, so the action must not land underneath
       * the navigation.
       */
      <DiscoveryEmpty
        className="pb-4xl"
        data-testid="saved-empty"
        object="house-heart"
        title={hydrating ? (emptyCopy?.hydratingTitle ?? "Bringing your saves together") : (emptyCopy?.title ?? "Nothing saved yet")}
        body={
          hydrating
            ? (emptyCopy?.hydratingBody ??
              "Places you hearted on this device are being matched to your account. This takes a moment.")
            : (emptyCopy?.body ?? "Tap the heart on any card and it waits for you here, ready to compare side by side.")
        }
        primary={{ label: emptyCopy?.action ?? "Find a place", href: "/search" }}
        capture={
          emptyCopy ? (
            <p>
              {emptyCopy.captureLead}
              <Link href="/saved/searches" className="nf-dempty__capture-link nf-link-quiet">
                {emptyCopy.capture}
              </Link>
            </p>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <Reveal>
        {/* The count as a meta strip (plan item 17): the figure, then what
            the list is for, divided by a hairline. */}
        <div className="nf-saved-meta mb-heading">
          <MetaStrip leading={<UiIcon name="heart" size={16} />}>
            <span className="font-semibold text-[var(--nf-content-primary)] nf-numeric">
              {/* The count counts up once on first view (the founder's
                  count-up ruling); the server prints the final number. */}
              <CountedPhrase phrase={countOf(visible, "places", locale)} value={visible} locale={locale} /> saved
            </span>
            {/* B3: "Ready to compare" only when the compare is really there. */}
            <span>{comparable >= 2 ? copy.ready : copy.shortlist}</span>
          </MetaStrip>
          {comparable >= 2 ? compare : null}
        </div>
      </Reveal>

      <Reveal delay={60}>
        <ul data-testid="saved-grid" className="nf-shelves">
          {rendered.map(({ key, item, state }) => (
            <li key={key}>
              {state === undefined && item ? (
                <div className={`nf-saved-slot${leaving[key] ? " nf-saved-slot--leaving" : ""}`}>
                  <div className="nf-saved-slot__inner">
                    {/* REMOVE LIVES ON THE SHELF (review of the shelves, 7
                        October: the word floating under each object looked
                        unfinished). The object and its ledge are the row; the
                        filled heart at its end is the one control, beside the
                        link rather than inside it, and a swipe on touch does
                        the same (plan items 17, 28). */}
                    <div className="nf-shelf-row">
                      <SwipeToRemove
                        label={slotCopy.remove}
                        onRemove={() => unsave(item)}
                        disabled={pending || Boolean(leaving[key])}
                      >
                        {item.card}
                      </SwipeToRemove>
                      <button
                        type="button"
                        onClick={() => unsave(item)}
                        disabled={pending || Boolean(leaving[key])}
                        aria-pressed="true"
                        aria-label={slotCopy.removeLabel}
                        title={slotCopy.remove}
                        data-testid="saved-heart"
                        className="nf-shelf-row__remove"
                      >
                        <UiIcon name="heart" size={16} filled />
                      </button>
                    </div>
                    {item.lists ?? null}
                    {changeCopy && lastSaved !== undefined ? (
                      <ChangeLine item={item} since={lastSaved} locale={locale} copy={changeCopy} />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div
                  data-testid="undo-chip"
                  className="nf-panel nf-panel--card nf-saved-undo h-full flex-row items-center justify-between gap-md p-card"
                >
                  <p className="nf-body text-[var(--nf-content-secondary)]">
                    {state === "restoring" ? slotCopy.restoring : slotCopy.removed}
                  </p>
                  <button
                    type="button"
                    onClick={() => undo(key)}
                    disabled={state === "restoring"}
                    className="nf-chip whitespace-nowrap transition-transform active:scale-[0.96] disabled:opacity-60"
                  >
                    <UiIcon name="heart" size={ICON.inline} className="shrink-0" />
                    {slotCopy.undo}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Reveal>
    </>
  );
}

/**
 * A counted phrase ("3 places", or the number where the locale puts it) with
 * its number counting up once on first view. The number is found in the
 * phrase the dictionary built, so a language that puts it after the noun
 * keeps its order; a phrase with no plain number prints as given.
 */
function CountedPhrase({ phrase, value, locale }: { phrase: string; value: number; locale: Locale }) {
  const num = formatNumber(value, locale);
  const at = phrase.indexOf(num);
  if (at < 0) return <>{phrase}</>;
  return (
    <>
      {phrase.slice(0, at)}
      <CountUp value={value} tag={intlTag[locale]} eager />
      {phrase.slice(at + num.length)}
    </>
  );
}

/**
 * B13: one muted line on a saved card when something moved since this phone
 * last opened Saved: the price, availability, or new viewing windows. A place
 * that is no longer available offers similar places nearby. It stays saved.
 */
function ChangeLine({
  item,
  since,
  locale,
  copy,
}: {
  item: SavedBoardItem;
  since: number | null;
  locale: Locale;
  copy: SavedChangeCopy & { similar: string };
}) {
  const line = changeLine(item.changes, since, locale, copy);
  if (!line) return null;
  return (
    <p className="nf-saved-change" data-gone={line.gone || undefined} data-testid="saved-change">
      <UiIcon name={line.gone ? "info" : "history"} size={16} />
      <span>{line.text}</span>
      {line.gone && item.similarHref ? (
        <Link href={item.similarHref} className="nf-saved-change__similar">
          {copy.similar}
        </Link>
      ) : null}
    </p>
  );
}
