"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  addRentContributor,
  answerRentShare,
  cancelSplitMoveIn,
  removeRentContributor,
} from "@/lib/tenancy/share-actions";
import { settleShareReturn, startShareCheckout } from "@/lib/tenancy/share-checkout";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, withoutDone, type SuccessWords } from "@/lib/ui/success-moments";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["flatmates"];

/**
 * V-86. The lead invites a flatmate to a share, removes one while nothing is
 * paid, or cancels the group's move-in (paid shares go back to their cards);
 * a flatmate accepts or declines, then pays an accepted share by card,
 * straight to the landlord or agent. Every rule is the database door's;
 * these forms collect and report.
 */
/* What a step did is said by the one banner at the top of the screen (Grade 1). */
function useRun() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  /* `onOk` takes over the refresh: a success moment refreshes the page when
     it closes, so the list does not jump underneath it. */
  function run(work: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    start(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          banner.error(result.error ?? "That did not go through. Try again.");
          return;
        }
        if (onOk) onOk();
        else router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }
  return { pending, run };
}

export function AddFlatmate({
  tenancyId,
  copy,
  success: s,
}: {
  tenancyId: string;
  copy: Copy;
  /** The page's `t.success`, for "Invitation sent". Absent, no moment. */
  success?: SuccessWords;
}) {
  const router = useRouter();
  const { pending, run } = useRun();
  const [email, setEmail] = useState("");
  const [share, setShare] = useState("");
  /* Opens only once the database door took the invitation. */
  const [invited, setInvited] = useState(false);
  const words = s ? successCopy(s, "flatmateInvited") : null;
  return (
    <>
      <form
        className="grid gap-md"
        data-testid="flatmate-add"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () => addRentContributor({ tenancyId, email, shareNaira: share }),
            s
              ? () => {
                  setEmail("");
                  setShare("");
                  setInvited(true);
                }
              : undefined,
          );
        }}
      >
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          {copy.addHelp}
        </p>
        <Field label={copy.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="off"
              className="nf-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label={copy.share}>
          {(control) => (
            <input
              {...control}
              inputMode="decimal"
              className="nf-field"
              value={share}
              onChange={(e) => setShare(e.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="secondary"
          full
          loading={pending}
          disabled={pending || !email.trim() || !share.trim()}
        >
          {copy.addSubmit}
        </Button>
      </form>
      {invited && words && s ? (
        <SuccessSheet
          open
          onOpenChange={(open) => {
            if (open) return;
            setInvited(false);
            router.refresh();
          }}
          variant={words.variant}
          haptic={words.haptic}
          object={words.object}
          title={words.title}
          body={words.body}
          primary={{ label: s.continue }}
        />
      ) : null}
    </>
  );
}

export function RemoveFlatmate({
  tenancyId,
  contributorId,
  copy,
}: {
  tenancyId: string;
  contributorId: string;
  copy: Copy;
}) {
  const { pending, run } = useRun();
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() => removeRentContributor({ tenancyId, contributorId }))
        }
      >
        {copy.remove}
      </Button>
    </>
  );
}

/**
 * Pay my own share by card, straight to the landlord or agent. The server
 * opens a Paystack checkout with the split the database computed; the
 * browser is sent to Paystack's page and comes back to settle it.
 */
export function PayShare({
  tenancyId,
  contributorId,
  label,
  help,
}: {
  tenancyId: string;
  /** The flatmate's share row; absent for the lead paying the remainder. */
  contributorId?: string | null;
  label: string;
  help?: string;
}) {
  const [pending, start] = useSafeTransition();
  const [key] = useState(() => crypto.randomUUID());
  return (
    <div className="grid gap-xs">
      {help && <p className="nf-caption">{help}</p>}
      <Button
        variant="primary"
        full
        loading={pending}
        disabled={pending}
        onClick={() => {
          start(async () => {
            try {
              const result = await startShareCheckout({ tenancyId, contributorId: contributorId ?? null, idempotencyKey: key });
              if (!result.ok || !result.data) {
                if (!result.ok) banner.error(result.error ?? "That did not go through. Try again.");
                return;
              }
              window.location.assign(result.data.authorizationUrl);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      >
        {label}
      </Button>
    </div>
  );
}

/**
 * Back from Paystack with `?paid=1&reference=`: settle the share once, then refresh.
 *
 * THE RECEIPT IS THE SERVER'S ANSWER, NOT THE FLAG. The success sheet opens
 * only when this call settled money: `share-settled` (this share is in) or
 * `settled` (it was the last one and the move-in is paid in full). `already`
 * is a revisit of a payment recorded before, so it shows nothing, and a
 * refusal (still processing, failed, refunded) keeps its own sentence. The
 * flag goes when the sheet is closed, so a refresh does not replay it.
 */
export function SettleShareOnReturn({
  tenancyId,
  reference,
  success: s,
}: {
  tenancyId: string;
  reference: string;
  /** The page's `t.success`, for the receipt. Absent, no sheet. */
  success?: SuccessWords;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<{ moment: "sharePaid" | "moveInPaid"; amountMinor: number | null } | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void settleShareReturn({ reference, tenancyId }).then((result) => {
      if (!result.ok) banner.error(result.error ?? "That did not go through. Try again.");
      if (result.ok && result.data && result.data.state !== "already") {
        setReceipt({
          moment: result.data.state === "settled" ? "moveInPaid" : "sharePaid",
          amountMinor: result.data.amountMinor,
        });
      }
      router.refresh();
    });
  }, [reference, tenancyId, router]);

  const close = () => {
    setReceipt(null);
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const clean = withoutDone(here, ["paid", "reference"]);
    if (clean !== here) router.replace(clean, { scroll: false });
  };
  const words = receipt && s ? successCopy(s, receipt.moment) : null;

  return (
    <>
      {receipt && words && s ? (
        <SuccessSheet
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          variant={words.variant}
          haptic={words.haptic}
          object={words.object}
          title={words.title}
          body={words.body}
          amount={receipt.amountMinor !== null ? { minorUnits: receipt.amountMinor } : undefined}
          details={[{ label: s.detail.reference, value: reference, mono: true }]}
          primary={{ label: s.continue }}
        />
      ) : null}
    </>
  );
}

/** The lead cancels the group's move-in before it is fully paid; paid shares go back to their cards. */
export function CancelSplit({ tenancyId, copy }: { tenancyId: string; copy: Copy }) {
  const { pending, run } = useRun();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {copy.cancelSplit}
      </Button>
    );
  }
  return (
    <form
      className="grid gap-sm"
      data-testid="split-cancel"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => cancelSplitMoveIn({ tenancyId, note }));
      }}
    >
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.cancelHelp}</p>
      <Field label={copy.cancelNote}>
        {(control) => <input {...control} className="nf-field" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" full loading={pending} disabled={pending}>
        {copy.cancelSplit}
      </Button>
    </form>
  );
}

export function ShareAnswer({
  contributorId,
  copy,
}: {
  contributorId: string;
  copy: Copy;
}) {
  const { pending, run } = useRun();
  return (
    <div className="grid gap-xs" data-testid="share-answer">
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            run(() => answerRentShare({ contributorId, answer: "accepted" }))
          }
        >
          {copy.accept}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() => answerRentShare({ contributorId, answer: "declined" }))
          }
        >
          {copy.decline}
        </Button>
      </div>
    </div>
  );
}
