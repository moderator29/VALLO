"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ROOM_COPY, ROOM_ITEMS, type RoomItem } from "@/lib/inspections/report";
import {
  answerCautionDeduction,
  contestCautionReturn,
  escalateCaution,
  proposeCautionDeduction,
  recordCautionReturn,
} from "@/lib/tenancy/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["tenancy"];

/**
 * The caution register's controls. V-36.
 *
 * The tenant answers each deduction line once: accept or dispute. The lister
 * proposes a line (a room, an amount, a move-out photograph: no lump sums),
 * and records a return they paid directly; the tenant confirms receipt,
 * says a recorded return never arrived, or takes an unreturned caution to
 * the Vallo Guarantee. Nothing here moves money. Every rule is enforced by the database door;
 * these forms only collect the facts and say what came back.
 */

/* What a step did is said by the one banner at the top of the screen (Grade 1). */
function useRun() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  function run(work: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    start(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          banner.error(result.error ?? "That did not go through. Try again.");
          return;
        }
        banner.success(successMsg);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }
  return { pending, run };
}

export function DeductionAnswer({
  tenancyId,
  deductionId,
  copy,
}: {
  tenancyId: string;
  deductionId: string;
  copy: Copy;
}) {
  const { pending, run } = useRun();
  return (
    <div className="mt-xs">
      <div className="flex flex-wrap gap-sm">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() =>
              answerCautionDeduction({
                tenancyId,
                deductionId,
                answer: "accepted",
              }),
              "Deduction accepted"
            )
          }
        >
          {copy.accept}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(() =>
              answerCautionDeduction({
                tenancyId,
                deductionId,
                answer: "disputed",
              }),
              "Deduction disputed"
            )
          }
        >
          {copy.dispute}
        </Button>
      </div>
    </div>
  );
}

export function ProposeDeduction({
  tenancyId,
  obligationId,
  photos,
  copy,
}: {
  tenancyId: string;
  obligationId: string;
  photos: { id: string; item: RoomItem | null; label: string }[];
  copy: Copy;
}) {
  const { pending, run } = useRun();
  const [item, setItem] = useState<RoomItem>(photos[0]?.item ?? "overall");
  const [amount, setAmount] = useState("");
  const [photoId, setPhotoId] = useState(photos[0]?.id ?? "");
  const [note, setNote] = useState("");

  if (photos.length === 0) {
    return (
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
        {copy.proposeNeedsPhoto}
      </p>
    );
  }

  return (
    <form
      className="grid gap-md"
      data-testid="caution-propose"
      onSubmit={(event) => {
        event.preventDefault();
        run(() =>
          proposeCautionDeduction({
            tenancyId,
            obligationId,
            item,
            amountNaira: amount,
            photoId,
            note,
          }),
          "Deduction proposed"
        );
      }}
    >
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
        {copy.proposeHelp}
      </p>
      <Field label={copy.proposeItem}>
        {(control) => (
          <select
            {...control}
            className="nf-field"
            value={item}
            onChange={(e) => setItem(e.target.value as RoomItem)}
          >
            {ROOM_ITEMS.map((room) => (
              <option key={room} value={room}>
                {ROOM_COPY[room].title}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={copy.proposeAmount}>
        {(control) => (
          <input
            {...control}
            className="nf-field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </Field>
      <Field label={copy.proposePhoto}>
        {(control) => (
          <select
            {...control}
            className="nf-field"
            value={photoId}
            onChange={(e) => setPhotoId(e.target.value)}
          >
            {photos.map((photo) => (
              <option key={photo.id} value={photo.id}>
                {photo.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={copy.proposeNote}>
        {(control) => (
          <input
            {...control}
            className="nf-field"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        full
        loading={pending}
        disabled={pending}
      >
        {copy.proposeSubmit}
      </Button>
    </form>
  );
}

/**
 * Record a caution return. The lister records what they paid back; the
 * tenant confirms what they received. The money went directly between them:
 * Vallo only records it. One key per drawn form, so a double tap records once.
 */
export function RecordReturn({
  tenancyId,
  obligationId,
  outstanding,
  outstandingNaira,
  viewer,
  today,
  copy,
}: {
  tenancyId: string;
  obligationId: string;
  /** The formatted amount still owed, for the help line. */
  outstanding: string;
  /** The same amount as plain naira, to prefill the field. */
  outstandingNaira: string;
  viewer: "tenant" | "lister";
  /** Today, Lagos, as YYYY-MM-DD: the default and the latest date. */
  today: string;
  copy: Copy;
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [amount, setAmount] = useState(outstandingNaira);
  const [returnedOn, setReturnedOn] = useState(today);
  const [method, setMethod] = useState<"bank_transfer" | "cash" | "other">("bank_transfer");
  const [reference, setReference] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form
      className="grid gap-md"
      data-testid="caution-return"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const result = await recordCautionReturn({
              tenancyId,
              obligationId,
              amountNaira: amount,
              returnedOn,
              method,
              reference,
              idempotencyKey: key,
            });
            if (!result.ok) {
              banner.error(result.error ?? "That did not go through. Try again.");
              return;
            }
            banner.success(copy.returnSent, { "data-testid": "caution-return-sent" });
            setAmount("");
            setKey(crypto.randomUUID());
            router.refresh();
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
        {(viewer === "lister" ? copy.returnHelp : copy.returnHelpTenant).replace("{outstanding}", outstanding)}
      </p>
      <Field label={copy.returnAmount}>
        {(control) => (
          <input
            {...control}
            className="nf-field"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </Field>
      <Field label={copy.returnDate}>
        {(control) => (
          <input {...control} type="date" className="nf-field" max={today} value={returnedOn} onChange={(e) => setReturnedOn(e.target.value)} />
        )}
      </Field>
      <Field label={copy.returnMethod}>
        {(control) => (
          <select
            {...control}
            className="nf-field"
            value={method}
            onChange={(e) => setMethod(e.target.value as "bank_transfer" | "cash" | "other")}
          >
            {(["bank_transfer", "cash", "other"] as const).map((m) => (
              <option key={m} value={m}>
                {copy.returnMethods[m]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={copy.returnReference}>
        {(control) => (
          <input {...control} className="nf-field" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        )}
      </Field>
      <Button type="submit" variant="primary" full loading={pending} disabled={pending || amount.trim().length === 0}>
        {viewer === "lister" ? copy.returnSubmit : copy.returnSubmitTenant}
      </Button>
    </form>
  );
}

/** The tenant says a return the lister recorded never arrived. Vallo staff rule on it. */
export function ContestReturn({ tenancyId, returnId, copy }: { tenancyId: string; returnId: string; copy: Copy }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {copy.contest}
      </Button>
    );
  }
  return (
    <form
      className="mt-xs grid gap-sm"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => contestCautionReturn({ tenancyId, returnId, note }), "Return contested");
      }}
    >
      <Field label={copy.contestNote}>
        {(control) => <input {...control} className="nf-field" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={pending || note.trim().length < 5}>
        {copy.contestSubmit}
      </Button>
    </form>
  );
}

/** Past its due date, the tenant asks Vallo to look into the unreturned part (the Vallo Guarantee it once went to was retired on 9 November 2026). */
export function EscalateCaution({ tenancyId, obligationId, copy }: { tenancyId: string; obligationId: string; copy: Copy }) {
  const { pending, run } = useRun();
  return (
    <div className="grid gap-xs">
      <Button
        variant="secondary"
        full
        loading={pending}
        disabled={pending}
        onClick={() => run(() => escalateCaution({ tenancyId, obligationId }), "Sent to Vallo. We will look into it.")}
      >
        {copy.escalateSubmit}
      </Button>
    </div>
  );
}
