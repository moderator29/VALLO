"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { ActionSheet, type ActionSheetQuick, type ActionSheetRow } from "@/components/ui/ActionSheet";
import { IconPlate } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { createShareLink } from "@/lib/share/actions";
import { toast } from "@/lib/ui/toast";
import { useCopy, useShare } from "@/lib/ui/use-copy";
import { useLongPress } from "@/lib/ui/use-long-press";
import { hideListing, isHidden, subscribeHidden, unhideListing } from "@/lib/ui/hidden-listings";
import { toggleCompare, useCompareTray } from "@/lib/compare/tray";
import { useRequireAuth } from "@/components/auth/AuthGate";
import { ShareToFeedHost } from "@/components/social/share/ShareToFeedHost";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/* English only for now: the card menu's dictionary slice has no words for these two. */
const MENU_WORDS = { message: "Message", copyLink: "Copy link" };

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
 *
 * Since 14 November 2026 it is drawn by the shared action sheet
 * (components/ui/ActionSheet.tsx): Save, Share, Compare and Message as the
 * round quick actions under the listing's photograph and title, then Share
 * to feed, Copy link and Hide as rows.
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

  const copy = useCopy();
  const { requireAuth } = useRequireAuth();
  const [feedOpen, setFeedOpen] = useState(false);

  /* THE ACTION SHEET (handoff 6.3): the listing in the header card, the
     things done most as round quick actions, the rest as rows. Every one is
     an action the card already had, plus Message (the same bridge every
     "Message agent" control uses) and Copy link (the share door, copied).
     A long press has no control to hang a popover from, so a wide screen
     gets the sheet's own centred dialog. */
  const quick: ActionSheetQuick[] = [
    {
      id: "save",
      label: saved ? words.saved : words.save,
      icon: "heart",
      active: saved,
      onSelect: onToggleSave,
      testId: "card-menu-save",
    },
    ...(shareable
      ? [
          {
            id: "share",
            label: words.share,
            icon: "share" as const,
            onSelect: async () => {
              const url = await mint();
              if (!url) {
                toast(frontDoor.share.failed, { tone: "error" });
                return;
              }
              await share({ url });
            },
            testId: "card-menu-share",
          },
        ]
      : []),
    {
      id: "compare",
      label: details.compareTray.open,
      icon: "scale",
      active: inTray,
      onSelect: () => {
        const result = toggleCompare(listingId);
        if (result.full) toast(details.compareTray.full, { tone: "error" });
      },
      testId: "card-menu-compare",
    },
    ...(shareable
      ? [
          {
            id: "message",
            label: MENU_WORDS.message,
            icon: "chat-bubble" as const,
            href: `/messages/new?listing=${encodeURIComponent(listingId)}`,
            testId: "card-menu-message",
          },
        ]
      : []),
  ];

  const rows: ActionSheetRow[] = [
    ...(shareable
      ? [
          {
            id: "share-to-feed",
            label: SHARE_WORDS.button,
            icon: "feed" as const,
            chevron: true,
            onSelect: () => requireAuth("share", () => setFeedOpen(true)),
            testId: "card-menu-share-to-feed",
          },
          {
            id: "copy-link",
            label: MENU_WORDS.copyLink,
            icon: "link" as const,
            onSelect: async () => {
              const url = await mint();
              if (!url) {
                toast(frontDoor.share.failed, { tone: "error" });
                return;
              }
              await copy(url, "link");
            },
            testId: "card-menu-copy-link",
          },
        ]
      : []),
    ...(!saved
      ? [
          {
            id: "hide",
            label: words.hide,
            icon: "eye-off" as const,
            onSelect: () => {
              hideListing(listingId);
              toast(words.hidden, {
                action: { label: words.undo, run: () => unhideListing(listingId) },
              });
            },
            testId: "card-menu-hide",
          },
        ]
      : []),
  ];

  return (
    <>
      <ShareToFeedHost listingId={listingId} open={feedOpen} onClose={() => setFeedOpen(false)} />
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        title={words.title}
        testId="card-menu"
        header={{
          title,
          media: thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- the card's own photograph, already in cache
            <img src={thumb} alt="" className="nf-card-menu__thumb" />
          ) : (
            <IconPlate size="md" shape="round">
              <UiIcon name="house" size={20} />
            </IconPlate>
          ),
        }}
        quick={quick}
        rows={rows}
      />
    </>
  );
}
