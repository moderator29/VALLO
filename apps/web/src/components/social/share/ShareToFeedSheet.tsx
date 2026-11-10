"use client";

import { useEffect, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PostPicture } from "@/components/social/feed/PostPicture";
import {
  readListingSharePreview,
  removeListingShare,
  shareListingToFeed,
  type SharePreview,
} from "@/lib/features/listing-share/actions";
import {
  LISTING_SHARE_NOTE_MAX,
  SHARE_WORDS,
  canShareMore,
  cleanNote,
  slotsLine,
  type ShareSlots,
} from "@/lib/features/listing-share/model";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { feedback } from "@/lib/ui/feedback";
import "@/components/social/feed/feed-v2.css";
import "./listing-share.css";

type Load = { phase: "loading" } | { phase: "ready"; data: SharePreview } | { phase: "error"; message: string };

/**
 * THE SHARE SHEET: the feed card as it will look, an optional note (280
 * characters, plain text), how many shares are left before the person tries,
 * and Share. Everything it says about the limit is read from the server; the
 * database refuses a third share whatever this shows.
 */
export function ShareToFeedSheet({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: string }) {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();
  const [slots, setSlots] = useState<ShareSlots | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void readListingSharePreview({ listingId }).then(
      (result) => {
        if (!live) return;
        if (result.ok) {
          setLoad({ phase: "ready", data: result.data });
          setSlots(result.data.slots);
        } else setLoad({ phase: "error", message: result.error });
      },
      () => {
        if (live) setLoad({ phase: "error", message: SHARE_WORDS.loadFailed });
      },
    );
    return () => {
      live = false;
    };
  }, [open, listingId, attempt]);

  const ready = load.phase === "ready" ? load.data : null;
  const checked = cleanNote(note);
  const length = [...note].length;
  const full = slots ? !canShareMore(slots) : false;
  const blocked = full || Boolean(ready?.alreadyShared);
  const canSend = ready !== null && !blocked && checked.ok && length <= LISTING_SHARE_NOTE_MAX;

  function share() {
    if (!canSend || pending) return;
    start(async () => {
      const result = await shareListingToFeed({ listingId, ...(checked.ok && checked.note ? { note: checked.note } : {}) });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      feedback("select");
      setSlots(result.data.slots);
      onClose();
      const postId = result.data.postId;
      bannerWithUndo(`${SHARE_WORDS.done} ${slotsLine(result.data.slots)}.`.replace("..", "."), {
        undo: async () => {
          const undone = await removeListingShare({ postId });
          return undone.ok ? { ok: true } : { ok: false, error: undone.error };
        },
        undone: SHARE_WORDS.undone,
      });
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={SHARE_WORDS.sheetTitle}
      description={SHARE_WORDS.sheetIntro}
      closeLabel={SHARE_WORDS.close}
      detents={[0.92]}
      testId="share-to-feed-sheet"
      footer={
        <Button type="button" variant="primary" size="lg" loading={pending} disabled={!canSend} onClick={share} data-testid="share-to-feed-submit">
          {SHARE_WORDS.share}
        </Button>
      }
    >
      {load.phase === "loading" ? (
        <div className="nf-lsp" aria-busy="true" data-testid="share-sheet-loading">
          <div className="nf-lsp__card nf-skeleton" aria-hidden="true" />
          <p className="nf-caption text-[var(--nf-content-muted)]">{SHARE_WORDS.loading}</p>
        </div>
      ) : load.phase === "error" ? (
        <div className="nf-lsp" data-testid="share-sheet-error">
          <p className="nf-body text-[var(--nf-content-secondary)]">{load.message}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoad({ phase: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {SHARE_WORDS.retry}
          </Button>
        </div>
      ) : (
        <div className="nf-lsp">
          <p className="nf-lsp__label nf-caption">{SHARE_WORDS.previewLabel}</p>
          <div className="nf-lsp__card" data-testid="share-preview">
            <div className="nf-lsp__media">
              {ready?.listing.photoUrl ? (
                <PostPicture src={ready.listing.photoUrl} alt="" width={600} height={750} sizes="(max-width: 640px) 90vw, 420px" />
              ) : (
                <span className="nf-pcf__empty" aria-hidden="true">
                  <UiIcon name="house" size={40} />
                </span>
              )}
              <span className="nf-pcf__scrim" aria-hidden="true" />
              <span className="nf-pcf__tag nf-lsp__badge">{SHARE_WORDS.badge}</span>
              <div className="nf-lsp__foot" data-theme="dark">
                <p className="nf-pcf__title">{ready?.listing.title}</p>
                <p className="nf-pcf__line">
                  <span>{ready?.listing.place}</span>
                  <span className="nf-pcf__price nf-numeric">
                    {ready?.listing.priceLabel} <span className="nf-pcf__period">{ready?.listing.periodLabel}</span>
                  </span>
                </p>
                {checked.ok && checked.note ? <p className="nf-pcf__caption">{checked.note}</p> : null}
              </div>
            </div>
          </div>

          <label className="nf-lsp__note">
            <span className="nf-body font-semibold">{SHARE_WORDS.noteLabel}</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={SHARE_WORDS.notePlaceholder}
              rows={3}
              data-testid="share-note"
              aria-describedby="share-note-count"
              className="nf-lsp__textarea"
            />
            <span id="share-note-count" className="nf-caption text-[var(--nf-content-muted)]" data-testid="share-note-count">
              {SHARE_WORDS.noteCount.replace("{count}", String(length)).replace("{max}", String(LISTING_SHARE_NOTE_MAX))}
              {length > LISTING_SHARE_NOTE_MAX ? ` ${SHARE_WORDS.noteTooLong}` : !checked.ok && length > 0 ? ` ${checked.error}` : ""}
            </span>
          </label>

          <p className="nf-lsp__slots nf-body" data-testid="share-slots">
            <UiIcon name="feed" size={16} />
            <span>{ready?.alreadyShared ? SHARE_WORDS.alreadyShared : slots ? slotsLine(slots) : ""}</span>
          </p>
        </div>
      )}
    </Sheet>
  );
}
