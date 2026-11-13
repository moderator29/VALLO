"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { readLocalSaves } from "@/lib/saved/local";
import { feedback } from "@/lib/ui/feedback";
import { tapSave, useSessionSaved, type SavePlaceTarget } from "@/lib/saved/save-flow";
import { useClientCopy } from "@/lib/i18n/client-copy";


/**
 * The heart, on anything that shows a listing.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AS A COMPONENT AT ALL.
 *
 * The save loop was written three times and rendered in two places. The
 * detail page had it, the map's dock had it, and `/saved` had the half of it
 * that removes. THE GRID DID NOT, so the same flat was savable in Map view and
 * not savable in List view, and `/saved`'s own empty state said "Tap the heart
 * on any place and it waits for you here" about a control the grid did not
 * offer. Saving is the cheapest step in the funnel and it was costing a page
 * load per property on a product whose whole job is comparison.
 *
 * So the optimistic flip, the revert, the device fallback and the two stores
 * live here once, and a surface renders one element.
 *
 * ---------------------------------------------------------------------------
 * A SIGNED-OUT TAP IS KEPT, NOT REFUSED. This is the part worth reading.
 *
 * `lib/saved/actions.ts` says in its own header: "Signed out, a platform
 * listing returns the sign-in envelope. The tap is not lost: the client has
 * already written the save locally and re-plays it once the account exists."
 * That was the intent and no client did it. `ListingActions` reverts the heart
 * and raises a sign-in prompt, so the tap IS lost, and on a card in a grid a
 * prompt is worse still: twenty cards cannot each carry a dialogue.
 *
 * Here, the signed-out envelope is treated as the device's answer. The save
 * goes to localStorage and to the cookie mirror, the heart stays on, and
 * `/saved` renders it on the next server paint because the cookie is read
 * there already. Nothing is promised that is not true: the caption says the
 * save is on this device, because that is where it is.
 *
 * The message is matched on its opening words rather than on the exported
 * constant, because `SIGNED_OUT_MESSAGE` lives in a `server-only` module and
 * cannot be imported into a client component. `ListingActions` matches it the
 * same way. It is a seam, and it is named here so the next reader can see it
 * rather than discover it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SAYS, AND WHERE.
 *
 * A card in a grid has no room for a toast and must not change height when one
 * arrives, because a row of cards that reflows under a thumb is how a person
 * taps the wrong property. So the note is rendered by the CALLER, wherever it
 * has space that is already reserved, and this component only decides what the
 * words are. On the card that space is the media band, which is a fixed ratio.
 */

/** The banner's words for a save (Grade 1: specific, never a bare "Saved"). */

export type SaveNote = { text: string; tone: "ok" | "error" } | null;

/* ------------------------------------------------- the device's shortlist */

/**
 * The device half of the shortlist, as a store every heart on the screen reads.
 *
 * WHY NOT AN EFFECT. The obvious version is `useEffect(() => { if
 * (readLocalSaves().has(id)) setSaved(true) })`, which is what the detail page
 * does. It works and it costs a second render per card, so twenty cards in a
 * grid is twenty cascading renders after hydration, and `react-hooks/
 * set-state-in-effect` is right to complain about it.
 *
 * `useSyncExternalStore` is the answer React added for exactly this shape:
 * server state that the client can see and the server cannot. The server
 * snapshot is `false`, the client snapshot is the truth, and the hearts that
 * belong to the same listing on two surfaces move together because they read
 * one store.
 *
 * THE SNAPSHOT IS CACHED PER VERSION, and it has to be. `getSnapshot` runs on
 * every render, `readLocalSaves` parses localStorage and `document.cookie`, and
 * a store that returns a fresh object every call makes React loop. The version
 * counter moves only when this module writes.
 */
const listeners = new Set<() => void>();
let version = 0;
let cachedAt = -1;
let cachedIds = new Set<string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function savedIds(): Set<string> {
  if (cachedAt !== version) {
    cachedIds = new Set(readLocalSaves().map((save) => save.id));
    cachedAt = version;
  }
  return cachedIds;
}

function deviceChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Tell the store the device list moved underneath it.
 *
 * Exported for the one surface that writes device saves without going through
 * `useSaveControl`: the listing detail page calls `addLocalSave` /
 * `removeLocalSave` itself, inside its own transition, because it has a toast
 * and a sign-in prompt to sequence around the write. Without this the store
 * keeps its cached version and every other heart on the page behind it stays
 * stale until a reload - which is the same two-copies-of-one-fact bug the store
 * exists to end, arriving through the write side instead of the read side.
 */
export function deviceSavesChanged(): void {
  deviceChanged();
}

/**
 * Whether this listing is on the device, read from the store above.
 *
 * Exported because the listing DETAIL page was the one surface still doing this
 * with an effect - `useEffect(() => { if (readLocalSaves().some(...))
 * setSaved(true) })` - which is the exact shape the store's own docstring names
 * as the version it replaced. Two copies of one fact meant a heart on the
 * detail page and the same heart on a card behind it could disagree until a
 * reload.
 *
 * It is the read side only. A surface that WRITES still goes through
 * `useSaveControl`, which is what bumps the version.
 */
export function useDeviceSaved(listingId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => savedIds().has(listingId),
    () => false,
  );
}

/**
 * THE OTHER SHELF, AND WHY THE HEART NEEDED A SECOND DESTINATION.
 *
 * `saved_items.listing_id` has a foreign key to `public.listings`, so a hotel
 * or a restaurant can never be a row in it: the catalogue holds them as
 * accommodations and businesses, and their shortlist is `saved_places`. A
 * stay card hearted through `toggleSave` therefore wrote nothing and came
 * back with the withdrawn-listing refusal, which is a heart that looks like a
 * control and is a picture of one. `lib/saved/places-actions.ts` has the two
 * pairs of writes, by name, each revalidating /saved; this is the target a
 * card hands over so the tap lands in the right table.
 */
export type { SavePlaceTarget } from "@/lib/saved/save-flow";

export function useSaveControl(
  listingId: string,
  initialSaved = false,
  /**
   * Set when this card is a catalogue place rather than a platform listing.
   * The device half does not apply: `saved_places` is an account's own table
   * and there is no signed-out mirror for it, so a caller draws this heart
   * only for a reader who is signed in (see `StayCard`).
   */
  place?: SavePlaceTarget,
) {
  /* V-40 copy in the viewer's own language. */
  const OUTBOX_COPY = useClientCopy().platform.outbox;
  /**
   * The person's own answer on this card, once they have given one. `null`
   * means they have not touched this heart here, so this tab's last word on
   * the listing (`useSessionSaved`, which survives a page coming back from the
   * router cache) and then the stored truth win.
   */
  const [override, setOverride] = useState<boolean | null>(null);
  /* Always null since Grade 1: the banner says it. */
  const note = null as SaveNote;

  const onDevice = useSyncExternalStore(
    subscribe,
    () => savedIds().has(listingId),
    () => false,
  );
  const session = useSessionSaved({ listingId, ...(place ? { place } : {}) });
  const saved = override ?? session ?? (initialSaved || onDevice);

  /* ANSWERED ON THE TAP (lib/saved/save-flow.ts): the heart, the haptic and
     the banner all land in the tap's own task; the server call runs behind
     and only corrects. Never disabled while a call is out: the next tap
     sends the state it wants, so taps in a row cannot cross. */
  const toggle = useCallback(() => {
    const next = !saved;
    /* B14: the light beat, on the flip itself (CRAFT_DOCTRINE 6: light for a
       toggle); taking a heart back is quiet. */
    if (next) feedback("select");
    void tapSave({
      target: { listingId, ...(place ? { place } : {}) },
      next,
      apply: setOverride,
      words: OUTBOX_COPY,
      deviceChanged,
      "data-testid": "save-banner",
    });
  }, [listingId, place, saved, OUTBOX_COPY]);

  return { saved, note, pending: false, toggle };
}

/**
 * The control itself: a heart that fills.
 *
 * `filled` rather than a colour change, because the previous "active" state in
 * this product was a stroke difference of 0.18 CSS pixels, which is invisible,
 * and because a filled silhouette survives greyscale where a hue does not.
 * `aria-pressed` carries the same fact to anybody who cannot see either.
 *
 * So the name does not change with the state: it is "Save to favourites" in
 * the reader's language, pressed or not, and the property's title is the
 * description. It was "Save {title}" and "Remove {title} from saved" in
 * English on every page, which also said the state twice over.
 */
export function SaveButton({
  saved,
  pending,
  onToggle,
  title,
  className,
  surface = "page",
}: {
  saved: boolean;
  pending: boolean;
  onToggle: () => void;
  /** The description, so a screen reader hears which property this is. */
  title: string;
  className?: string;
  /** On a photograph the heart is the glass square of the renders. */
  surface?: "page" | "media";
}) {
  const name = useClientCopy().a11y.favourite;
  const titleId = useId();
  /* Plan item 28: the tap that SAVES pops the heart once (1, 1.22, 1 on the
     spring, `list-views.css`); the tap that unsaves just empties it. The
     count remounts the glyph so every save restarts the pop. */
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        if (!saved) setPop((n) => n + 1);
        onToggle();
      }}
      disabled={pending}
      aria-pressed={saved}
      aria-label={name}
      aria-describedby={titleId}
      data-testid="card-save"
      className={[surface === "media" ? "nf-pcard__heart" : "nf-icon-btn", pop > 0 ? "nf-heart-pop" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <UiIcon
        key={pop}
        name="heart"
        size="sm"
        filled={saved}
        className={saved && surface === "page" ? "text-[var(--nf-brand-primary)]" : undefined}
      />
      <span id={titleId} hidden>
        {title}
      </span>
    </button>
  );
}
