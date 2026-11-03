"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AuthGate } from "@/components/auth/AuthGate";
import { toggleSave } from "@/lib/saved/actions";
import {
  saveRestaurant,
  saveStay,
  unsaveRestaurant,
  unsaveStay,
} from "@/lib/saved/places-actions";
import { addLocalSave, removeLocalSave } from "@/lib/saved/local";
import {
  deviceSavesChanged,
  useDeviceSaved,
  type SavePlaceTarget,
} from "@/components/app/SaveControl";
import { ShareSheet } from "@/components/app/messages/ShareSheet";
import type { SharedKind } from "@/components/app/messages/share";
import { createShareLink } from "@/lib/share/actions";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { nativeShare } from "@/lib/native/device";
import { feedback } from "@/lib/ui/feedback";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The two controls that float over the gallery: share and save.
 *
 * They sit on photography rather than on the page canvas, so they are painted
 * as dark glass with white marks in both themes deliberately: a paper-white
 * control would vanish on a bright photo, and a night-only glass panel would
 * look wrong in daylight. Everything underneath them is an image, so this is
 * the one place where the same treatment is correct at noon and at midnight.
 *
 * That reasoning was right and the implementation was not: it was written as
 * bg-black/45, border-white/25 and text-white, by hand, in this file and in
 * five others, so nothing recorded WHY the darkness was deliberate and nothing
 * distinguished it from the dark-only literals that genuinely do break in
 * daylight. It now reads the `-on-media` token family, which is theme
 * independent on purpose and says so in one place.
 *
 * Save flips instantly and settles against the truth the action returns:
 * a catalogue listing is kept on the device, a platform listing is a row under
 * RLS, and a write that fails puts the heart straight back and says why.
 *
 * THE HEART ON A STAY AND ON A RESTAURANT WROTE NOTHING, which is worse than
 * having no heart at all. `/stay/<id>` carries an ACCOMMODATION id and the
 * venue face carries a BUSINESS id; `saved_items.listing_id` has a foreign key
 * to `public.listings`, so both taps came back as "this place is no longer
 * available, so it cannot be saved" against a place that was right there on the
 * screen. Their shortlist is `saved_places`, and `place` is how this control is
 * told which shelf it is writing to. Absent, it is a listing and nothing about
 * the old path changes.
 *
 * SHARE ASKS WHICH SHARE IT IS, and it used to have only one answer. It called
 * the browser's own sheet and fell back to the clipboard, which sends a place
 * to somebody who is NOT on Vallo. The founder's complaint was that he could
 * not send a property into somebody's DMs, and every part of that path already
 * existed apart from the way in: `/messages/share/<kind>/<id>` lists his own
 * conversations under RLS and sends a real message that the thread expands
 * into a card. `ShareSheet` is the way in, and the link is still the second
 * row on it, so the control is never a dead end either way.
 */

const TOAST_MS = 2600;

/** Copy without the clipboard permission, for browsers that refuse it. */
function copyByExecCommand(text: string): boolean {
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const done = document.execCommand("copy");
    document.body.removeChild(field);
    return done;
  } catch {
    return false;
  }
}

export function ListingActions({
  listingId,
  title,
  initialSaved = false,
  shareKind = "listing",
  place,
}: {
  listingId: string;
  title: string;
  /** Whether this listing is already on the account's shortlist. */
  initialSaved?: boolean;
  /**
   * Set on a catalogue place rather than a platform listing: an accommodation
   * on `/stay/<id>`, a business venue on `/restaurant/<id>`. It decides which
   * table the heart writes to. See the note above this component.
   */
  place?: SavePlaceTarget;
  /**
   * What `listingId` IS, for the share path.
   *
   * `/stay/<id>` carries an ACCOMMODATION id, not a listing id, so a stay
   * shared as a listing resolves to nothing. The stay page says `stay`; the
   * listing and restaurant pages both carry listing ids and leave this alone.
   */
  shareKind?: SharedKind;
}) {
  const signInHref = useSignInHref();
  /*
   * The device's answer, from the one store every heart reads.
   *
   * This was `useState(initialSaved)` plus an effect that read `localStorage`
   * on mount, which is the version `SaveControl`'s store docstring calls out by
   * name as "what the detail page does". Two consequences, and the cascading
   * render React complains about is the smaller one: the heart on this page and
   * the same heart on a card behind it held separate copies of one fact, so
   * saving here left the card stale until a reload.
   *
   * `override` is this page's own optimistic answer, `null` until somebody taps.
   * The stored truth wins until then, exactly as `useSaveControl` does it.
   */
  const [override, setOverride] = useState<boolean | null>(null);
  const onDevice = useDeviceSaved(listingId);
  const saved = override ?? (initialSaved || onDevice);
  const setSaved = setOverride;
  const [message, setMessage] = useState<string | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const t = useClientCopy();
  /*
   * THE SHARE DOOR (V-07), MINTED WHEN THE SHEET OPENS.
   *
   * A platform listing is shared as its door, `/s/<token>`, never as its own
   * address: `/listing/<id>` is gated, so it unfurls in WhatsApp as a sign-in
   * page. The door is a public card (area only, move-in total, the code) whose
   * button carries the listing through sign in.
   *
   * Minted as the sheet opens rather than on the tap, because
   * `navigator.share` needs the user's gesture and Safari withdraws it across
   * a server round trip: by the time "Share elsewhere" is tapped the door is
   * usually already in hand. A stay (an accommodation id) mints a stay door,
   * whose button carries `/stay/<id>` through sign in; a venue (a business
   * id) has no door yet and keeps sharing its own address.
   */
  const doorKind: "listing" | "stay" | null =
    shareKind === "listing" && !place
      ? "listing"
      : shareKind === "stay" && place?.kind === "accommodation"
        ? "stay"
        : null;
  const doorable = doorKind !== null;
  const door = useRef<Promise<string | null> | null>(null);
  const mintDoor = useCallback((): Promise<string | null> => {
    if (!door.current && doorKind !== null) {
      door.current = createShareLink({ kind: doorKind, targetId: listingId })
        .then((result) => (result.ok ? `${window.location.origin}${result.data.path}` : null))
        .catch(() => null)
        .then((url) => {
          /* A failure is not remembered: the next open asks again. */
          if (url === null) door.current = null;
          return url;
        });
    }
    return door.current ?? Promise.resolve(null);
  }, [listingId, doorKind]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const say = useCallback((text: string, prompt = false) => {
    setMessage(text);
    setSignInPrompt(prompt);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMessage(null);
      setSignInPrompt(false);
    }, TOAST_MS);
  }, []);

  function toggle() {
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setMessage(null);
    setSignInPrompt(false);

    startTransition(async () => {
      try {
        if (place) {
          /* The other shelf. Save and unsave are separate intents, as the
             actions are written, so a double tap cannot flip a shortlist the
             wrong way. There is no device half here: `saved_items` takes
             listing ids only, so a signed-out tap is answered by the sign-in
             prompt the envelope already carries rather than by a local save
             that could never be reconciled. */
          const result =
            place.kind === "accommodation"
              ? next
                ? await saveStay({ accommodationId: place.id })
                : await unsaveStay({ accommodationId: place.id })
              : next
                ? await saveRestaurant({ restaurantId: place.id })
                : await unsaveRestaurant({ restaurantId: place.id });
          if (!result.ok) {
            setSaved(!next);
            say(result.error, result.error.startsWith("Sign in"));
            return;
          }
          say(next ? "Saved to your shortlist" : "Removed from saved");
          return;
        }

        const result = await toggleSave({ listingId });
        if (!result.ok) {
          // Nothing changed anywhere, so the heart goes back exactly as it was.
          setSaved(!next);
          say(result.error, result.error.startsWith("Sign in"));
          return;
        }
        if (result.data.mode === "local") {
          // A catalogue id can never be a row, so the device owns this save.
          if (next) addLocalSave(listingId);
          else removeLocalSave(listingId);
          if (next) feedback("select");
          /* And the store is told, so every other heart for this listing on the
             page behind this one moves with it rather than waiting for a reload. */
          deviceSavesChanged();
          say(next ? "Saved to your shortlist" : "Removed from saved");
          return;
        }
        setSaved(result.data.saved);
        /* B14: a save is felt once the server ACCEPTS it, as the toggle it
           is: the light beat (CRAFT_DOCTRINE 6: light for a toggle). "success"
           is kept for payoffs, so a heart never feels like a settled payment. */
        if (result.data.saved) feedback("select");
        say(result.data.saved ? "Saved to your shortlist" : "Removed from saved");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /*
   * SHARING OFF VALLO. The button no longer calls this directly: the sheet
   * above it asks whether the place is going to somebody's DMs or to the
   * outside world, because the founder could not do the first one at all and
   * this was the whole of what "share" meant. This is the second answer.
   */
  async function shareElsewhere() {
    if (typeof window === "undefined") return;
    let url = window.location.href;
    if (doorable) {
      const minted = await mintDoor();
      if (minted === null) {
        /* No door, no share. The listing's own address would unfurl as a
           sign-in page, which is the failure this replaces. */
        say(t.frontDoor.share.failed);
        return;
      }
      url = minted;
    }

    /* STORE-04: inside the app, the operating system's own share sheet. */
    const native = await nativeShare({ title, url });
    if (native !== "unhandled") return;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        /* Rule 10: a door goes out with NO title. The lister's own title (or a
           stay's business name) is free text, and the share sheet hands it to
           whatever app is chosen next to the link; the door's card composes
           its own heading from facts. An undoored place (a venue) goes out
           with no title either: its name is text somebody typed as well. */
        await navigator.share({ url });
        return;
      } catch (error) {
        // A cancelled sheet is not a failure and must not raise a message.
        if (error instanceof DOMException && error.name === "AbortError") return;
        /* NotAllowedError (the gesture expired across the mint) falls
           through to the clipboard below, which is the same link. */
      }
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = copyByExecCommand(url);
    }
    say(
      copied
        ? t.frontDoor.share.copied
        : doorable
          ? `${t.frontDoor.share.copyFallback}: ${url}`
          : "Copy the link from your browser's address bar",
    );
  }

  return (
    /*
     * `nf-safe-top` is padding rather than an offset, so these clear the notch
     * while the photography still runs full bleed behind them. 44px circles on
     * the soft float shadow (section 17's round header buttons), which is the
     * App Store minimum and what the pair used to miss by four.
     */
    <div className="nf-safe-top absolute right-3 top-3 z-20 flex flex-col items-end gap-xs sm:right-4 sm:top-4">
      <div className="flex items-center gap-xs">
        <button
          type="button"
          onClick={() => {
            setShareOpen(true);
            if (doorable) void mintDoor();
          }}
          aria-haspopup="dialog"
          aria-expanded={shareOpen}
          aria-label="Share this listing"
          data-testid="listing-share"
          data-theme="light"
          className="grid h-11 w-11 place-items-center nf-icon-btn nf-icon-btn--round transition-transform active:scale-90 motion-reduce:transition-none"
        >
          <UiIcon name="share" size={16} />
        </button>
        {/*
          Save gates. Share does not, and the difference is the whole rule:
          sharing a link is a thing a guest may do to a page they are allowed to
          read, and saving writes a row against an account.

          Wrapped rather than checked inside `toggle`, because `toggle` already
          flips the heart optimistically before the server answers, and a check
          inside it would flip a heart we are about to navigate away from. The
          gate intercepts in the capture phase, so for a guest the handler never
          runs at all and they arrive at sign-up with `?do=save` on the URL they
          came from.
        */}
        <AuthGate action="save">
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save this listing"}
            data-testid="listing-save"
            data-theme="light"
            className="grid h-11 w-11 place-items-center nf-icon-btn nf-icon-btn--round transition-transform active:scale-90 disabled:opacity-70 motion-reduce:transition-none"
          >
            <UiIcon
              name="heart"
              size={16}
              className={saved ? "text-[var(--nf-status-verified)] [&_path]:fill-current" : undefined}
            />
          </button>
        </AuthGate>
      </div>

      {message && (
        <p
          role="status"
          data-testid="listing-action-message"
          className="max-w-[15rem] rounded-[var(--nf-radius-xs)] nf-media-chip px-sm py-xs text-right font-semibold leading-snug"
        >
          {message}
          {signInPrompt && (
            <Link href={signInHref} className="ml-2xs font-semibold underline underline-offset-2">
              Sign in
            </Link>
          )}
        </p>
      )}

      {/* The way into somebody's DMs, and the way out to everywhere else. */}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        kind={shareKind}
        id={listingId}
        title={title}
        onShareElsewhere={() => void shareElsewhere()}
        elsewhereBody={
          doorKind === "stay"
            ? t.frontDoor.share.elsewhereBodyStay
            : doorable
              ? t.frontDoor.share.elsewhereBody
              : undefined
        }
      />
    </div>
  );
}
