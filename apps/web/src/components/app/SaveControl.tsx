"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { toggleSave } from "@/lib/saved/actions";
import { feedback } from "@/lib/ui/feedback";
import {
  saveRestaurant,
  saveStay,
  unsaveRestaurant,
  unsaveStay,
} from "@/lib/saved/places-actions";
import { addLocalSave, readLocalSaves, removeLocalSave } from "@/lib/saved/local";
import { enqueue, makeEntry } from "@/lib/offline/outbox";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";


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

/** How long a note stays before it clears. Matches `ListingActions`. */
const NOTE_MS = 2600;

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
export type SavePlaceTarget = { kind: "accommodation" | "restaurant"; id: string };

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
   * The person's own answer, once they have given one. `null` means they have
   * not touched this heart on this page, so the stored truth wins.
   */
  const [override, setOverride] = useState<boolean | null>(null);
  const [note, setNote] = useState<SaveNote>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDevice = useSyncExternalStore(
    subscribe,
    () => savedIds().has(listingId),
    () => false,
  );
  const saved = override ?? (initialSaved || onDevice);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const say = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setNote({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  const toggle = useCallback(() => {
    if (pending) return;
    const next = !saved;
    setOverride(next);
    setNote(null);

    /* V-40: no signal is not a failure. The intent is kept on the phone and
       sent, as the state wanted, when the connection comes back. */
    const keepForLater = async () => {
      const entry = place
        ? makeEntry("save_place", `${place.kind}:${place.id}`, next, Date.now())
        : makeEntry("save_listing", listingId, next, Date.now());
      if (entry && (await enqueue(entry))) {
        say(next ? OUTBOX_COPY.savedWaiting : OUTBOX_COPY.removedWaiting);
        return;
      }
      setOverride(!next);
      say(OUTBOX_COPY.couldNotKeep, "error");
    };

    startTransition(async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          await keepForLater();
          return;
        }
        try {
          await sendNow();
        } catch {
          /* The request never came back: the network dropped under it. */
          await keepForLater();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

    async function sendNow(): Promise<void> {
      if (place) {
        /* The place shelf. Save and unsave are separate intents rather than a
           toggle, exactly as the actions are written: a double tap or a stale
           tab cannot flip somebody's shortlist the wrong way. */
        const result =
          place.kind === "accommodation"
            ? next
              ? await saveStay({ accommodationId: place.id })
              : await unsaveStay({ accommodationId: place.id })
            : next
              ? await saveRestaurant({ restaurantId: place.id })
              : await unsaveRestaurant({ restaurantId: place.id });
        if (!result.ok) {
          setOverride(!next);
          say(result.error, "error");
          return;
        }
        if (next) feedback("select");
        say(next ? "Saved" : "Removed");
        return;
      }

      const result = await toggleSave({ listingId });

      /* Signed out, or a catalogue id the foreign key can never accept. Both
         are the device's answer and both are a real save. */
      const deviceOwns =
        (result.ok && result.data.mode === "local") ||
        (!result.ok && result.error.startsWith("Sign in"));

      if (deviceOwns) {
        if (next) addLocalSave(listingId);
        else removeLocalSave(listingId);
        deviceChanged();
        if (next) feedback("select");
        say(next ? "Saved on this device" : "Removed");
        return;
      }

      if (!result.ok) {
        // Nothing changed anywhere, so the heart goes back exactly as it was.
        setOverride(!next);
        say(result.error, "error");
        return;
      }

      const settled = result.data.mode === "db" ? result.data.saved : next;
      setOverride(settled);
      /* B14: the heart is felt only once the save is ACCEPTED, and as the
         toggle it is: the light beat (CRAFT_DOCTRINE 6). A medium beat is
         for a primary action committing, and a heart is not one. */
      if (settled) feedback("select");
      say(settled ? "Saved" : "Removed");
    }
  }, [listingId, pending, place, saved, say, OUTBOX_COPY]);

  return { saved, note, pending, toggle };
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
