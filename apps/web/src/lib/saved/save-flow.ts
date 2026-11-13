"use client";

import { useSyncExternalStore } from "react";
import { toggleSave } from "./actions";
import { saveRestaurant, saveStay, unsaveRestaurant, unsaveStay } from "./places-actions";
import { addLocalSave, removeLocalSave } from "./local";
import { SAVE_WORDS, saveDoneBanner } from "../ui/save-banner";
import { banner, updateToast, type ToastAction } from "../ui/toast";
import { setOrKeep } from "../offline/send-or-keep";
import { tapFailedOffline } from "../offline/tap-failed";
import type { ActionResult } from "../actions/envelope";

/**
 * A SAVE IS ANSWERED ON THE TAP (Agent FEEL, 13 November 2026).
 *
 * The founder: "the banners that should show instantly when you bookmark or
 * save a listing take about a second to pop up". Measured on production: the
 * heart flipped in about 15ms, and the banner waited for the server. It waited
 * for longer than the write, too. `toggleSave` called `revalidatePath`, and in
 * this Next a server action that revalidates renders the WHOLE current page
 * into its response before the promise settles (`skipPageRendering` is false
 * once `pathWasRevalidated` is set, node_modules/next/dist/server/app-render/
 * action-handler.js). The banner waited on the search page or the listing
 * rendering itself again.
 *
 * So, for every heart on the platform (cards, the listing page, the map):
 *
 *   1. the heart flips and the banner is raised IN THE SAME TASK AS THE TAP,
 *      worded from what the tap means (the caller plays the light haptic on
 *      the same flip, `feedback("select")`, so each heart's file says so);
 *   2. the server is told the state WANTED (`want`), never "flip", so taps in
 *      quick succession land where the last one points whatever order the
 *      answers come back in;
 *   3. the answer only corrects: a signed-out or catalogue save becomes a
 *      device save and the banner's words change in place (no second
 *      entrance); a refusal puts the heart back and says why in an error
 *      banner, with Try again. A later tap supersedes an earlier answer, so a
 *      slow failure never undoes a newer tap.
 */

export type SavePlaceTarget = { kind: "accommodation" | "restaurant"; id: string };

export type SaveTarget = {
  listingId: string;
  /** Set when the heart is on a catalogue place rather than a platform listing. */
  place?: SavePlaceTarget;
};

/** The outbox words, from the reader's dictionary (`t.platform.outbox`). */
export type SaveFlowWords = {
  savedWaiting: string;
  removedWaiting: string;
  couldNotKeep: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------ this sitting's answers */

/**
 * WHAT THIS TAB HAS SAID ABOUT A HEART, so a page brought back from the router
 * cache (going back) shows the heart as it was left rather than as the server
 * drew it before the tap. It is also what lets the save stop revalidating:
 * the cache is no longer the only place the answer lives.
 */
const sessionSaved = new Map<string, boolean>();
const listeners = new Set<() => void>();
let changeVersion = 0;

function keyOf(target: SaveTarget): string {
  return target.place ? `${target.place.kind}:${target.place.id}` : target.listingId;
}

function setSessionSaved(target: SaveTarget, value: boolean): void {
  sessionSaved.set(keyOf(target), value);
  changeVersion += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** This tab's last word on a heart, or undefined if it has not been tapped. */
export function useSessionSaved(target: SaveTarget): boolean | undefined {
  const key = keyOf(target);
  return useSyncExternalStore(
    subscribe,
    () => sessionSaved.get(key),
    () => undefined,
  );
}

/** How many save answers this tab has given; `/saved` refreshes when it moved. */
export function savedChangeVersion(): number {
  return changeVersion;
}

/* The saves still on their way to the server, so a /saved fetched in the same
   breath as a tap can be fetched again once the write has landed. */
let inFlight = 0;
let settledWaiters: (() => void)[] = [];

/** Resolves when no save is in flight (at once when none is). */
export function whenSavesSettle(): Promise<void> {
  if (inFlight === 0) return Promise.resolve();
  return new Promise((resolve) => settledWaiters.push(resolve));
}

/** Whether a save is on its way to the server right now. */
export function savesInFlight(): boolean {
  return inFlight > 0;
}

function settledOne(): void {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight > 0) return;
  const waiters = settledWaiters;
  settledWaiters = [];
  for (const resolve of waiters) resolve();
}

/** For tests. */
export function resetSessionSaves(): void {
  sessionSaved.clear();
  changeVersion = 0;
  inFlight = 0;
  settledWaiters = [];
}

/* ------------------------------------------------------------- the tap */

const latestTap = new Map<string, number>();
let tapCounter = 0;

/** Whether a catalogue id: the device owns those, the server cannot. */
export function deviceOnly(target: SaveTarget): boolean {
  return !target.place && !UUID_RE.test(target.listingId);
}

async function sendWanted(target: SaveTarget, want: boolean): Promise<ActionResult<unknown>> {
  const { place, listingId } = target;
  if (!place) return toggleSave({ listingId, want });
  if (place.kind === "accommodation") {
    return want ? saveStay({ accommodationId: place.id }) : unsaveStay({ accommodationId: place.id });
  }
  return want ? saveRestaurant({ restaurantId: place.id }) : unsaveRestaurant({ restaurantId: place.id });
}

function writeDevice(listingId: string, saved: boolean, deviceChanged: () => void): void {
  if (saved) addLocalSave(listingId);
  else removeLocalSave(listingId);
  deviceChanged();
}

export type TapSaveOptions = {
  target: SaveTarget;
  /** The state the tap asks for. */
  next: boolean;
  /** Put the heart where it should be (the caller's own optimistic state). */
  apply: (saved: boolean) => void;
  words: SaveFlowWords;
  /** Tell every heart reading the device store that it moved. */
  deviceChanged: () => void;
  /** Offered on a place refusal that is a sign-in envelope. */
  signIn?: ToastAction;
  "data-testid"?: string;
};

/**
 * One tap on a heart. Synchronous up to the banner; the server call runs
 * behind it. Resolves once the answer is in (tests await it; callers need not).
 */
export function tapSave(options: TapSaveOptions): Promise<void> {
  const { target, next, apply, words, deviceChanged } = options;
  const key = keyOf(target);
  const tap = ++tapCounter;
  latestTap.set(key, tap);
  const current = () => latestTap.get(key) === tap;

  /* Where the save lives, as far as the tap can tell; the answer may move it
     to the device (signed out), and the banner's words follow. */
  let device = deviceOnly(target);

  apply(next);
  setSessionSaved(target, next);

  const undo = async () => {
    if (device) {
      writeDevice(target.listingId, !next, deviceChanged);
      return { ok: true as const };
    }
    const back = await sendWanted(target, !next);
    return back.ok ? { ok: true as const } : { ok: false as const, error: back.error };
  };
  const bannerId = saveDoneBanner({
    saved: next,
    device,
    undo,
    onUndone: () => {
      apply(!next);
      setSessionSaved(target, !next);
    },
  });

  const rollBack = (error: string, action?: ToastAction) => {
    if (!current()) return;
    apply(!next);
    setSessionSaved(target, !next);
    banner.error(error, {
      ...(action ? { action } : { retry: () => void tapSave({ ...options }) }),
      "data-testid": options["data-testid"] ?? "save-banner",
    });
  };

  if (device) {
    writeDevice(target.listingId, next, deviceChanged);
    return Promise.resolve();
  }

  const kind = target.place ? "save_place" : "save_listing";
  inFlight += 1;
  return (async () => {
    try {
      const sent = await setOrKeep(kind, key, next, () => sendWanted(target, next));
      if (sent.state === "kept") {
        updateToast(bannerId, {
          message: next ? words.savedWaiting : words.removedWaiting,
          tone: "info",
          action: null,
        });
        return;
      }
      if (sent.state === "not_kept") {
        rollBack(words.couldNotKeep);
        return;
      }
      const result = sent.result;
      if (!result.ok) {
        /* Signed out on a platform listing: the device keeps it, as the action's
           own header promises, and the banner says where it went. */
        if (!target.place && result.error.startsWith("Sign in")) {
          device = true;
          writeDevice(target.listingId, next, deviceChanged);
          if (next) updateToast(bannerId, { message: SAVE_WORDS.savedDevice });
          return;
        }
        rollBack(result.error, target.place && result.error.startsWith("Sign in") ? options.signIn : undefined);
        return;
      }
      const data = result.data as { mode?: string; saved?: boolean } | null;
      if (data && data.mode === "local") {
        device = true;
        writeDevice(target.listingId, next, deviceChanged);
        if (next) updateToast(bannerId, { message: SAVE_WORDS.savedDevice });
        return;
      }
      /* The database is the authority: a second tab may have got there first. */
      if (data && typeof data.saved === "boolean" && data.saved !== next && current()) {
        apply(data.saved);
        setSessionSaved(target, data.saved);
      }
    } catch (error) {
      if (current()) {
        apply(!next);
        setSessionSaved(target, !next);
      }
      if (!tapFailedOffline(error)) banner.error(SAVE_WORDS.failed);
    } finally {
      settledOne();
    }
  })();
}
