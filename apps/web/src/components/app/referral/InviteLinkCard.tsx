"use client";

import { banner } from "@/lib/ui/toast";
import "./rewards.css";
import { useId, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { ActionSheetIllustrated } from "@/components/ui/ActionSheetIllustrated";
import { Panel } from "@/components/ui/Panel";
import { QrCode } from "@/components/app/payments/crypto/QrCode";
import { copyText, shareOrCopy, type ShareOutcome } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { useDoneFlash } from "@/lib/ui/use-done-flash";

type Copy = Dictionary["experienceRewards"]["invite"];

/**
 * THE INVITE LINK, WITH COPY, A SHARE SHEET AND A QR CODE (D51).
 *
 * The link is the subject and is selectable in one press, so a clipboard that
 * refuses still leaves the person a way to take it. Three ways to send it:
 *
 *   Copy link   `copyText`. Done flashes the button; a refusal says so in
 *               the banner and tells the person to press and hold the link.
 *   Share       Vallo's own sheet (`ActionSheetIllustrated`): copy the link,
 *               WhatsApp, or the phone's own sheet through `shareOrCopy`,
 *               whose four outcomes are each answered honestly:
 *                 shared     the system sheet confirmed it: nothing to add
 *                 cancelled  the person changed their mind: nothing at all
 *                 copied     there was no sheet, so the link was copied, and
 *                            the banner says exactly that
 *                 failed     neither worked, and the banner says how to copy it
 *   QR code     drawn in the browser by `lib/crypto/qr.ts`, never by an image
 *               service, for somebody standing next to you.
 *
 * THE MESSAGE THAT TRAVELS sells the product, never the bounty (D51): it is
 * `copy.shareText`, which says what Vallo does for the person receiving it.
 * What each tap did is said by the one banner at the top of the screen
 * (Grade 1): a copy that fell back is info, a refused clipboard an error.
 */
export function InviteLinkCard({
  url,
  code,
  copy,
  dismissLabel,
}: {
  url: string;
  code: string;
  copy: Copy;
  /** The sheet's quiet dismiss, the locale's "Not now". */
  dismissLabel: string;
}) {
  const [copied, flash] = useDoneFlash();
  const [sheet, setSheet] = useState(false);
  const [qr, setQr] = useState(false);
  const qrId = useId();
  const text = copy.shareText.replace("{url}", url);
  const [codeBefore = "", codeAfter = ""] = copy.code.split("{code}");

  const say = { "data-testid": "rewards-invite-status" };
  const copyLink = async () => {
    if (await copyText(url)) {
      feedback("select");
      flash();
      /* The quick pill (founder, 14 November 2026, handoff 6.1: "invite link
         copied" is a pill moment). The button's own glyph flash stays; the
         haptic above is this tap's, so the pill adds none. */
      banner.quick(copy.copied, { haptic: false, ...say });
    } else {
      banner.error(copy.copyFailed, say);
    }
  };

  const shareMore = async () => {
    const outcome: ShareOutcome = await shareOrCopy({ url, text, title: copy.sheetTitle });
    switch (outcome) {
      case "shared":
      case "cancelled":
        return;
      case "copied":
        feedback("select");
        banner.info(copy.sharedAsCopy, say);
        return;
      case "failed":
        banner.error(copy.copyFailed, say);
        return;
    }
  };

  return (
    <Panel variant="card" className="nf-rewards-invite" aria-label={copy.label} data-testid="rewards-invite">
      <p className="nf-rewards-invite__label">{copy.label}</p>
      <p className="nf-rewards-invite__link nf-numeric" data-testid="rewards-invite-url">
        {url}
      </p>
      <p className="nf-rewards-invite__code">
        {codeBefore}
        <span className="nf-numeric font-semibold">{code}</span>
        {codeAfter}
      </p>
      <div className="nf-rewards-invite__actions">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          full
          leadingIcon="link"
          done={copied}
          onClick={() => void copyLink()}
          data-testid="rewards-invite-copy"
        >
          {copied ? copy.copied : copy.copy}
        </Button>
        {/* Share is the warm spark (D81): the second action on Rewards, beside
            the blue Withdraw. */}
        <Button
          type="button"
          variant="spark"
          size="lg"
          full
          leadingIcon="share"
          onClick={() => setSheet(true)}
          data-testid="rewards-invite-share"
        >
          {copy.share}
        </Button>
      </div>
      <Button
        type="button"
        variant="quiet"
        size="md"
        full
        aria-expanded={qr}
        aria-controls={qrId}
        onClick={() => setQr((open) => !open)}
        data-testid="rewards-invite-qr-toggle"
      >
        {qr ? copy.qrHide : copy.qrShow}
      </Button>
      <div id={qrId} className="nf-rewards-invite__qr" hidden={!qr} data-testid="rewards-invite-qr">
        {qr ? (
          <>
            <div className="nf-rewards-invite__qr-plate">
              <QrCode value={url} label={copy.qrLabel} size={184} />
            </div>
            <p className="nf-rewards-invite__qr-hint">{copy.qrHint}</p>
          </>
        ) : null}
      </div>

      <ActionSheetIllustrated
        open={sheet}
        onOpenChange={setSheet}
        title={copy.sheetTitle}
        body={copy.sheetBody}
        object="gift"
        dismissLabel={dismissLabel}
        testId="rewards-invite-sheet"
        rows={[
          { id: "copy", label: copy.sheetCopy, hint: copy.sheetCopyHint, icon: "link", onSelect: () => void copyLink() },
          {
            id: "whatsapp",
            label: copy.sheetWhatsapp,
            icon: "chat-bubble",
            onSelect: () => {
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
            },
          },
          { id: "more", label: copy.sheetMore, hint: copy.sheetMoreHint, icon: "share", onSelect: () => void shareMore() },
        ]}
      />
    </Panel>
  );
}
