"use client";

import { banner } from "@/lib/ui/toast";
import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { submitTenancyReview } from "@/lib/tenancy/review-actions";
import { EXTRA_TO } from "@/lib/tenancy/review-model";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Tri = "yes" | "no" | "not_sure";

/**
 * THE TENANCY REVIEW FORM (V-59). The door first, then the flat, the agent
 * and "again", then the stars and a sentence. Every control is a 44px
 * segmented row. States: answering, the refusal in words with every answer
 * kept, sending, and done.
 */
export function TenancyReviewForm({
  paymentId,
  copy,
  success,
}: {
  paymentId: string;
  /** The page's `t.success`, for "Review sent". Absent, no sheet. */
  success?: SuccessWords;
  copy: Dictionary["trustVisible"]["tenancy"];
}) {
  const [paidExtra, setPaidExtra] = useState<"no" | "yes" | "">("");
  const [extraNaira, setExtraNaira] = useState("");
  const [extraTo, setExtraTo] = useState<(typeof EXTRA_TO)[number] | "">("");
  const [asListed, setAsListed] = useState<Tri | "">("");
  const [agentOnTime, setAgentOnTime] = useState<Tri | "">("");
  const [again, setAgain] = useState<Tri | "">("");
  const [rating, setRating] = useState<"1" | "2" | "3" | "4" | "5" | "">("");
  const [body, setBody] = useState("");
  const [phoneGate, setPhoneGate] = useState(false);
  const [done, setDone] = useState(false);
  const [successClosed, setSuccessClosed] = useState(false);
  const sent = success ? successCopy(success, "tenancyReviewSent") : null;
  const [pending, startTransition] = useSafeTransition();

  const tri = [
    { value: "yes" as const, label: copy.yes },
    { value: "no" as const, label: copy.no },
    { value: "not_sure" as const, label: copy.notSure },
  ];

  if (done) {
    return (
      <>
        <p role="status" className="nf-body text-[var(--nf-content-primary)]" data-testid="tenancy-review-done">
          {copy.done}
        </p>
        {/* `done` is set only by `submitTenancyReview`'s ok. */}
        {success && sent ? (
        <SuccessSheet
          open={!successClosed}
          onOpenChange={(open) => {
            if (!open) setSuccessClosed(true);
          }}
          variant={sent.variant}
          haptic={sent.haptic}
          object={sent.object}
          title={sent.title}
          body={sent.body}
          primary={{ label: success.continue }}
        />
        ) : null}
      </>
    );
  }

  function send() {
    setPhoneGate(false);
    const naira = Number(extraNaira.replace(/[^\d]/g, ""));
    if (
      paidExtra === "" ||
      asListed === "" ||
      agentOnTime === "" ||
      again === "" ||
      rating === "" ||
      (paidExtra === "yes" && (!(naira > 0) || extraTo === ""))
    ) {
      /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
      banner.error(copy.incomplete);
      return;
    }
    startTransition(async () => {
      try {
        const result = await submitTenancyReview({
          paymentId,
          paidExtra,
          ...(paidExtra === "yes" ? { extraNaira: naira, extraTo } : {}),
          asListed,
          agentOnTime,
          again,
          rating: Number(rating),
          ...(body.trim() ? { body: body.trim() } : {}),
        });
        if (!result.ok) {
          /* Said by the one banner (Grade 1); the phone step stays as its link. */
          banner.error(result.error);
          setPhoneGate(isPhoneGate(result));
          return;
        }
        setDone(true);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className={panelClass({ className: "grid gap-md p-card" })} data-testid="tenancy-review-form">
      <div className="grid gap-xs">
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.paidExtra}</p>
        <Segmented<"no" | "yes" | "">
          semantics="radio"
          full
          label={copy.paidExtra}
          options={[
            { value: "no" as const, label: copy.no },
            { value: "yes" as const, label: copy.yes },
          ]}
          value={paidExtra}
          onChange={(next) => setPaidExtra(next)}
        />
      </div>
      {paidExtra === "yes" && (
        <>
          <TextField
            label={copy.howMuch}
            inputMode="numeric"
            value={extraNaira}
            onChange={(event) => setExtraNaira(event.target.value.replace(/[^\d,]/g, ""))}
          />
          <div className="grid gap-xs">
            <p className="nf-body-sm text-[var(--nf-content-primary)]">{copy.toWhom}</p>
            <Segmented<(typeof EXTRA_TO)[number] | "">
              semantics="radio"
              full
              label={copy.toWhom}
              options={EXTRA_TO.map((to) => ({ value: to, label: copy.to[to] }))}
              value={extraTo}
              onChange={(next) => setExtraTo(next)}
            />
          </div>
        </>
      )}
      {(
        [
          [copy.asListed, asListed, setAsListed],
          [copy.agentOnTime, agentOnTime, setAgentOnTime],
          [copy.again, again, setAgain],
        ] as const
      ).map(([question, value, set]) => (
        <div key={question} className="grid gap-xs">
          <p className="nf-body-sm text-[var(--nf-content-primary)]">{question}</p>
          <Segmented<Tri | "">
            semantics="radio"
            full
            label={question}
            options={tri}
            value={value}
            onChange={(next) => set(next)}
          />
        </div>
      ))}
      <div className="grid gap-xs">
        <p className="nf-body-sm text-[var(--nf-content-primary)]">{copy.rating}</p>
        <Segmented<"1" | "2" | "3" | "4" | "5" | "">
          semantics="radio"
          full
          label={copy.rating}
          options={(["1", "2", "3", "4", "5"] as const).map((n) => ({ value: n, label: n }))}
          value={rating}
          onChange={(next) => setRating(next)}
        />
      </div>
      <TextField label={copy.body} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} />
      <PhoneGateLink show={phoneGate} full />
      <Button type="button" variant="primary" full loading={pending} onClick={send}>
        {pending ? copy.sending : copy.submit}
      </Button>
    </div>
  );
}
