"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/css/calls.css";
import { Button } from "@/components/ui/Button";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { requestReviewCall } from "@/lib/calls/review-actions";
import { lagosInputToIso, requestFormErrors, type FormErrors } from "@/lib/calls/screen";
import { REVIEW_CASE_KINDS, type CallKind, type ReviewCaseKind } from "@/lib/calls/types";
import type { CallsCopy } from "../views";
import { banner } from "@/lib/ui/toast";

/**
 * "REQUEST A REVIEW CALL", on a case the staff member already has open.
 *
 * The case is fixed by the page it sits on (kind and id), so the subject is
 * read from that case by the database, never typed here. On the review-calls
 * desk itself the two are fields instead, for a case kind with no desk page
 * of its own (an identity check). The database decides the rest: the staff
 * member's scope for this kind of case, the console proof, one open review
 * per case, never their own case, and the rate limit. A refusal comes back as
 * the sentence to show.
 *
 * Purpose is what the person will read, so it is required (10 to 500). Now
 * means "as soon as they accept"; At a time is Lagos time, 5 minutes to 30
 * days ahead (the server checks the window).
 */
export function RequestReviewCall({
  caseKind,
  caseId,
  copy,
  startOpen = false,
}: {
  caseKind?: ReviewCaseKind;
  caseId?: string;
  copy: CallsCopy;
  startOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [kindOfCase, setKindOfCase] = useState<ReviewCaseKind>(caseKind ?? "identity_verification");
  const [ref, setRef] = useState(caseId ?? "");
  const [purpose, setPurpose] = useState("");
  const [kind, setKind] = useState<CallKind>("VIDEO");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [at, setAt] = useState("");
  const [errors, setErrors] = useState<FormErrors<"purpose" | "at" | "caseId">>({});
  const [busy, setBusy] = useState(false);
  const s = copy.staff;

  if (!open) {
    return (
      <Button variant="secondary" size="md" leadingIcon="video" onClick={() => setOpen(true)} data-testid="review-call-request-open">
        {s.request}
      </Button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: FormErrors<"purpose" | "at" | "caseId"> = requestFormErrors({ purpose, when, at }, s.errors);
    if (!caseId && !/^[0-9a-f-]{36}$/i.test(ref.trim())) found.caseId = s.errors.caseId;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const scheduledFor = when === "schedule" ? lagosInputToIso(at) : null;
    const answer = await requestReviewCall({
      caseKind: caseKind ?? kindOfCase,
      caseId: (caseId ?? ref).trim(),
      purpose: purpose.trim(),
      kind,
      ...(scheduledFor ? { scheduledFor } : {}),
    }).catch(() => null);
    setBusy(false);
    if (!answer) {
      banner.error(copy.connecting.body);
      return;
    }
    if (!answer.ok) {
      banner.error(answer.error);
      return;
    }
    /* Said by the one banner, which stays up across the move (founder, 7 November 2026). */
    banner.success(when === "schedule" ? "Review call scheduled" : "Review call requested");
    router.push(`/admin/review-calls/${answer.data.id}`);
  };

  return (
    <form className="nf-review-call__card" onSubmit={(e) => void submit(e)} noValidate data-testid="review-call-request">
      <p className="flex items-center gap-xs font-semibold">
        <UiIcon name="video" size={20} filled />
        {caseId ? s.requestFor : s.request}
      </p>
      <p className="nf-review-call__disclaimer">
        <UiIcon name="info" size={16} />
        <span>{copy.review.notVerificationStaff}</span>
      </p>
      {!caseId ? (
        <>
          <SelectField
            label={s.caseKindLabel}
            value={kindOfCase}
            onChange={(e) => setKindOfCase(e.target.value as ReviewCaseKind)}
          >
            {REVIEW_CASE_KINDS.map((k) => (
              <option key={k} value={k}>
                {s.caseKinds[k]}
              </option>
            ))}
          </SelectField>
          <TextField
            label={s.caseIdLabel}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            error={errors.caseId}
            autoComplete="off"
            spellCheck={false}
          />
        </>
      ) : null}
      <TextArea
        label={s.purposeLabel}
        hint={s.purposeHint}
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        maxLength={500}
        rows={3}
        error={errors.purpose}
        data-testid="review-call-purpose"
      />
      <fieldset className="nf-review-call__radios">
        <legend className="nf-review-call__label">{s.kindLabel}</legend>
        {(["VIDEO", "AUDIO"] as const).map((k) => (
          <label key={k} className="nf-review-call__radio">
            <input type="radio" name="review-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            <UiIcon name={k === "VIDEO" ? "video" : "phone"} size={20} filled />
            {k === "VIDEO" ? copy.buttons.video : copy.buttons.voice}
          </label>
        ))}
      </fieldset>
      <fieldset className="nf-review-call__radios">
        <legend className="nf-review-call__label">{s.whenLabel}</legend>
        <label className="nf-review-call__radio">
          <input type="radio" name="review-when" checked={when === "now"} onChange={() => setWhen("now")} />
          {s.now}
        </label>
        <label className="nf-review-call__radio">
          <input type="radio" name="review-when" checked={when === "schedule"} onChange={() => setWhen("schedule")} />
          {s.schedule}
        </label>
      </fieldset>
      {when === "schedule" ? (
        <TextField
          type="datetime-local"
          label={s.scheduleLabel}
          value={at}
          onChange={(e) => setAt(e.target.value)}
          error={errors.at}
          data-testid="review-call-at"
        />
      ) : null}
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="primary" size="md" loading={busy} data-testid="review-call-send">
          {s.send}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)} disabled={busy}>
          {copy.ended.close}
        </Button>
      </div>
    </form>
  );
}
