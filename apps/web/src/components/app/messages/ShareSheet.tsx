"use client";

import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useEffect, useId, useState } from "react";
import { QrCode } from "@/components/app/payments/crypto/QrCode";
import { useClientCopy } from "@/lib/i18n/client-copy";
import type { SharedKind } from "./share";

/**
 * WHERE A PLACE GOES WHEN SOMEBODY SHARES IT.
 *
 * The founder's complaint was exact: he could not send a property to
 * somebody's DMs. Every piece of that path already existed apart from the way
 * in. `/messages/share/<kind>/<id>` lists the sharer's own conversations under
 * RLS and sends a real message through `sendMessage`, and the thread expands
 * that message into a card. What the listing, stay and restaurant pages had
 * was one button that copied a link to the clipboard, which is how you send a
 * place to somebody who is NOT on Vallo.
 *
 * So the control asks which of the two it is, and the first answer is the one
 * the product is for. Two rows, both real:
 *
 *   SEND IN A VALLO CHAT goes to the picker, which is a page rather than a
 *   sheet on purpose (see that route's own note): a narrowed list of somebody's
 *   conversations is a URL, and the picker has to be able to say "you have no
 *   conversations yet" without collapsing this sheet under it.
 *
 *   SHARE ELSEWHERE is the browser's own sheet where there is one and the
 *   clipboard where there is not, which is what the button used to do on its
 *   own.
 *
 * NOTHING HERE WRITES. The sheet only routes; the write is the picker's, where
 * `messages.sender_id` is the signed-in caller and `lib/messages/blocks.ts`
 * decides whether the conversation may receive a message at all.
 */
export type ShareQrCopy = { show: string; hide: string; body: string; label: string; failed: string };

export function ShareSheet({
  open,
  onOpenChange,
  kind,
  id,
  title,
  onShareElsewhere,
  elsewhereBody,
  qr,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which share this is. A stay is not a listing; see `share.ts`. */
  kind: SharedKind;
  id: string;
  /** The place's own name, so the sheet says what is being sent. */
  title: string;
  /** The OS sheet, or the clipboard. Owned by the caller, which has the URL. */
  onShareElsewhere: () => void;
  /**
   * What "Share elsewhere" sends, when the caller shares something other
   * than its own address. A listing sends its share door (V-07), a public
   * card with the area and the move-in total, and the row says so.
   */
  elsewhereBody?: string;
  /**
   * A QR code of the place's share door (backlog row 13): the words, and how
   * to get the door's address (the caller mints it). Drawn in the browser by
   * `lib/crypto/qr.ts`, never by an image service, so the address goes to
   * nobody else. Offered only where the caller has a door.
   */
  qr?: { copy: ShareQrCopy; door: () => Promise<string | null> };
}) {
  const words = useClientCopy().frontDoor.share;
  const qrId = useId();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const door = qr?.door;

  /* The door is asked for when the panel opens, and the sheet closing hides it again. */
  const qrShown = qrOpen && open;
  useEffect(() => {
    if (!qrShown || qrUrl !== null || !door) return;
    let live = true;
    void door().then((url) => {
      if (!live) return;
      if (url) setQrUrl(url);
      else setQrFailed(true);
    });
    return () => {
      live = false;
    };
  }, [qrShown, qrUrl, door]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={words.sheetTitle} detents={[0.4]}>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{title}</p>

      <div className="nf-rows mt-group">
        <Link
          href={`/messages/share/${kind}/${id}`}
          className="nf-row nf-row--tap"
          onClick={() => onOpenChange(false)}
        >
          <span className="nf-role-mark shrink-0" aria-hidden="true">
            <UiIcon name="chat-bubble" size={20} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">
              {words.inChat}
            </span>
            <span className="nf-caption block">
              {words.inChatBody}
            </span>
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        </Link>

        <button
          type="button"
          className="nf-row nf-row--tap w-full text-left"
          onClick={() => {
            onOpenChange(false);
            onShareElsewhere();
          }}
        >
          <span className="nf-role-mark shrink-0" aria-hidden="true">
            <UiIcon name="share" size={20} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">
              {words.elsewhere}
            </span>
            <span className="nf-caption block">
              {elsewhereBody ?? words.elsewhereLink}
            </span>
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
        </button>

        {qr ? (
          <button
            type="button"
            className="nf-row nf-row--tap w-full text-left"
            aria-expanded={qrShown}
            aria-controls={qrId}
            onClick={() => {
              setQrFailed(false);
              setQrOpen((v) => !v);
            }}
            data-testid="share-qr-toggle"
          >
            <span className="nf-role-mark shrink-0" aria-hidden="true">
              <UiIcon name="grid" size={20} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">
                {qrShown ? qr.copy.hide : qr.copy.show}
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {qr ? (
        <div id={qrId} hidden={!qrShown} className="mt-group grid justify-items-center gap-xs" data-testid="share-qr">
          {qrShown && qrUrl ? (
            <>
              <QrCode value={qrUrl} label={qr.copy.label} size={184} />
              <p className="nf-caption text-center text-[var(--nf-content-secondary)]">{qr.copy.body}</p>
            </>
          ) : null}
          {qrShown && qrFailed ? (
            <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
              {qr.copy.failed}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
