"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { AuthGate } from "@/components/auth/AuthGate";
import { createShareLink } from "@/lib/share/actions";
import { useShare } from "@/lib/ui/use-copy";

/**
 * THE THREE EQUAL TILES UNDER THE BILL (PREMIUM-STANDARD reference 8: PDF,
 * Share, Dispute, each a small outline glyph over a tiny label, all one size).
 *
 * Vallo's three are the same three ideas, said for a listing:
 *
 *   Ledger   the full move-in ledger (`/rent/move-in/<id>`), the page that
 *            prints; it is where the pinned bar's "Breakdown" already went.
 *   Share    the listing's public door (`/s/<token>`), minted the way the
 *            gallery's share control mints it, because `/listing/<id>` is
 *            gated and unfurls as a sign-in page.
 *   Ask      the conversation with the lister. The calm form of Dispute: a
 *            cost on this bill is questioned before anybody pays it, beside
 *            the other two as an equal, never as a red button.
 *
 * Nothing here changes what any of those destinations do. The door is minted
 * as the finger arrives, not on the tap, because `navigator.share` needs the
 * user's gesture and Safari withdraws it across a server round trip.
 */
export type TrueCostActionsCopy = {
  label: string;
  ledger: string;
  ledgerLabel: string;
  share: string;
  shareLabel: string;
  ask: string;
  askLabel: string;
};

function Tile({ icon, word }: { icon: UiIconName; word: string }) {
  /* The page's one button family (founder, 13 November 2026): the glass
     secondary button Copy address and Open in Maps already wear, icon then
     word, not a square tile of its own. */
  return (
    <>
      <UiIcon name={icon} size={16} />
      <span className="nf-btn__label">{word}</span>
    </>
  );
}

export function TrueCostActions({
  listingId,
  title,
  ledgerHref,
  messageHref,
  copy,
}: {
  listingId: string;
  title: string;
  ledgerHref: string;
  messageHref: string;
  copy: TrueCostActionsCopy;
}) {
  const share = useShare();
  const door = useRef<Promise<string | null> | null>(null);
  const mint = useCallback((): Promise<string | null> => {
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
  }, [listingId]);

  const onShare = async () => {
    const url = (await mint()) ?? window.location.href;
    await share({ url, title });
  };

  return (
    <ul className="nf-bill-tiles" aria-label={copy.label} data-testid="true-cost-actions">
      <li>
        <Link href={ledgerHref} className="nf-btn nf-btn--glass nf-btn--sm nf-tap" aria-label={copy.ledgerLabel} prefetch={false}>
          <Tile icon="document" word={copy.ledger} />
        </Link>
      </li>
      <li>
        <button
          type="button"
          className="nf-btn nf-btn--glass nf-btn--sm nf-tap"
          aria-label={copy.shareLabel}
          onPointerEnter={() => void mint()}
          onPointerDown={() => void mint()}
          onFocus={() => void mint()}
          onClick={() => void onShare()}
        >
          <Tile icon="share" word={copy.share} />
        </button>
      </li>
      <li>
        <AuthGate action="message">
          <Link href={messageHref} className="nf-btn nf-btn--glass nf-btn--sm nf-tap" aria-label={copy.askLabel} prefetch={false}>
            <Tile icon="chat-bubble" word={copy.ask} />
          </Link>
        </AuthGate>
      </li>
    </ul>
  );
}
