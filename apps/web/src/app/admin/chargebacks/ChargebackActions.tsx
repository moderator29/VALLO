"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { addChargebackNote, moveChargeback, openChargeback, overrideChargebackHold } from "@/lib/admin/chargeback-actions";
import {
  CHARGEBACK_PROVIDERS,
  REASON_MAX,
  REASON_MIN,
  type ChargebackState,
  type HeldSubject,
  type MoveOffer,
  type RecoveryState,
} from "@/lib/admin/reads/chargebacks-model";
import type { ActionResult } from "@/lib/actions/envelope";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * THE CHARGEBACKS DESK'S CONTROLS: the next moves on a case, recording a new
 * chargeback, and an evidence note. Each one is a confirm sheet that states
 * what is about to happen, takes the reason the database will write to the
 * timeline and the audit log, runs the server action, and either shows the
 * refusal in words or refreshes the page from the database.
 *
 * Every string arrives from the page as a dictionary slice; nothing here
 * resolves a locale.
 */

type DeskCopy = Dictionary["chargebacks"]["desk"];

const TONE_VARIANT: Record<MoveOffer["tone"], ButtonVariant> = {
  primary: "primary",
  secondary: "secondary",
  danger: "dangerQuiet",
};

/**
 * Every outcome on this desk goes to the banner: done closes the sheet and
 * says what happened; a refusal keeps the sheet open with the server's own
 * sentence and the same tap one away.
 */
function sayRefusal(result: ActionResult<unknown>, retry?: () => void) {
  if (result.ok) return;
  banner.error(result.error, retry ? { retry } : undefined);
}

function ReasonField({ copy, value, onChange, label }: { copy: DeskCopy; value: string; onChange: (v: string) => void; label?: string }) {
  const short = value.trim().length > 0 && value.trim().length < REASON_MIN;
  return (
    <label className="mt-md block">
      <span className="nf-label">{label ?? copy.reasonLabel}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        minLength={REASON_MIN}
        maxLength={REASON_MAX}
        required
        aria-describedby="nf-cb-reason-hint"
        className="nf-field mt-2xs w-full resize-y"
      />
      <span id="nf-cb-reason-hint" className={`mt-2xs block text-[length:var(--nf-text-caption)] ${short ? "text-[var(--nf-state-warning)]" : "text-[var(--nf-content-muted)]"}`}>
        {copy.reasonHint}
      </span>
    </label>
  );
}

/* --------------------------------------------------------------- override */

type OverrideCopy = Dictionary["chargebacks"]["override"];

/**
 * What the payout rule is holding for this lister, each with its own
 * Override (migration cbh01): a confirm sheet, a required reason, and
 * `overrideChargebackHold`, which the database checks for finance, refuses
 * for the staffer's own hold and writes to the audit log.
 */
export function HeldPayments({
  held,
  copy,
  deskCopy,
  locale,
  currency,
}: {
  held: HeldSubject[] | null;
  copy: OverrideCopy;
  deskCopy: DeskCopy;
  locale: Locale;
  currency: string;
}) {
  const [open, setOpen] = useState<HeldSubject | null>(null);
  const statuses = copy.statuses as Record<string, string>;
  if (held === null) return <p className="nf-cb-note">{copy.unreadable}</p>;
  return (
    <div data-testid="chargeback-held">
      <p className="nf-caption mt-0 leading-relaxed text-[var(--nf-content-secondary)]">{copy.lede}</p>
      {held.length === 0 ? (
        <p className="nf-caption mt-sm text-[var(--nf-content-muted)]" data-testid="chargeback-held-empty">
          {copy.empty}
        </p>
      ) : (
        <ul className="nf-cb-held">
          {held.map((item) => (
            <li key={`${item.kind}:${item.id}`} className="nf-cb-held__row" data-kind={item.kind}>
              <div className="min-w-0">
                <p className="nf-cb-held__head">
                  {copy.kinds[item.kind]} · {formatMoney(item.amountMinor, locale, currency)}
                </p>
                <p className="nf-cb-held__meta">
                  <span className="font-mono">{item.reference.slice(0, 18)}</span> · {statuses[item.status] ?? item.status}
                </p>
              </div>
              {item.overridden ? (
                <span className="nf-cb-held__done">
                  <UiIcon name="circle-check" size={16} className="text-[var(--nf-state-success)]" />
                  {copy.overridden}
                </span>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setOpen(item)} data-override={item.id}>
                  {copy.button}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <OverrideSheet item={open} copy={copy} deskCopy={deskCopy} locale={locale} currency={currency} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}

function OverrideSheet({
  item,
  copy,
  deskCopy,
  locale,
  currency,
  onClose,
}: {
  item: HeldSubject;
  copy: OverrideCopy;
  deskCopy: DeskCopy;
  locale: Locale;
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useSafeTransition();
  const blocked = reason.trim().length < REASON_MIN;
  const submit = (): void =>
    startTransition(async () => {
      try {
        const outcome = await overrideChargebackHold({ kind: item.kind, subjectId: item.id, reason: reason.trim() });
        if (outcome.ok) {
          banner.success(`${copy.doneTitle}. ${copy.doneBody}`);
          onClose();
          router.refresh();
        } else sayRefusal(outcome, submit);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.sheetTitle}
      testId="chargeback-override-sheet"
      footer={
        <div className="grid gap-sm">
          <Button variant="primary" full onClick={submit} disabled={blocked} loading={pending}>
            {copy.confirm}
          </Button>
          <Button variant="secondary" full onClick={onClose}>
            {deskCopy.notNow}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {copy.sheetBody
          .replace("{kind}", copy.kinds[item.kind].toLowerCase())
          .replace("{reference}", item.reference.slice(0, 18))
          .replace("{amount}", formatMoney(item.amountMinor, locale, currency))}
      </p>
      <ReasonField copy={{ ...deskCopy, reasonHint: copy.reasonHint }} value={reason} onChange={setReason} label={copy.reasonLabel} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ moves */

export type MoveCase = {
  id: string;
  state: ChargebackState;
  recoveryState: RecoveryState;
  recoveredMinor: number;
  amountMinor: number;
  currency: string;
};

export function MoveButtons({ row, offers, copy, locale }: { row: MoveCase; offers: MoveOffer[]; copy: DeskCopy; locale: Locale }) {
  const [open, setOpen] = useState<MoveOffer | null>(null);
  if (offers.length === 0) {
    return <p className="nf-caption text-[var(--nf-content-muted)]">{copy.detail.noMoves}</p>;
  }
  return (
    <>
      <div className="nf-cb-moves" data-testid="chargeback-moves">
        {offers.map((offer) => (
          <Button key={offer.key} variant={TONE_VARIANT[offer.tone]} full onClick={() => setOpen(offer)} data-move={offer.key}>
            {copy.moves[offer.key].label}
          </Button>
        ))}
      </div>
      {open ? <MoveSheet row={row} offer={open} copy={copy} locale={locale} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function MoveSheet({ row, offer, copy, locale, onClose }: { row: MoveCase; offer: MoveOffer; copy: DeskCopy; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const words = copy.moves[offer.key];
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [recoveredNow, setRecoveredNow] = useState("");
  const [alreadyRecovered, setAlreadyRecovered] = useState(false);
  const [pending, startTransition] = useSafeTransition();

  const nowKobo = /^\d{1,12}(\.\d{1,2})?$/.test(recoveredNow.replace(/[,\s]/g, "")) ? Math.round(Number(recoveredNow.replace(/[,\s]/g, "")) * 100) : 0;
  const blocked = note.trim().length < REASON_MIN || (offer.asksRecovered === true && nowKobo <= 0);

  const submit = (): void =>
    startTransition(async () => {
      try {
        const outcome = await moveChargeback({
          chargebackId: row.id,
          move: offer.key,
          note: note.trim(),
          fromState: row.state,
          fromRecovery: row.recoveryState,
          ...(offer.asksRecovered ? { recoveredNow } : {}),
          ...(offer.offersAlreadyRecovered && alreadyRecovered ? { alreadyRecovered: true } : {}),
          ...(offer.asksDeadline && due ? { evidenceDueAt: due } : {}),
        });
        if (outcome.ok) {
          banner.success(`${copy.savedTitle}. ${copy.savedBody}`);
          onClose();
          router.refresh();
        } else sayRefusal(outcome, submit);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={words.title}
      testId="chargeback-move-sheet"
      footer={
        <div className="grid gap-sm">
          <Button variant={offer.tone === "danger" ? "dangerQuiet" : "primary"} full onClick={submit} disabled={blocked} loading={pending}>
            {words.label}
          </Button>
          <Button variant="secondary" full onClick={onClose}>
            {copy.notNow}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{words.body}</p>
      {offer.asksDeadline ? (
        <label className="mt-md block">
          <span className="nf-label">
            {copy.dueLabel} {copy.open.optional}
          </span>
          <input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} className="nf-field mt-2xs w-full" />
        </label>
      ) : null}
      {offer.asksRecovered && "amount" in words ? (
        <label className="mt-md block">
          <span className="nf-label">{words.amount}</span>
          <input
            inputMode="decimal"
            value={recoveredNow}
            onChange={(event) => setRecoveredNow(event.target.value)}
            className="nf-field mt-2xs w-full"
            aria-describedby="nf-cb-new-total"
          />
          <span id="nf-cb-new-total" className="mt-2xs block text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
            {words.newTotal
              .replace("{amount}", formatMoney(Math.min(row.amountMinor, row.recoveredMinor + nowKobo), locale, row.currency))
              .replace("{of}", formatMoney(row.amountMinor, locale, row.currency))}
          </span>
        </label>
      ) : null}
      {offer.offersAlreadyRecovered && "alreadyRecovered" in words ? (
        <label className="mt-md flex min-h-11 items-start gap-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]">
          <input type="checkbox" checked={alreadyRecovered} onChange={(event) => setAlreadyRecovered(event.target.checked)} className="mt-[3px]" />
          <span>{words.alreadyRecovered}</span>
        </label>
      ) : null}
      <ReasonField copy={copy} value={note} onChange={setNote} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------- open */

export type OpenDefaults = { reference?: string; provider?: string; amountMinor?: number };

export function OpenChargebackButton({
  copy,
  defaults,
  label,
  variant = "primary",
}: {
  copy: DeskCopy;
  defaults?: OpenDefaults;
  label?: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} data-testid="chargeback-open-trigger">
        {label ?? copy.open.trigger}
      </Button>
      {open ? <OpenSheet copy={copy} defaults={defaults} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function OpenSheet({ copy, defaults, onClose }: { copy: DeskCopy; defaults?: OpenDefaults; onClose: () => void }) {
  const router = useRouter();
  const o = copy.open;
  const [reference, setReference] = useState(defaults?.reference ?? "");
  const [provider, setProvider] = useState<string>(
    defaults?.provider && (CHARGEBACK_PROVIDERS as readonly string[]).includes(defaults.provider) ? defaults.provider : "paystack",
  );
  const [disputeId, setDisputeId] = useState("");
  const [amount, setAmount] = useState(defaults?.amountMinor ? String(defaults.amountMinor / 100) : "");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  /* Each field's word stays under its field; the outcome goes to the banner. */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useSafeTransition();

  const blocked = reference.trim().length < 3 || disputeId.trim().length === 0 || amount.trim().length === 0 || note.trim().length < REASON_MIN;

  const submit = (): void =>
    startTransition(async () => {
      try {
        const outcome = await openChargeback({
          reference: reference.trim(),
          provider: provider as (typeof CHARGEBACK_PROVIDERS)[number],
          disputeId: disputeId.trim(),
          amount,
          evidenceDueAt: due,
          providerStatus: status.trim(),
          note: note.trim(),
        });
        if (outcome.ok) {
          const made = outcome.data;
          const open = { action: { label: o.openIt, run: () => router.push(`/admin/chargebacks/${made.chargebackId}`) } };
          if (made.duplicate) banner.info(o.already, open);
          else banner.success(`${o.doneTitle}. ${o.doneBody}`, open);
          onClose();
          router.refresh();
        } else {
          const fields = outcome.fieldErrors ?? {};
          setErrors(fields);
          sayRefusal(outcome, Object.keys(fields).length === 0 ? submit : undefined);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const fieldError = (key: string) =>
    errors[key] ? <span className="mt-2xs block text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">{errors[key]}</span> : null;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={o.title}
      testId="chargeback-open-sheet"
      footer={
        <div className="grid gap-sm">
          <Button variant="primary" full onClick={submit} disabled={blocked} loading={pending}>
            {o.submit}
          </Button>
          <Button variant="secondary" full onClick={onClose}>
            {copy.notNow}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{o.lede}</p>
      <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">{o.sheetBody}</p>
      <label className="mt-md block">
        <span className="nf-label">{o.reference}</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="nf-field mt-2xs w-full font-mono" autoComplete="off" />
        {fieldError("reference")}
      </label>
      <div className="mt-md grid grid-cols-2 gap-sm">
        <label className="block">
          <span className="nf-label">{o.provider}</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="nf-field mt-2xs w-full">
            {CHARGEBACK_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {o.providers[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{o.amount}</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="nf-field mt-2xs w-full" />
          {fieldError("amount")}
        </label>
      </div>
      <label className="mt-md block">
        <span className="nf-label">{o.disputeId}</span>
        <input value={disputeId} onChange={(e) => setDisputeId(e.target.value)} className="nf-field mt-2xs w-full font-mono" autoComplete="off" />
        {fieldError("disputeId")}
      </label>
      <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2">
        <label className="block">
          <span className="nf-label">
            {o.due} {o.optional}
          </span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="nf-field mt-2xs w-full" />
        </label>
        <label className="block">
          <span className="nf-label">
            {o.providerStatus} {o.optional}
          </span>
          <input value={status} onChange={(e) => setStatus(e.target.value)} className="nf-field mt-2xs w-full" maxLength={120} />
        </label>
      </div>
      <ReasonField copy={copy} value={note} onChange={setNote} label={o.note} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------- note */

export function ChargebackNoteForm({ chargebackId, copy }: { chargebackId: string; copy: DeskCopy }) {
  const router = useRouter();
  const d = copy.detail;
  const [note, setNote] = useState("");
  const [pending, startTransition] = useSafeTransition();
  const submit = (): void =>
    startTransition(async () => {
      try {
        const outcome = await addChargebackNote({ chargebackId, note: note.trim() });
        if (outcome.ok) {
          banner.success(d.noteDone);
          setNote("");
          router.refresh();
        } else sayRefusal(outcome, submit);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <form
      className="mt-md"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      data-testid="chargeback-note-form"
    >
      <ReasonField copy={copy} value={note} onChange={setNote} label={d.noteLabel} />
      <div className="mt-sm flex flex-wrap items-center gap-sm">
        <Button type="submit" variant="secondary" disabled={note.trim().length < REASON_MIN} loading={pending}>
          {d.noteSubmit}
        </Button>
      </div>
    </form>
  );
}
