"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StepFrame } from "@/components/ui/StepFrame";
import { NairaField } from "@/components/ui/NairaField";
import { TextArea, TextField } from "@/components/ui/Field";
import { OptionCards } from "@/components/ui/OptionCards";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { banner } from "@/lib/ui/toast";
import { submitOffer } from "@/lib/offers/actions";
import { resolveAmount, formatDay, nairaFull } from "@/lib/offers/format";
import { dealRoomHref } from "@/lib/offers/routes";
import {
  NOTHING_CHARGED,
  NO_MONEY_TAKEN,
  OTHER_COSTS_NOT_ITEMISED,
  PAYMENT_CAVEAT,
  PAYMENT_DETAIL,
  PAYMENT_LABEL,
  TITLE_NOT_VERIFIED,
  doorSentence,
  mandateLine,
} from "@/lib/offers/words";
import type { Eligibility, MandateLine, PaymentPreference, PriceBlock } from "@/lib/offers/types";
import { BlockedNotice, EligibilityCard, Facts, OfferFigures, PriceBlockView } from "./OfferParts";
import "./offers.css";

/**
 * THE OFFER FLOW (Make an offer). Three screens on the Grade 1 step frame:
 * your offer (the requirements first, then the amount), how you plan to pay,
 * and a summary that makes you look once before it goes.
 *
 * The form is always visible. When a requirement is unmet the Send button is
 * disabled and the screen says why, with a Fix control into the existing
 * verification flow. Everything typed is kept in sessionStorage under the
 * listing, so coming back from verification finds the form as it was left.
 *
 * Nothing here charges anything and nothing here claims a thing is checked:
 * Cash is an intention, a mortgage or an instalment is a proposal to the
 * seller, and the title is not verified by Vallo.
 */

export type OfferFlowProps = {
  listingId: string;
  listingTitle: string;
  price: PriceBlock;
  eligibility: Eligibility;
  mandate: MandateLine;
  canOffer: boolean;
  reason: string | null;
  /** Preview only: open on this screen. */
  initialStep?: 1 | 2 | 3;
  /** Preview only: start from this draft. */
  initialDraft?: Partial<Draft>;
};

type Draft = {
  amount: string;
  pref: PaymentPreference;
  deposit: string;
  months: string;
  closing: string;
  note: string;
  noteOpen: boolean;
  step: 1 | 2 | 3;
};

const BLANK: Draft = { amount: "", pref: "cash", deposit: "", months: "12", closing: "", note: "", noteOpen: false, step: 1 };

const draftKey = (listingId: string) => `vallo:offer-draft:${listingId}`;

function readDraft(listingId: string): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(listingId));
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(listingId: string, draft: Draft): boolean {
  try {
    window.sessionStorage.setItem(draftKey(listingId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(listingId: string): void {
  try {
    window.sessionStorage.removeItem(draftKey(listingId));
  } catch {
    /* nothing to clear */
  }
}

const MONTHS = [
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
  { value: "36", label: "36 months" },
];

export function OfferFlow(props: OfferFlowProps) {
  const { listingId, listingTitle, price, eligibility, mandate, canOffer, reason } = props;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ ...BLANK, step: props.initialStep ?? 1, ...(props.initialDraft ?? {}) });
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>();
  /* Made once per mount: a double tap or a retry reuses it, so it cannot create two offers. */
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));

  /* Restore after mount (never during render, so the server and client agree). */
  useEffect(() => {
    const prior = readDraft(listingId);
    if (prior && !props.initialDraft) {
      /* A draft restored after mount, so the server and the first client render agree. */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((current) => ({ ...current, ...prior }));
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const update = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((current) => {
        const next = { ...current, ...patch };
        if (!props.initialDraft) setSaved(writeDraft(listingId, next));
        return next;
      });
    },
    [listingId, props.initialDraft],
  );

  const resolved = useMemo(() => resolveAmount(draft.amount, price.askingMinor), [draft.amount, price.askingMinor]);
  const blocked = !eligibility.eligible || !canOffer;
  const unmet = eligibility.requirements.filter((r) => r.state !== "met").length;
  const blockedWhy = !eligibility.eligible
    ? `${unmet} ${unmet === 1 ? "requirement is" : "requirements are"} not met yet. Finish ${unmet === 1 ? "it" : "them"} to send your offer.`
    : (reason ?? "You cannot send an offer on this property right now.");

  const goNext = () => {
    if (draft.step === 1) {
      if (!resolved.ok) {
        setAmountError(doorSentence(resolved.reason));
        return;
      }
      setAmountError(undefined);
      update({ step: 2 });
    } else if (draft.step === 2) update({ step: 3 });
  };

  const send = async () => {
    if (!resolved.ok || blocked || sending) return;
    setSending(true);
    try {
      const result = await submitOffer({
        listingId,
        amountNaira: draft.amount.trim() === "" ? null : draft.amount,
        paymentPreference: draft.pref,
        depositNaira: draft.pref === "cash" ? null : draft.deposit || null,
        instalmentMonths: draft.pref === "instalment" ? Number(draft.months) : null,
        targetClosing: draft.closing || null,
        note: draft.note.trim() || null,
        idempotencyKey,
      });
      if (result.ok) {
        clearDraft(listingId);
        banner.success("Your offer was sent to the seller.");
        router.push(`${dealRoomHref(result.data.offerId)}?sent=1`);
        return;
      }
      banner.error(result.error, { retry: () => void send() });
    } catch {
      banner.error("We could not send your offer. Check your connection and try again.", { retry: () => void send() });
    } finally {
      setSending(false);
    }
  };

  const mandateText = mandateLine(mandate.held, mandate.reviewedOn, mandate.expiresOn, formatDay);

  const common = {
    total: 3,
    closeHref: `/listing/${listingId}`,
    closeLabel: "Close and return to the property",
    save: saved ? ("device" as const) : ("idle" as const),
    saveWords: { device: "Kept on this device" },
    eyebrow: "Make an offer",
    testId: "offer-flow",
  };

  if (draft.step === 1) {
    return (
      <StepFrame
        {...common}
        step={1}
        title="Your offer"
        subtitle={listingTitle}
        primary={{ label: "Continue", onClick: goNext, testId: "offer-continue" }}
      >
        <div className="grid gap-lg">
          {restored ? <BlockedNotice tone="info">Your offer is where you left it.</BlockedNotice> : null}

          <section aria-labelledby="req-h" className="grid gap-sm">
            <h2 id="req-h" className="nf-section-label">
              Before you offer
            </h2>
            {!eligibility.eligible ? <BlockedNotice>{blockedWhy}</BlockedNotice> : null}
            <Panel variant="card" className="p-card">
              <EligibilityCard eligibility={eligibility} />
            </Panel>
          </section>

          <section aria-labelledby="amt-h" className="grid gap-sm">
            <h2 id="amt-h" className="nf-section-label">
              Amount
            </h2>
            <NairaField
              label="Your offer"
              value={draft.amount}
              onValueChange={(value) => {
                setAmountError(undefined);
                update({ amount: value });
              }}
              hint="Leave blank to offer the asking price."
              error={amountError}
              placeholder="Asking price"
              data-testid="offer-amount"
            />
            {resolved.ok ? (
              <Panel variant="card" className="p-card">
                <OfferFigures amountMinor={resolved.minor} askingMinor={price.askingMinor} label="You are offering" atAskingPrice={draft.amount.trim() === ""} />
              </Panel>
            ) : null}
            <p className="nf-body-sm text-[var(--nf-content-muted)]">{OTHER_COSTS_NOT_ITEMISED}</p>
          </section>

          <section aria-labelledby="date-h" className="grid gap-sm">
            <h2 id="date-h" className="nf-section-label">
              Timing and a note
            </h2>
            <TextField
              label="Proposed closing date"
              optionalText="Optional"
              type="date"
              value={draft.closing}
              onChange={(event) => update({ closing: event.target.value })}
              hint="A date you propose. The seller may suggest another."
              data-testid="offer-closing"
            />
            {draft.noteOpen ? (
              <TextArea
                label="Note to the seller"
                optionalText="Optional"
                value={draft.note}
                maxLength={600}
                rows={4}
                onChange={(event) => update({ note: event.target.value })}
                data-testid="offer-note"
              />
            ) : (
              <Button variant="quiet" leadingIcon="plus" onClick={() => update({ noteOpen: true })} data-testid="offer-note-open">
                Add a note to the seller
              </Button>
            )}
          </section>
        </div>
      </StepFrame>
    );
  }

  if (draft.step === 2) {
    return (
      <StepFrame
        {...common}
        step={2}
        title="How you plan to pay"
        subtitle="This is what you tell the seller. Vallo does not check it and takes no payment."
        onBack={() => update({ step: 1 })}
        primary={{ label: "Review your offer", onClick: goNext, testId: "offer-continue" }}
      >
        <div className="grid gap-lg">
          <OptionCards
            label="Payment preference"
            value={draft.pref}
            onChange={(value) => update({ pref: value as PaymentPreference })}
            options={(["cash", "mortgage", "instalment"] as const).map((key) => ({ value: key, label: PAYMENT_LABEL[key], detail: PAYMENT_DETAIL[key] }))}
            testId="offer-pref"
          />
          {draft.pref !== "cash" ? (
            <div className="grid gap-sm">
              <NairaField
                label={draft.pref === "mortgage" ? "Part you would pay yourself" : "Deposit you propose to the seller"}
                value={draft.deposit}
                onValueChange={(value) => update({ deposit: value })}
                hint="Optional. A figure you propose to the seller, not a payment to Vallo."
                data-testid="offer-deposit"
              />
              {draft.pref === "instalment" ? (
                <div className="grid gap-xs">
                  <p className="nf-section-label">Over how long</p>
                  <Segmented label="Instalment period" semantics="radio" options={MONTHS} value={draft.months} onChange={(value) => update({ months: value })} full />
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="nf-body-sm text-[var(--nf-content-muted)]">{PAYMENT_CAVEAT[draft.pref]}</p>
        </div>
      </StepFrame>
    );
  }

  const amountMinor = resolved.ok ? resolved.minor : price.askingMinor;
  return (
    <StepFrame
      {...common}
      step={3}
      title="Review your offer"
      subtitle="Look it over once. You can withdraw an open offer later."
      onBack={() => update({ step: 2 })}
      primary={{ label: "Send offer", onClick: () => void send(), disabled: blocked || !resolved.ok, loading: sending, testId: "offer-send" }}
    >
      <div className="grid gap-lg">
        {blocked ? (
          <BlockedNotice>
            {blockedWhy}
            {!eligibility.eligible ? <EligibilityCard eligibility={eligibility} /> : null}
          </BlockedNotice>
        ) : null}
        <Panel variant="card" className="p-card">
          <OfferFigures amountMinor={amountMinor} askingMinor={price.askingMinor} atAskingPrice={draft.amount.trim() === ""} />
        </Panel>
        <Panel variant="card" className="p-card">
          <Facts
            items={[
              { label: "Property", value: listingTitle },
              { label: "Payment", value: PAYMENT_LABEL[draft.pref] },
              ...(draft.pref !== "cash" && draft.deposit ? [{ label: draft.pref === "mortgage" ? "You pay yourself" : "Deposit", value: nairaFull(Number(draft.deposit.replace(/,/g, "")) * 100) }] : []),
              ...(draft.pref === "instalment" ? [{ label: "Period", value: `${draft.months} months` }] : []),
              { label: "Closing date", value: draft.closing ? `Proposed ${formatDay(draft.closing)}` : "No date proposed" },
              ...(draft.note.trim() ? [{ label: "Note", value: draft.note.trim() }] : []),
            ]}
          />
        </Panel>
        <PriceBlockView price={price} title="Asking price and costs" />
        {mandateText ? <p className="nf-body-sm text-[var(--nf-content-secondary)]">{mandateText}</p> : null}
        <div className="grid gap-xs nf-body-sm text-[var(--nf-content-muted)]">
          <p>{PAYMENT_CAVEAT[draft.pref]}</p>
          <p>{TITLE_NOT_VERIFIED}</p>
          <p>{NO_MONEY_TAKEN}</p>
          <p className="font-semibold text-[var(--nf-content-primary)]">{NOTHING_CHARGED}</p>
        </div>
      </div>
    </StepFrame>
  );
}
