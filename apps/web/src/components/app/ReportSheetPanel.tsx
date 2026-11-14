"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useActionState, useEffect, useId, useState } from "react";
import { banner } from "@/lib/ui/toast";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { reportSomething, type ReportReceipt } from "@/lib/reports/actions";
import {
  DETAILS_MAX,
  REPORT_CATEGORY_COPY,
  REPORT_CATEGORY_ORDER,
  REPORT_TARGET_NOUN,
  type ReportCategory,
  type ReportTarget,
} from "@/lib/reports/categories";
import type { ActionResult } from "@/lib/actions/envelope";
import { panelClass } from "@/components/ui/Panel";
import { responseTimeFor } from "@/lib/trust/standards";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy } from "@/lib/ui/success-moments";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";

/**
 * The report sheet's BODY: the categories, the details, the send, the "we have
 * it" panel and its success sheet. Its trigger is `ReportSheet`, which loads
 * this module only when the sheet is wanted (see `lib/ui/lazy-sheet.ts`), so a
 * page with a "Report this" link carries none of it until somebody uses it.
 *
 * The categories are the ones the database will accept, imported from the same
 * zod-free module the server action's schema is built from
 * (`lib/reports/categories.ts`), so a new category is one edit in one file and
 * cannot be added to one half only.
 *
 * The platform's `Sheet` at its near-full height, because a half sheet over a
 * listing photo is not the frame for telling us somebody asked you to send
 * money to a personal account. The sheet is a real dialog: Escape and Back
 * close it, it drags and flicks down to close, the body stops scrolling
 * behind it, and focus returns to the opener on the way out.
 */
export function ReportSheetPanel({
  targetType,
  targetId,
  targetLabel,
  signedIn,
  open,
  onClose,
}: {
  targetType: ReportTarget;
  targetId: string;
  /** What is being reported, in the heading, e.g. the listing title. */
  targetLabel: string;
  signedIn: boolean;
  /** Owned by the trigger (`ReportSheet`), which keeps this body mounted once
      it has been opened, so a filed report is still "we have it" on reopen. */
  open: boolean;
  /** Closes the sheet and hands focus back to the trigger. */
  onClose: () => void;
}) {
  const signInHref = useSignInHref();
  const noun = REPORT_TARGET_NOUN[targetType];
  const reportCopy = useClientCopy().trustVisible.report;
  const uid = useId();
  const [category, setCategory] = useState<ReportCategory | null>(null);

  const [state, formAction, pending] = useActionState<
    ActionResult<ReportReceipt> | null,
    FormData
  >(reportSomething, null);

  const close = onClose;

  /* A refusal is said by the one banner at the top of the screen (Grade 1),
     above this sheet; the phone step, when that is the reason, stays as its link. */
  useEffect(() => {
    if (state && !state.ok) banner.error(state.error);
  }, [state]);

  /*
   * THE SUCCESS SHEET, over the report sheet's own "we have it" panel, once
   * per filed report. `acknowledged` remembers the answer it was shown for,
   * so it opens on a NEW ok and not again on every render after it.
   * Continue closes both: somebody who has just reported something should
   * not have to dismiss two things to get back to what they were reading.
   */
  const success = useClientCopy().success;
  const [acknowledged, setAcknowledged] = useState<ActionResult<ReportReceipt> | null>(null);
  const filedWords = successCopy(success, "reportFiled", {
    promise: reportCopy.filed.replace("{clock}", responseTimeFor(category).phrase),
  });


  return (
    <>
      <SuccessSheet
        open={open && state?.ok === true && acknowledged !== state}
        onOpenChange={(next) => {
          if (!next) setAcknowledged(state);
        }}
        variant={filedWords.variant}
        object={filedWords.object}
        title={filedWords.title}
        body={filedWords.body}
        primary={{ label: success.continue, onClick: close }}
      />

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={`Report this ${noun}`}
        closeLabel="Close report"
        fullPage
      >
              <div data-testid="report-sheet" className="mx-auto grid max-w-2xl gap-md">
                <p className="truncate text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                  {targetLabel}
                </p>
                {state?.ok ? (
                  <div className={panelClass({ variant: "card", className: "block p-lg text-center" })} data-testid="report-filed">
                    <span className="grid size-[4.5rem] shrink-0 place-items-center mx-auto" aria-hidden="true" data-art="report-flag">
                      <Icon3D name="report-flag" size={72} />
                    </span>
                    <p className="mt-sm text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
                      Thank you, we have it
                    </p>
                    {/* V-63: the promise for THIS category, from the one table the
                        standards page prints and the console counts down, not a
                        single day's promise for every kind of report. */}
                    <p className="mx-auto mt-xs max-w-[42ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                      {reportCopy.filed.replace("{clock}", responseTimeFor(category).phrase)}
                    </p>
                    <Button variant="secondary" onClick={close} className="mt-md">
                      Back to the {noun}
                    </Button>
                  </div>
                ) : !signedIn ? (
                  <div className={panelClass({ variant: "card", className: "block p-lg text-center" })}>
                    <IconPlate size="lg" className="mx-auto">
                      <UiIcon name="shield-lock" size={24} />
                    </IconPlate>
                    <p className="mt-sm text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
                      Sign in to report this
                    </p>
                    <p className="mx-auto mt-xs max-w-[42ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                      A report belongs to somebody, which is what stops the queue filling
                      with noise and what lets us come back to you about it. The host is
                      never told who reported them.
                    </p>
                    <Link href={signInHref} className="nf-btn nf-btn--primary mt-md">
                      Sign in
                    </Link>
                  </div>
                ) : (
                  <form action={formAction} noValidate className="grid gap-md">
                    <input type="hidden" name="targetType" value={targetType} />
                    <input type="hidden" name="targetId" value={targetId} />

                    <fieldset className={panelClass({ variant: "card", className: "block p-md" })}>
                      <legend className="px-2xs text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]">
                        What happened?
                      </legend>
                      <div className="mt-xs grid gap-2xs">
                        {REPORT_CATEGORY_ORDER.map((code) => {
                          const copy = REPORT_CATEGORY_COPY[code];
                          const active = category === code;
                          return (
                            <label
                              key={code}
                              className={`flex cursor-pointer items-start gap-sm rounded-md border p-sm transition-colors ${
                                active
                                  ? "border-[var(--nf-brand-primary)] bg-[color-mix(in_oklab,var(--nf-brand-primary)_10%,transparent)]"
                                  : "border-[var(--nf-border-subtle)]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="category"
                                value={code}
                                checked={active}
                                onChange={() => setCategory(code)}
                                className="mt-2xs shrink-0 accent-[var(--nf-brand-primary)]"
                              />
                              <span className="min-w-0">
                                <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                                  {copy.label}
                                </span>
                                <span className="mt-3xs block text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                                  {copy.hint}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className={panelClass({ variant: "card", className: "block p-md" })}>
                      <label
                        htmlFor={`${uid}-details`}
                        className="text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]"
                      >
                        Anything else we should know
                      </label>
                      <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                        Optional, and it helps. Dates, amounts and account numbers are
                        exactly the detail that makes a report actionable.
                      </p>
                      <textarea autoCapitalize="sentences" enterKeyHint="enter"
                        id={`${uid}-details`}
                        name="details"
                        rows={4}
                        maxLength={DETAILS_MAX}
                        className="nf-field mt-xs resize-y"
                        placeholder="He asked me to transfer to a personal account before any inspection."
                      />
                    </div>

                    <PhoneGateLink show={isPhoneGate(state)} full className="mt-sm" />

                    <div className="grid gap-xs">
                      <Button
                        type="submit"
                        variant="primary"
                        full
                        disabled={pending || category === null}
                        className="disabled:opacity-60"
                      >
                        {pending ? "Sending your report..." : "Send report"}
                      </Button>
                      <Button variant="quiet" full onClick={close}>
                        Cancel
                      </Button>
                    </div>

                    {/* V-63: 112 as a number a frightened person can tap, not
                        "the emergency services" to look up. */}
                    <p className="text-center text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
                      {reportCopy.footer}{" "}
                      <a href="tel:112" className="font-semibold text-[var(--nf-content-primary)] underline underline-offset-2" data-testid="report-call-112">
                        {reportCopy.call}
                      </a>
                      .
                    </p>
                  </form>
                )}
              </div>
      </Sheet>
    </>
  );
}
