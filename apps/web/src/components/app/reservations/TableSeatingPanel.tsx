"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCopyFlash, useCopyLabels } from "@/lib/ui/use-copy";
import { NairaField } from "@/components/ui/NairaField";
import { TYPE } from "@/components/app/Screen";
import { formatMoney } from "@vallo/i18n/core";
import type { ReservationView } from "@/lib/reservations/queries";
import {
  asksDiner,
  billLine,
  billOpen,
  reviewable,
  seatingLine,
  showsCode,
  spacedCode,
} from "@/lib/reservations/seating";
import {
  answerDidYouDine,
  confirmTableBillReturn,
  enterTableBill,
  leaveTableReview,
  payTableBill,
} from "@/lib/reservations/seating-actions";

/**
 * THE DINER'S SIDE OF A TABLE (founder decision D).
 *
 * The check-in code to show at the door, "Did you dine?" when the restaurant
 * never said, the bill paid through Vallo, and a review once seated. Each
 * part appears only when the database would accept it, and says nothing at
 * all before migration 20261013100000 is applied (`seating` is absent).
 */
export function TableSeatingPanel({ table }: { table: ReservationView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [billOpenForm, setBillOpenForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [rating, setRating] = useState(0);
  const [words, setWords] = useState("");
  /* The clock is read after mounting so the server and the first client
     render agree; the panel fills in a moment later. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const seating = table.seating ?? null;
  if (!seating || !now) return null;

  const money = (minor: number) => formatMoney(minor, "en", "NGN");
  const run = (job: () => Promise<{ ok: boolean; error?: string } | { ok: true; data: unknown }>, done?: string) =>
    start(async () => {
      setError(null);
      setNote(null);
      const result = (await job()) as { ok: boolean; error?: string };
      if (!result.ok) {
        setError(result.error ?? "That did not go through. Please try again.");
        return;
      }
      if (done) setNote(done);
      router.refresh();
    });

  const bill = table.bill ?? null;
  const line = seatingLine(seating);
  const billWords = billLine(bill, money);
  /* Paying through Vallo is offered only while `restaurant_bill_pay` is on;
     until then the diner pays the restaurant directly and nothing here says
     otherwise. A bill already moving or paid is still shown. */
  const billPay = table.billPay === true;
  const mayBill = billPay && billOpen(table, now) && (!bill || bill.status === "awaiting_restaurant");

  return (
    <div className="mt-inline grid gap-inline" data-testid="table-seating">
      {showsCode(table, seating, now) && (
        <div className="rounded-[var(--nf-container-radius)] bg-[var(--nf-surface-raised)] px-row py-inline">
          <span className={`block ${TYPE.caption}`}>Your check-in code</span>
          <span className="flex flex-wrap items-center justify-between gap-inline">
            <span className="nf-numeric block text-[length:var(--nf-text-figure)] font-bold tracking-wide" data-testid="check-in-code">
              {spacedCode(seating.checkInCode)}
            </span>
            <CopyCode code={seating.checkInCode} />
          </span>
          <span className={`block ${TYPE.rowMeta}`}>
            Show it to the restaurant when you arrive. Booking the table is free.
          </span>
        </div>
      )}

      {line && <span className={`block ${TYPE.rowMeta}`}>{line}</span>}

      {asksDiner(table, seating, now) && (
        <div data-testid="did-you-dine">
          <span className={`block ${TYPE.rowTitle}`}>Did you dine at {table.listingTitle}?</span>
          <span className="mt-inline flex flex-wrap gap-inline">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => answerDidYouDine(table.id, true), "Thank you. Your table is marked as seated.")}
            >
              Yes, I dined
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => answerDidYouDine(table.id, false), "Thank you for telling us.")}
            >
              No, I did not
            </Button>
          </span>
        </div>
      )}

      {billWords && <span className={`block ${TYPE.rowMeta}`}>{billWords}</span>}
      {billPay && bill?.status === "awaiting_payment" && (
        <span>
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            loading={pending}
            data-testid="pay-table-bill"
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await payTableBill(bill.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                window.location.assign(result.data.authorizationUrl);
              })
            }
          >
            Pay the bill through Vallo
          </Button>
        </span>
      )}
      {mayBill && !billOpenForm && (
        <button
          type="button"
          className="justify-self-start text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
          onClick={() => setBillOpenForm(true)}
        >
          {bill ? "Change the amount you entered" : "Pay your bill through Vallo"}
        </button>
      )}
      {mayBill && billOpenForm && (
        <div className="grid gap-inline">
          <NairaField
            label="The total on your bill"
            hint="The restaurant confirms it, then you pay here by card or bank transfer."
            value={amount}
            onValueChange={setAmount}
            allowKobo
          />
          <span>
            <Button
              variant="primary"
              size="sm"
              disabled={pending || amount.length === 0}
              onClick={() =>
                run(() => enterTableBill(table.id, amount), "Sent to the restaurant to confirm.")
              }
            >
              Send to the restaurant
            </Button>
          </span>
        </div>
      )}

      {reviewable(seating) && !table.reviewed && (
        <div className="grid gap-inline" data-testid="table-review">
          <span className={`block ${TYPE.rowTitle}`}>How was it?</span>
          <span className="flex gap-inline" role="radiogroup" aria-label="Your rating out of five">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} of 5`}
                className={`nf-btn nf-btn--sm ${rating >= n ? "nf-btn--primary" : "nf-btn--glass"}`}
                onClick={() => setRating(n)}
              >
                {n}
              </button>
            ))}
          </span>
          <textarea
            className="nf-field w-full"
            rows={3}
            maxLength={2000}
            aria-label="A few words about your meal (optional)"
            placeholder="A few words about your meal (optional)"
            value={words}
            onChange={(event) => setWords(event.target.value)}
          />
          <span>
            <Button
              variant="primary"
              size="sm"
              disabled={pending || rating === 0}
              onClick={() =>
                run(() => leaveTableReview({ reservationId: table.id, rating, body: words }), "Thank you for your review.")
              }
            >
              Post review
            </Button>
          </span>
        </div>
      )}
      {table.reviewed && <span className={`block ${TYPE.rowMeta}`}>You reviewed this table. Thank you.</span>}

      {note && (
        <span role="status" className={`block ${TYPE.rowMeta}`}>
          {note}
        </span>
      )}
      {error && (
        <span role="alert" className={`block ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Back from Paystack with `?bill=rm-bill-...`: the charge is read back from
 * Paystack on the server and the bill settled once, then the page refreshes.
 */
export function BillReturnCheck({ reference }: { reference: string }) {
  const router = useRouter();
  const asked = useRef(false);
  const [message, setMessage] = useState("Checking your payment...");
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void confirmTableBillReturn(reference).then((result) => {
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(result.data.paid ? "Your bill is paid. Thank you." : "The payment did not go through. Nothing has been charged.");
      router.refresh();
    });
  }, [reference, router]);
  return (
    <p role="status" className={`mb-block ${TYPE.rowMeta}`} data-testid="bill-return">
      {message}
    </p>
  );
}

/** Copy the check-in code, to send to whoever arrives first. Digits only. */
function CopyCode({ code }: { code: string }) {
  const words = useCopyLabels();
  const [copied, copy] = useCopyFlash();
  if (!words) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      leadingIcon="document"
      done={copied}
      onClick={() => void copy(code)}
      data-testid="check-in-code-copy"
    >
      {copied ? words.copied : words.copy}
    </Button>
  );
}
