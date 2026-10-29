"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { createShareLink } from "@/lib/share/actions";
import { toast } from "@/lib/ui/toast";
import { useShare } from "@/lib/ui/use-copy";
import { useLongPress } from "@/lib/ui/use-long-press";
import { hideListing, isHidden, subscribeHidden, unhideListing } from "@/lib/ui/hidden-listings";
import { toggleCompare, useCompareTray } from "@/lib/compare/tray";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/**
 * THE LISTING CARD'S LONG-PRESS MENU (details pass, 30 September 2026).
 *
 * Hold a card and a short sheet rises with the three things people do to a
 * card without opening it: Save (or take it out of saved), Share, and Hide
 * from my results. A phone's own long press does the same (Android fires a
 * context menu on a held link); a mouse's right click keeps the browser's
 * menu.
 *
 *   Save    goes through the card's own `useSaveControl`, so the heart on the
 *           card and the row here are one state, optimistic, felt as a confirm
 *           when the server accepts it.
 *   Share   mints the listing's share door as the sheet opens (Safari drops
 *           the gesture across a round trip; `ListingActions` says why), then
 *           hands it to the phone's share sheet or the clipboard. A door goes
 *           out with no title (rule 10). An Example, which has no door, is not
 *           offered for sharing.
 *   Hide    this phone only (`lib/ui/hidden-listings.ts`), with Undo in the
 *           toast. A saved listing cannot be hidden.
 */
export function useCardMenu(listingId: string, options: { shareable: boolean }) {
  const [open, setOpen] = useState(false);
  const door = useRef<Promise<string | null> | null>(null);
  const mint = useCallback((): Promise<string | null> => {
    if (!options.shareable) return Promise.resolve(null);
    if (!door.current) {
      door.current = createShareLink({ kind: "listing", targetId: listingId })
        .then((result) => (result.ok ? `${window.location.origin}${result.data.path}` : null))
        .catch(() => null)
        .then((url) => {
          if (url === null) door.current = null;
          return url;
        });
    }
    return door.current;
  }, [listingId, options.shareable]);

  const press = useLongPress(() => {
    setOpen(true);
    void mint();
  });

  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => isHidden(listingId),
    () => false,
  );

  return { open, setOpen, mint, press, hidden } as const;
}

export function CardMenu({
  open,
  onOpenChange,
  listingId,
  title,
  thumb,
  saved,
  onToggleSave,
  mint,
  shareable,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  listingId: string;
  title: string;
  thumb?: string | undefined;
  saved: boolean;
  onToggleSave(): void;
  mint(): Promise<string | null>;
  shareable: boolean;
}) {
  /* From the root layout's client copy, not the card's dictionary slice: the
     slice (lib/i18n/slice.ts) carries only what `t` reaches. Destructured, so
     the slice-coverage walk does not count these as the slice's namespaces. */
  const { details, frontDoor } = useClientCopy();
  const words = details.cardMenu;
  const share = useShare();
  const compare = useCompareTray();
  const inTray = compare.has(listingId);

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={words.title} hideTitle detents={[0.5]} testId="card-menu">
      <div className="nf-card-menu__head">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- the card's own photograph, already in cache
          <img src={thumb} alt="" className="nf-card-menu__thumb" />
        ) : (
          <IconPlate size="md" shape="round">
            <UiIcon name="house" size={20} />
          </IconPlate>
        )}
        <p className="nf-body min-w-0 truncate font-semibold text-[var(--nf-content-primary)]">{title}</p>
      </div>
      <ListGroup>
        <ListRow
          data-testid="card-menu-save"
          leading={
            <IconPlate size="sm" shape="round" tone="brand">
              <UiIcon name="heart" size={18} filled={saved} />
            </IconPlate>
          }
          title={saved ? words.unsave : words.save}
          onClick={() => {
            onToggleSave();
            close();
          }}
        />
        {shareable ? (
          <ListRow
            data-testid="card-menu-share"
            leading={
              <IconPlate size="sm" shape="round" tone="info">
                <UiIcon name="share" size={18} />
              </IconPlate>
            }
            title={words.share}
            onClick={async () => {
              close();
              const url = await mint();
              if (!url) {
                toast(frontDoor.share.failed, { tone: "error" });
                return;
              }
              await share({ url });
            }}
          />
        ) : null}
        <ListRow
          data-testid="card-menu-compare"
          leading={
            <IconPlate size="sm" shape="round" tone="info">
              <UiIcon name="scale" size={18} filled={inTray} />
            </IconPlate>
          }
          title={inTray ? details.compareTray.remove : details.compareTray.add}
          onClick={() => {
            close();
            const result = toggleCompare(listingId);
            if (result.full) toast(details.compareTray.full, { tone: "error" });
            else toast(result.on ? details.compareTray.added : details.compareTray.removed);
          }}
        />
        {!saved ? (
          <ListRow
            data-testid="card-menu-hide"
            leading={
              <IconPlate size="sm" shape="round">
                <UiIcon name="eye-off" size={18} />
              </IconPlate>
            }
            title={words.hide}
            onClick={() => {
              close();
              hideListing(listingId);
              toast(words.hidden, {
                action: { label: words.undo, run: () => unhideListing(listingId) },
              });
            }}
          />
        ) : null}
      </ListGroup>
    </Sheet>
  );
}
