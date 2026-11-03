"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { requestRefund } from "@/lib/after-gate/refund-request-actions";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import { REFUND_ROUTE } from "@/lib/money/copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-24. The dated ask for a paid stay to be cancelled.
 *
 * Before this a guest wrote to support in free text and nothing recorded when
 * they asked, so no promise about the refund could be measured. The form is
 * two questions; the database stamps the time and the due-by. On success the
 * page refreshes and the ask appears as a dated line above.
 */
export function RefundRequestForm({
  bookingId,
  copy,
  reasons,
  success,
  cancelWord = "Keep it",
}: {
  bookingId: string;
  /** The page's `t.success`, for "Refund requested". Absent, no sheet. */
  success?: SuccessWords;
  copy: Dictionary["afterTheGate"]["refund"];
  reasons: { code: string; label: string }[];
  /** The confirm panel's way out; the reader's word for "Cancel". */
  cancelWord?: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0]?.code ?? "guest_choice");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /*
   * The request is filed. The page refreshes when the sheet CLOSES rather
   * than now: the refreshed page draws the dated ask in place of this form,
   * and a sheet held by this form would be unmounted by the refresh that
   * shows its own result. "Requested", never "refunded": nothing has moved.
   */
  const [filed, setFiled] = useState(false);
  /* The confirm step (plan item 22): the form's submit opens the panel and
     the panel's primary files the same `requestRefund` call as before. */
  const [confirming, setConfirming] = useState(false);
  const words = success ? successCopy(success, "refundRequested") : null;

  function submit() {
    setError(null);
    start(async () => {
      try {
        const result = await requestRefund({ bookingId, reason, note });
        setConfirming(false);
        if (!result.ok) {
          setError(result.error || copy.askFailed);
          return;
        }
        /* With no sheet to hold it open, the page refreshes straight away. */
        if (words) setFiled(true);
        else router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="nf-panel nf-panel--card block p-md"
      data-testid="refund-request"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setConfirming(true);
      }}
    >
      <h2 className="nf-h3">{copy.askHeading}</h2>
      <p className="nf-body-sm mt-xs text-[var(--nf-content-secondary)]">{copy.askLede}</p>
      <div className="mt-md grid gap-md">
        <Field label={copy.askReason}>
          {(control) => (
            <select {...control} className="nf-field" value={reason} onChange={(event) => setReason(event.target.value)}>
              {reasons.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={copy.askNote} error={error ?? undefined}>
          {(control) => (
            <textarea
              {...control}
              className="nf-field min-h-[5.5rem]"
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Button type="submit" variant="secondary" full className="mt-md" loading={pending} disabled={pending || filed}>
        {copy.askSubmit}
      </Button>
      <Sheet
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(false);
        }}
        title={copy.askHeading}
        hideTitle
        card
        detents={[0.9]}
      >
        <ConfirmPanel
          icon="receipt"
          tone="warning"
          title={`${copy.askHeading}?`}
          context={copy.askLede}
          summary={[{ label: copy.askReason, value: reasons.find((r) => r.code === reason)?.label ?? reason }]}
          reassurance={REFUND_ROUTE}
          cancel={
            <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              {cancelWord}
            </Button>
          }
          primary={
            <Button variant="primary" loading={pending} disabled={pending || filed} onClick={submit}>
              {copy.askSubmit}
            </Button>
          }
        />
      </Sheet>
      {success && words ? (
      <SuccessSheet
        open={filed}
        onOpenChange={(open) => {
          if (open) return;
          setFiled(false);
          router.refresh();
        }}
        variant={words.variant}
        object={words.object}
        title={words.title}
        body={words.body}
        primary={{ label: success.continue }}
      />
      ) : null}
    </form>
  );
}
