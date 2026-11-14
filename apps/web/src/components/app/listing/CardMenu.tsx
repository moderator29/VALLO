"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { ActionSheet, type QuickAction, type SheetRow } from "@/components/ui/ActionSheet";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { createShareLink } from "@/lib/share/actions";
import { banner, toast } from "@/lib/ui/toast";
import { useShare } from "@/lib/ui/use-copy";
import { useLongPress } from "@/lib/ui/use-long-press";
import { hideListing, isHidden, subscribeHidden, unhideListing } from "@/lib/ui/hidden-listings";
import { toggleCompare, useCompareTray } from "@/lib/compare/tray";
import { useRequireAuth } from "@/components/auth/AuthGate";
import { ShareToFeedHost } from "@/components/social/share/ShareToFeedHost";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";
import { POST_COPY } from "@/lib/social/posts-model";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/**
 * THE LISTING CARD'S LONG-PRESS MENU (details pass, 30 September 2026; moved
 * onto the shared `ActionSheet` on 14 November 2026).
 *
 * Hold a card and a short sheet rises: the listing itself at the top with its
 * photograph, its title and its price, a chevron into the listing; a row of
 * round quick actions for the four things people do to a card without
 * reading it; then the quieter rows. A phone's own long press does the same
 * (Android fires a context menu on a held link); a mouse's right click keeps
 * the browser's menu.
 *
 *   Save    goes through the card's own `useSaveControl`, so the heart on the
 *           card and the circle here are one state, optimistic, felt as a
 *           confirm when the server accepts it.
 *   Share   mints the listing's share door as the sheet opens (Safari drops
 *           the gesture across a round trip; `ListingActions` says why), then
 *           hands it to the phone's share sheet or the clipboard. A door goes
 *           out with no title (rule 10). An Example, which has no door, is
 *           offered neither for sharing nor for copying.
 *   Compare puts it in the compare tray, or takes it out.
 *   Message opens the conversation with the lister, where the card has one.
 *   Copy link  takes the same minted door to the clipboard, said in the quick
 *           pill rather than the top banner (handoff 6.1).
 *   See similar  the same search this card's area already answers.
 *   Hide    this phone only (`lib/ui/hidden-listings.ts`), with Undo in the
 *           banner. A saved listing cannot be hidden.
 *
 * REPORT IS NOT HERE and that is deliberate: reporting a listing asks for a
 * reason and a sentence (`ReportSheetPanel`), which is a form, not a menu
 * row, and it lives on the listing page where the evidence is. A row that
 * opened a second sheet from a long press on a card in a list would be a
 * dead end on the way to a form.
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
  priceLine,
  href,
  messageHref,
  messageLabel,
  similarHref,
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
  /** The price as the card already prints it, under the title. */
  priceLine?: string | undefined;
  /** The listing itself, opened by the head card's chevron. */
  href?: string | undefined;
  /** The conversation with the lister, where this card offers one. */
  messageHref?: string | undefined;
  /** That circle's word, from the card's own dictionary (`shape.card`). */
  messageLabel?: string | undefined;
  /** The search that answers "more like this". */
  similarHref?: string | undefined;
}) {
  /* From the root layout's client copy, not the card's dictionary slice: the
     slice (lib/i18n/slice.ts) carries only what `t` reaches. Destructured, so
     the slice-coverage walk does not count these as the slice's namespaces. */
  const { details, frontDoor } = useClientCopy();
  const words = details.cardMenu;
  const share = useShare();
  const compare = useCompareTray();
  const inTray = compare.has(listingId);

  const { requireAuth } = useRequireAuth();
  const [feedOpen, setFeedOpen] = useState(false);

  const shareNow = async () => {
    const url = await mint();
    if (!url) {
      toast(frontDoor.share.failed, { tone: "error" });
      return;
    }
    await share({ url });
  };

  const quick: QuickAction[] = [
    {
      key: "save",
      label: saved ? words.unsave : words.save,
      icon: "heart",
      on: saved,
      onSelect: onToggleSave,
      "data-testid": "card-menu-save",
    },
    ...(shareable
      ? [
          {
            key: "share",
            label: words.share,
            icon: "share" as const,
            onSelect: () => {
              void shareNow();
            },
            "data-testid": "card-menu-share",
          },
        ]
      : []),
    {
      key: "compare",
      label: inTray ? details.compareTray.remove : details.compareTray.add,
      icon: "scale",
      on: inTray,
      onSelect: () => {
        const result = toggleCompare(listingId);
        if (result.full) toast(details.compareTray.full, { tone: "error" });
      },
      "data-testid": "card-menu-compare",
    },
    ...(messageHref && messageLabel
      ? [
          {
            key: "message",
            label: messageLabel,
            icon: "chat-bubble" as const,
            href: messageHref,
            "data-testid": "card-menu-message",
          },
        ]
      : []),
  ];

  const rows: SheetRow[] = [
    ...(shareable
      ? [
          {
            key: "copy",
            label: details.cardMenu.copyLink,
            icon: "link" as const,
            onSelect: () => {
              void mint().then((url) => {
                if (!url) {
                  banner.error(frontDoor.share.failed);
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(url);
                  /* The quick pill, not the top banner: a copy is a
                     confirmation, not news (handoff 6.1). */
                  banner.quick(POST_COPY.copied);
                  return;
                }
                banner.info(url);
              });
            },
            "data-testid": "card-menu-copy",
          },
          {
            key: "share-to-feed",
            label: SHARE_WORDS.button,
            icon: "feed" as const,
            onSelect: () => requireAuth("share", () => setFeedOpen(true)),
            "data-testid": "card-menu-share-to-feed",
          },
        ]
      : []),
    ...(similarHref
      ? [
          {
            key: "similar",
            label: details.cardMenu.seeSimilar,
            icon: "search" as const,
            href: similarHref,
            chevron: true,
            "data-testid": "card-menu-similar",
          },
        ]
      : []),
    ...(!saved
      ? [
          {
            key: "hide",
            label: words.hide,
            icon: "eye-off" as const,
            onSelect: () => {
              hideListing(listingId);
              toast(words.hidden, {
                action: { label: words.undo, run: () => unhideListing(listingId) },
              });
            },
            "data-testid": "card-menu-hide",
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
        head={{
          name: title,
          ...(priceLine ? { line: priceLine } : {}),
          ...(thumb ? { thumb } : {}),
          icon: "house",
          ...(href ? { href } : {}),
          "data-testid": "card-menu-open",
        }}
        quick={quick}
        rows={rows}
        doneLabel={details.cardMenu.done}
      />
    </>
  );
}
