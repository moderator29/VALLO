"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/envelope";
import { submitReview, type ReviewWritten } from "@/lib/reviews/actions";
import { sendOrKeep } from "@/lib/offline/send-or-keep";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { BODY_MAX, RATING_MAX, RATING_MIN } from "@/lib/reviews/model";
import type { Dictionary } from "@vallo/i18n/core";
import type { ReviewSubject } from "@/lib/reviews/queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { ResultScreen } from "@/components/app/ResultSheet";
import { Button } from "@/components/ui/Button";

/**
 * V-40: the review goes now, or, with no signal, is kept and sent when the
 * signal returns. A form missing its rating goes straight to the server, which
 * says what is missing.
 */
async function sendReview(
  prev: ActionResult<ReviewWritten> | null,
  formData: FormData,
  onKept: () => void,
  couldNotKeep: string,
): Promise<ActionResult<ReviewWritten> | null> {
  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const fields = {
    bookingId: field("bookingId"),
    rating: field("rating"),
    ...(field("body").trim() ? { body: field("body") } : {}),
  };
  if (!fields.rating) return submitReview(prev, formData);
  const done = await sendOrKeep("submit_review", fields, (tapKey) => {
    formData.set("tapKey", tapKey);
    return submitReview(prev, formData);
  });
  if (done.state === "kept") {
    onKept();
    return prev;
  }
  if (done.state === "not_kept") return { ok: false, error: couldNotKeep };
  return done.result;
}

/**
 * The review form.
 *
 * A five point rating that says what each point means, and an optional written
 * account. The rating is a real radio group, so a screen reader announces it as
 * one control with five choices and the keyboard moves through it with arrows
 * for free. The stars are the visual layer over that group, never a replacement
 * for it.
 *
 * On success the router refreshes before the confirmation renders, so the
 * listing behind this screen is already showing the new review by the time the
 * guest taps through to it.
 */
export function ReviewForm({
  subject,
  plansAction,
  success,
  words: w,
}: {
  /** The form's words (`memberFlows.review`). */
  words: Dictionary["memberFlows"]["review"];
  subject: ReviewSubject;
  /** The page's `t.success`, for "Review posted". Absent, no sheet. */
  success?: SuccessWords;
  /** Where "done" sends somebody, in the dictionary's words (V-76 review). */
  plansAction: { label: string; href: string };
}) {
  const router = useRouter();
  const [kept, setKept] = useState(false);
  const OUTBOX = useClientCopy().platform.outbox;
  const [state, formAction, pending] = useActionState<
    ActionResult<ReviewWritten> | null,
    FormData
  >((prev, formData) => sendReview(prev, formData, () => setKept(true), OUTBOX.couldNotKeep), null);

  const [rating, setRating] = useState(0);
  const ratingWord = (value: number) => w.ratings[value as keyof typeof w.ratings] ?? "";
  const [body, setBody] = useState("");
  const [successClosed, setSuccessClosed] = useState(false);
  const posted = success ? successCopy(success, "reviewPosted") : null;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (state?.ok) {
    return (
      <>
      {/* The sheet over the confirmation screen, once, from the action's ok. */}
      {success && posted ? (
      <SuccessSheet
        open={!successClosed}
        onOpenChange={(open) => {
          if (!open) setSuccessClosed(true);
        }}
        variant={posted.variant}
        haptic={posted.haptic}
        object={posted.object}
        title={posted.title}
        body={posted.body}
        details={[{ label: success.detail.for, value: subject.title }]}
        primary={{ label: success.continue }}
      />
      ) : null}
      <ResultScreen
        state="confirmed"
        mark="reviews"
        verdict={w.thanksTitle}
        consequence={w.thanksBody.replace("{title}", subject.title)}
        actions={[
          {
            label: w.seeOnListing,
            href: state.data.href,
            tone: "primary",
          },
          { label: plansAction.label, href: plansAction.href, tone: "quiet" },
        ]}
      />
      </>
    );
  }

  if (kept) {
    return (
      <ResultScreen
        state="pending"
        mark="reviews"
        verdict={OUTBOX.reviewKeptVerdict}
        consequence={OUTBOX.waiting}
        actions={[{ label: plansAction.label, href: plansAction.href, tone: "quiet" }]}
      />
    );
  }

  const stars = Array.from(
    { length: RATING_MAX - RATING_MIN + 1 },
    (_, i) => RATING_MIN + i,
  );
  const remaining = BODY_MAX - body.length;

  return (
    <form action={formAction} className="nf-panel nf-panel--card block p-card">
      <input type="hidden" name="bookingId" value={subject.bookingId} />

      <fieldset className="border-0 p-0">
        <legend className="nf-overline text-[var(--nf-content-muted)]">
          {w.howWasIt}
        </legend>

        <div className="mt-heading flex items-center gap-inline-tight">
          {stars.map((value) => {
            const active = rating >= value;
            return (
              <label
                key={value}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--nf-radius-md)] transition-colors hover:bg-[var(--nf-surface-raised)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--nf-brand-primary)]"
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  required
                  className="sr-only"
                />
                <UiIcon
                  name="star"
                  size={28}
                  className={
                    active
                      ? "text-[var(--nf-rating)]"
                      : "text-[var(--nf-content-muted)] opacity-45"
                  }
                />
                <span className="sr-only">
                  {w.starLabel
                    .replace("{value}", String(value))
                    .replace("{max}", String(RATING_MAX))
                    .replace("{label}", ratingWord(value))}
                </span>
              </label>
            );
          })}
        </div>

        {/* The chosen meaning, held in a live region so the change is announced
            rather than only seen. The reserved height stops the form jumping
            when the first star is picked. */}
        <p
          aria-live="polite"
          className="mt-row min-h-[1.25rem] nf-body-sm font-normal text-[var(--nf-content-secondary)]"
        >
          {rating > 0 ? ratingWord(rating) : ""}
        </p>
      </fieldset>

      <div className="mt-block">
        <label
          htmlFor="review-body"
          className="nf-overline block text-[var(--nf-content-muted)]"
        >
          {w.bodyLabel}
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={6}
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={w.bodyPlaceholder}
          className="nf-field mt-heading w-full resize-y leading-relaxed"
        />
        <p className="mt-row flex items-center justify-between gap-row nf-caption text-[var(--nf-content-muted)]">
          <span>{w.bodyHint}</span>
          <span className="nf-numeric shrink-0">{remaining}</span>
        </p>
      </div>

      {state && !state.ok && (
        <p
          role="alert"
          className="nf-panel nf-panel--card mt-block block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] p-card-sm nf-body-sm leading-relaxed text-[var(--nf-state-error)]"
        >
          {state.error}
        </p>
      )}
      <PhoneGateLink show={isPhoneGate(state)} full className="mt-sm" />

      <Button type="submit" variant="primary" full disabled={pending} className="mt-block">
        {pending ? w.sharing : w.share}
      </Button>

      {/* 12px on the sentence warning somebody not to put a bank account
          number where the whole internet can read it. Caption is the floor. */}
      <p className="mt-heading nf-caption leading-relaxed text-[var(--nf-content-muted)]">
        {w.publicNote}
      </p>
    </form>
  );
}
