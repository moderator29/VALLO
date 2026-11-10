"use client";

import type { Dictionary } from "@vallo/i18n/core";
import type { BroadcastKey, BroadcastParse } from "@/lib/agent/broadcast";
import { OptionCards } from "@/components/ui/OptionCards";
import { BroadcastPaste } from "../BroadcastPaste";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";
import type { ListingKind } from "./model";

const W = WIZARD_WORDS.kind;

/**
 * THE BASICS: "What are you listing today?" (R18.1, R29). Three cards; the
 * answer decides every question after it. Starting from a WhatsApp message
 * (V-09) is offered under the cards, because a pasted broadcast answers this
 * and most of what follows in one go.
 */
export function KindStep({
  ctx,
  picked,
  onPick,
  broadcastCopy,
  onBroadcast,
}: {
  ctx: StepCtx;
  /** Null until a fresh draft has been given an answer: nothing is chosen for the lister. */
  picked: ListingKind | null;
  onPick: (kind: ListingKind) => void;
  broadcastCopy?: Dictionary["frontDoor"]["broadcast"];
  onBroadcast: (result: BroadcastParse) => BroadcastKey[];
}) {
  return (
    <>
      <OptionCards
        label={W.title}
        value={picked}
        onChange={(value) => onPick(value as ListingKind)}
        testId="wizard-kind"
        options={[
          { value: "stay", label: W.stay.label, detail: W.stay.detail, icon: "calendar-booking" },
          { value: "rent", label: W.rent.label, detail: W.rent.detail, icon: "key" },
          { value: "sale", label: W.sale.label, detail: W.sale.detail, icon: "price-tag" },
        ]}
      />
      {ctx.mark("intent")}
      {broadcastCopy ? (
        <div className="nf-lw2-aside">
          <p className="nf-lw2-aside__lead">{W.broadcastLead}</p>
          <BroadcastPaste copy={broadcastCopy} locale={ctx.locale} onApply={onBroadcast} />
        </div>
      ) : null}
    </>
  );
}
