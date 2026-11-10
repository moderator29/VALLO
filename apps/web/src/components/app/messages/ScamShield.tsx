"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useId, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ReportSheet } from "@/components/app/ReportSheet";
import { PAYMENT_GATE_SENTENCE, PAY_ONLY_THROUGH_VALLO, PRIVATE_FEE_NOTE } from "@/lib/money/copy";
import type { OffPlatformAsk } from "@/lib/messages/off-platform-ask";

/**
 * B12, THE SCAM SHIELD ON A MESSAGE YOU RECEIVED.
 *
 * One calm tinted row under a bubble from the other side that asks you to pay
 * outside Vallo (`offPlatformAsk` decides). It is drawn for the reader only:
 * nothing is sent, and the sender is never told. It is a note, not an alarm:
 * no red, no motion, one icon and the founder's sentence, then two quiet
 * actions:
 *
 *   What to do   opens three short steps in place (do not transfer, pay on
 *                Vallo with the platform's own payment sentence, report);
 *   Report       the platform's own report sheet, on this message.
 *
 * The money sentences are the constants in `lib/money/copy.ts`, so the shield
 * can never say something about payment that the Terms do not.
 *
 * THE MENTION (founder ruling 7, 13 October 2026). In a listing chat, when
 * either side mentions an account number or a transfer (`mentionsPayingOutside`),
 * the same row is drawn with the founder's line as its lead,
 * `PAY_ONLY_THROUGH_VALLO` (reworded 9 November 2026, rule (a)). On both sides and under
 * the reader's own message too; Report is offered only on a message from the
 * other side. One shield, two leads, never two rows on one message.
 */
export function ScamShield({
  ask,
  messageId,
  canReport,
  copy,
  quote,
  mention = false,
}: {
  /** The ask `offPlatformAsk` found; absent on a mention. */
  ask?: OffPlatformAsk | null;
  /** A mention of an account number or a transfer, by either side (ruling 7). */
  mention?: boolean;
  messageId: string;
  /** A real message on the platform. Seed threads have nothing to report. */
  canReport: boolean;
  copy: Dictionary["memberKit"]["scam"];
  /** The message's own words, named at the top of the report sheet. */
  quote?: string;
}) {
  const [open, setOpen] = useState(false);
  const stepsId = useId();
  const fee = ask?.reasons.includes("fee") ?? false;

  /* One column of words beside the shield glyph: the lead, the private line,
     the steps and the actions all start on the same edge. */
  return (
    <aside
      aria-label={copy.label}
      className="nf-scam-shield"
      data-testid="scam-shield"
      data-reason={ask?.reason ?? (mention ? "mention" : undefined)}
    >
      <UiIcon name="shield-check" size={18} className="nf-scam-shield__icon" />
      <div className="nf-scam-shield__body">
        <p className="nf-scam-shield__lead">
          <strong>{ask ? copy.lead : PAY_ONLY_THROUGH_VALLO}</strong>
          {fee ? <> {copy.feeLead}</> : null}
        </p>
        <p className="nf-scam-shield__private">{copy.onlyYou}</p>

        {open && (
          <ol id={stepsId} className="nf-scam-shield__steps">
            <li>{copy.stepDontTransfer}</li>
            <li>
              <strong>{copy.stepPayOnVallo}</strong> {PAYMENT_GATE_SENTENCE}
            </li>
            {fee && <li>{PRIVATE_FEE_NOTE}</li>}
            <li>{copy.stepReport}</li>
          </ol>
        )}
        {open && (
          <Link href="/safety" className="nf-tap nf-scam-shield__more">
            {copy.howPaying}
          </Link>
        )}

        <div className="nf-scam-shield__actions">
          <Button
            variant="quiet"
            size="sm"
            aria-expanded={open}
            aria-controls={open ? stepsId : undefined}
            onClick={() => setOpen((v) => !v)}
            data-testid="scam-shield-steps"
          >
            {open ? copy.hide : copy.whatToDo}
            <UiIcon name="chevron-down" size={14} className={`nf-scam-shield__chev${open ? " is-open" : ""}`} />
          </Button>
          {canReport && (
            <ReportSheet targetType="message" targetId={messageId} targetLabel={quote?.trim() || copy.label} signedIn />
          )}
        </div>
      </div>
    </aside>
  );
}
