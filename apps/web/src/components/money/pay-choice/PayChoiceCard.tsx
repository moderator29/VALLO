"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import {
  PAY_CHOICE_CARD_REASON,
  PAY_CHOICE_CARD_REVIEW,
  PAY_CHOICE_ESCROW_PAUSED,
  PAY_CHOICE_ESCROW_PAUSED_SALE,
  PAY_CHOICE_ESCROW_REASON,
  PAY_CHOICE_ROOM_ONLY,
  PAY_CHOICE_SALE_ONLY,
  PAY_ONLY_THROUGH_VALLO,
} from "@/lib/money/copy";
import { payChoiceView, payNextHref, readChoiceRefusal, type PayChoice, type PayRail } from "@/lib/payments/rail-choice";
import { choosePaymentRail } from "@/lib/payments/rail-choice-actions";
import type { ActionResult } from "@/lib/actions/envelope";
import "./pay-choice.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

export type PayChoiceAgreement = { id: string; kind: string; bookingId: string | null; inspectionId: string | null };

type Choose = (input: { agreementId: string; choice: PayRail }) => Promise<ActionResult<{ choice: PayRail; review?: boolean }>>;

/**
 * THE PAYMENT STEP'S CHOICE (founder ruling 2, 13 October 2026).
 *
 * Two options on a rent or a shortlet, Escrow preselected and marked
 * recommended, Pay by card beside it, each with one short reason; a sale draws
 * escrow as a fact, a hotel room draws card as a fact. Continue stores the
 * choice through `payment_rail_choose` (the database decides who may and
 * what is allowed) and goes to the existing escrow or card screen. Nothing
 * is charged here.
 *
 * `here` is the path this card is drawn on: when Continue leads to the same
 * page (card, on the stay checkout) the page is refreshed so its payment
 * panel opens on the rail just chosen.
 */
export function PayChoiceCard({
  copy,
  choice,
  agreement,
  here,
  showContinue = true,
  choose = choosePaymentRail,
  agreementStatus,
}: {
  copy: Dictionary["payChoice"];
  choice: PayChoice | null;
  agreement: PayChoiceAgreement;
  here: string;
  /** False where the page already draws the next action (the card panel on checkout). */
  showContinue?: boolean;
  /** The server action; the preview harness passes a recorded one. */
  choose?: Choose;
  /** The agreement's status, so a card choice waiting on a person is said. */
  agreementStatus?: string;
}) {
  const view = payChoiceView(choice);
  const [selected, setSelected] = useState<PayRail | null>(view.selected);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [pending, startTransition] = useSafeTransition();
  const router = useRouter();
  const titleId = useId();

  if (view.mode === "none" || !choice) return null;

  const go = (rail: PayRail) => {
    const next = payNextHref(rail, agreement);
    if (!next) return;
    if (next === here) router.refresh();
    else router.push(next);
  };

  const onContinue = () => {
    if (!selected) return;
    setError(null);
    if (!view.canChoose) {
      go(selected);
      return;
    }
    startTransition(async () => {
      const result = await choose({ agreementId: agreement.id, choice: selected });
      if (!result.ok) {
        const code = readChoiceRefusal(result.error);
        setError(code === "unavailable" && !(result.error in copy.refused) ? result.error : copy.refused[code]);
        return;
      }
      /* The gate read the new rail and a person looks first: say so, and stay
         here so the payer can go back to escrow (pov04, never a dead end). */
      if (result.data.review) {
        setReview(true);
        router.refresh();
        return;
      }
      go(result.data.choice);
    });
  };

  const fixed = view.mode !== "choose";
  const options: { rail: PayRail; name: string; reason: string }[] =
    view.mode === "escrow_only" || view.mode === "escrow_paused"
      ? [{ rail: "escrow", name: copy.escrowOnlyTitle, reason: PAY_CHOICE_SALE_ONLY }]
      : view.mode === "card_only"
        ? [{ rail: "card", name: copy.cardOnlyTitle, reason: PAY_CHOICE_ROOM_ONLY }]
        : view.mode === "card_escrow_paused"
          ? [{ rail: "card", name: copy.card, reason: PAY_CHOICE_CARD_REASON }]
          : [
            { rail: "escrow", name: copy.escrow, reason: PAY_CHOICE_ESCROW_REASON },
            { rail: "card", name: copy.card, reason: PAY_CHOICE_CARD_REASON },
          ];

  return (
    <section className="nf-paychoice" aria-labelledby={titleId} data-testid="pay-choice" data-mode={view.mode}>
      <h2 id={titleId} className="nf-paychoice__title">
        {fixed ? options[0]!.name : copy.title}
      </h2>
      <fieldset className="nf-paychoice__options" disabled={pending || (!fixed && !view.canChoose)}>
        <legend className="sr-only">{copy.label}</legend>
        {options.map((option) => {
          const on = selected === option.rail;
          return (
            <label
              key={option.rail}
              className="nf-paychoice__option"
              data-selected={on}
              data-fixed={fixed}
              data-testid={`pay-choice-${option.rail}`}
            >
              {fixed ? null : (
                <input
                  type="radio"
                  name={`pay-rail-${agreement.id}`}
                  value={option.rail}
                  checked={on}
                  onChange={() => setSelected(option.rail)}
                />
              )}
              <span>
                <span className="nf-paychoice__head">
                  {fixed ? null : <span className="nf-paychoice__name">{option.name}</span>}
                  {option.rail === "escrow" && view.mode === "choose" ? (
                    <span className="nf-paychoice__badge">{copy.recommended}</span>
                  ) : null}
                </span>
                <span className="nf-paychoice__reason block">{option.reason}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {!fixed && !choice.payer ? <p className="nf-paychoice__note">{copy.notPayerNote}</p> : null}
      {!fixed && choice.payer && choice.locked ? <p className="nf-paychoice__note">{copy.lockedNote}</p> : null}
      {view.mode === "card_escrow_paused" ? (
        <p className="nf-paychoice__note" data-testid="pay-choice-escrow-paused">
          {PAY_CHOICE_ESCROW_PAUSED}
        </p>
      ) : null}
      {view.mode === "escrow_paused" ? (
        <p className="nf-paychoice__note" data-testid="pay-choice-escrow-paused">
          {PAY_CHOICE_ESCROW_PAUSED_SALE}
        </p>
      ) : null}
      {review || (choice.payer && choice.chosen === "card" && agreementStatus === "in_review") ? (
        <p className="nf-paychoice__note" role="status" data-testid="pay-choice-review">
          {PAY_CHOICE_CARD_REVIEW}
        </p>
      ) : null}
      <p className="nf-paychoice__note" data-testid="pay-choice-inside">
        {PAY_ONLY_THROUGH_VALLO}
      </p>
      {error ? (
        <p className="nf-paychoice__error" role="alert">
          {error}
        </p>
      ) : null}
      {showContinue && choice.payer && selected ? (
        <Button variant="primary" full onClick={onContinue} disabled={pending} data-testid="pay-choice-continue">
          {pending ? copy.saving : copy.continue}
        </Button>
      ) : null}
    </section>
  );
}
