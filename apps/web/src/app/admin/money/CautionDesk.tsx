"use client";

import { useState } from "react";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { ruleCautionDispute, ruleCautionReturn } from "@/lib/admin/caution-desk-actions";
import type { CautionDesk, CautionDispute, ContestedReturn } from "@/lib/admin/reads/caution-desk";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import type { RulingWords } from "../_components/rulings";
import { banner } from "@/lib/ui/toast";

/**
 * THE CAUTION DESK. V-36.
 *
 * Vallo never holds a caution; it rules on the record of one. A disputed
 * deduction gets the amount that stands (zero to what the lister proposed)
 * and a reason both parties read. A return the tenant says never arrived is
 * found received or not received, with a reason. What is left owed after the
 * due date comes to this desk as an escalation to investigate (it went to the
 * Vallo Guarantee until that was retired on 9 November 2026).
 */

const ITEM_LABEL: Record<string, string> = {
  exterior: "Exterior",
  interior: "Interior",
  kitchen: "Kitchen",
  bathrooms: "Bathrooms",
  utilities: "Utilities",
  appliances: "Appliances",
  safety: "Safety",
  overall: "Overall condition",
};

const METHOD_LABEL: Record<string, string> = { bank_transfer: "bank transfer", cash: "cash", other: "other" };

/**
 * A ruling is a slide (COMPONENT_LIBRARY, `DragToConfirm`: "an admin ruling on
 * a dispute"), and a slide is only confirmed once the server has said so, so
 * `run` hands back what the server said and the track never claims a decision
 * that was refused.
 */
function useRun() {
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string): Promise<boolean> => {
    const result = await fn();
    /* The outcome goes to the banner. No retry on a refusal: a ruling moves
       money, so trying again means sliding again. */
    if (result.ok) banner.success(done);
    else banner.error(result.error ?? "That did not go through.");
    return result.ok;
  };
  return { run };
}

function DisputeItem({ row, locale, words }: { row: CautionDispute; locale: Locale; words: RulingWords }) {
  const { run } = useRun();
  const [allowed, setAllowed] = useState(String(row.amountMinor / 100));
  const [reason, setReason] = useState("");
  return (
    <li className="nf-admin-queue-row" data-testid="caution-dispute-row">
      <div className="nf-admin-queue-row__main">
        <p className="font-semibold">
          {ITEM_LABEL[row.item] ?? row.item} · {formatMoney(row.amountMinor, locale)} proposed of a {formatMoney(row.cautionMinor, locale)} caution
        </p>
        {row.note ? <p className="mt-2xs text-[length:var(--nf-text-caption)]">Lister: {row.note}</p> : null}
        <p className="mt-2xs text-[length:var(--nf-text-caption)]">
          <a className="text-[var(--nf-content-link)]" href={`/tenancy/${row.rentPaymentId}`}>
            Open the tenancy file (both sides&apos; reports)
          </a>
        </p>
        {row.photoUrl ? (
          // A signed, short-lived URL to a private object.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photoUrl} alt="" className="mt-xs h-24 w-24 rounded-sm object-cover" />
        ) : null}
      </div>
      <div className="nf-admin-queue-row__actions">
        <div className="grid gap-inline">
          <label className="text-[length:var(--nf-text-caption)]">
            Amount that stands (₦, 0 to allow none)
            <input className="nf-field mt-3xs" inputMode="decimal" value={allowed} onChange={(e) => setAllowed(e.target.value)} />
          </label>
          <label className="text-[length:var(--nf-text-caption)]">
            Reason (both parties read it)
            <input className="nf-field mt-3xs" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          </label>
          {/* The amount that stands decides how much of a caution is kept, so
              the ruling is a money slide: it never resets once confirmed. */}
          <DragToConfirm
            money
            armedLabel={words.armed}
            label={words.slideRule}
            confirmingLabel={words.confirming}
            confirmedLabel={words.confirmed}
            errorLabel={words.error}
            disabled={reason.trim().length < 10}
            onConfirm={() =>
              run(
                () => ruleCautionDispute({ deductionId: row.deductionId, allowedNaira: allowed, reason }),
                "Ruled. Both parties were told.",
              )
            }
            data-testid="caution-rule"
          />
        </div>
      </div>
    </li>
  );
}

function ReturnItem({ row, locale, words }: { row: ContestedReturn; locale: Locale; words: RulingWords }) {
  const { run } = useRun();
  const [reason, setReason] = useState("");
  const rule = (outcome: "received" | "not_received") =>
    run(() => ruleCautionReturn({ returnId: row.returnId, outcome, reason }), "Ruled. Both parties were told.");
  const blocked = reason.trim().length < 10;
  return (
    <li className="nf-admin-queue-row" data-testid="caution-return-row">
      <div className="nf-admin-queue-row__main">
        <p className="font-semibold">
          {formatMoney(row.amountMinor, locale)} recorded as returned on {row.returnedOn} by {METHOD_LABEL[row.method] ?? row.method}
          {row.reference ? `, ref ${row.reference}` : ""}
        </p>
        <p className="mt-2xs text-[length:var(--nf-text-caption)]">Tenant: {row.contestNote}</p>
        <p className="mt-2xs text-[length:var(--nf-text-caption)]">
          <a className="text-[var(--nf-content-link)]" href={`/tenancy/${row.rentPaymentId}`}>
            Open the tenancy file
          </a>
        </p>
      </div>
      <div className="nf-admin-queue-row__actions">
        <div className="grid gap-inline">
          <label className="text-[length:var(--nf-text-caption)]">
            Reason (both parties read it)
            <input className="nf-field mt-3xs" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="grid gap-inline">
            <DragToConfirm
              label={words.slideReceived}
              confirmingLabel={words.confirming}
              confirmedLabel={words.confirmed}
              errorLabel={words.error}
              disabled={blocked}
              onConfirm={() => rule("received")}
              data-testid="caution-received"
            />
            <DragToConfirm
              label={words.slideNotReceived}
              confirmingLabel={words.confirming}
              confirmedLabel={words.confirmed}
              errorLabel={words.error}
              disabled={blocked}
              onConfirm={() => rule("not_received")}
              data-testid="caution-not-received"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

export function CautionRulings({ desk, locale, words }: { desk: CautionDesk; locale: Locale; words: RulingWords }) {
  if (desk.state === "forbidden") {
    return <p className="nf-body text-[var(--nf-content-secondary)]">Your account cannot rule on cautions.</p>;
  }
  if (desk.state !== "ok") {
    return <p className="nf-body text-[var(--nf-content-secondary)]">The caution desk could not be read just now. Refresh to try again.</p>;
  }
  if (desk.disputes.length === 0 && desk.returns.length === 0) {
    return <p className="nf-body text-[var(--nf-content-secondary)]">No disputed deduction or contested return is waiting.</p>;
  }
  return (
    <div className="grid gap-md" data-testid="caution-desk">
      {desk.disputes.length > 0 ? (
        <ul className="nf-admin-queue">
          {desk.disputes.map((row) => (
            <DisputeItem key={row.deductionId} row={row} locale={locale} words={words} />
          ))}
        </ul>
      ) : null}
      {desk.returns.length > 0 ? (
        <ul className="nf-admin-queue">
          {desk.returns.map((row) => (
            <ReturnItem key={row.returnId} row={row} locale={locale} words={words} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
