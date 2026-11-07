"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";

/**
 * THE STEP FRAME (Platform Grade 1, November 2026; docs/UX_SYSTEM.md, "Step
 * frame"). ONE QUESTION PER SCREEN, the shape every long flow on Vallo now
 * shares: the listing wizard, identity verification, the host and owner
 * registrations, and any future long form. Built once so they stop feeling
 * like four different products (AUDIT_2026-11.md section 4: five stepper
 * components and every wizard its own).
 *
 *   top bar     back (round), the save state in the middle ("Saved" with a
 *               tick, "Saving", "Saved on this device"), close (round)
 *   progress    a thin bar under the top bar, step / total
 *   head        an eyebrow (small uppercase accent label), the title, one
 *               line of subtitle
 *   content     the one question, sliding in from the side it came from
 *   bottom bar  "Step N of M" and the primary (Continue), sticky, above the
 *               home indicator and the keyboard (`--nf-keyboard-inset`)
 *
 * It owns no data and no navigation: the flow decides what Back, Close and
 * Continue do. The save state is whatever the flow can TRULY say: "Saved"
 * only after the server answered, "Saved on this device" while offline. The
 * words default to English and every one can be passed in.
 */

export type StepSaveState = "idle" | "saving" | "saved" | "device" | "error";

export type StepAction = {
  label: string;
  onClick?: () => void;
  /** "submit" with `form` submits that form; the default is a plain button. */
  type?: "button" | "submit";
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
};

const SAVE_WORDS: Record<Exclude<StepSaveState, "idle">, string> = {
  saving: "Saving",
  saved: "Saved",
  device: "Saved on this device",
  error: "Not saved yet",
};

export function StepFrame({
  step,
  total,
  eyebrow,
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  closeHref,
  onClose,
  closeLabel = "Close",
  save = "idle",
  saveWords,
  stepLabel,
  primary,
  secondary,
  direction = "forward",
  notice,
  testId,
  children,
}: {
  /** 1-based. */
  step: number;
  total: number;
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  /** Back one step. Omitted on the first step, where there is nowhere back to go inside the flow. */
  onBack?: () => void;
  backLabel?: string;
  /** Leave the flow: a link, or a handler when the flow must ask first. */
  closeHref?: string;
  onClose?: () => void;
  closeLabel?: string;
  save?: StepSaveState;
  saveWords?: Partial<Record<Exclude<StepSaveState, "idle">, string>>;
  /** "Step 3 of 12" in the reader's language. Defaults to English. */
  stepLabel?: string;
  primary: StepAction;
  /** A quiet second action beside the primary, such as "Skip for now". */
  secondary?: StepAction;
  /** Which way the content slides in: from the right going forward, from the left going back. */
  direction?: "forward" | "back";
  /** A banner inside the frame above the content: "1 thing to fix". */
  notice?: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  const clamped = Math.min(Math.max(step, 1), Math.max(total, 1));
  const percent = Math.round((clamped / Math.max(total, 1)) * 100);
  const words = { ...SAVE_WORDS, ...saveWords };
  const saveText = save === "idle" ? null : words[save];

  return (
    <div className="nf-step" data-testid={testId}>
      <header className="nf-step__top">
        <div className="nf-step__bar">
          {onBack ? (
            <button type="button" className="nf-step__round" aria-label={backLabel} onClick={onBack}>
              <UiIcon name="arrow-left" size={20} />
            </button>
          ) : (
            <span className="nf-step__round nf-step__round--empty" aria-hidden="true" />
          )}
          <p className="nf-step__save" data-save={save} aria-live="polite">
            {saveText ? (
              <>
                {save === "saved" || save === "device" ? (
                  <span className="nf-step__save-mark" aria-hidden="true">
                    <UiIcon name="check" size={12} />
                  </span>
                ) : null}
                {saveText}
              </>
            ) : null}
          </p>
          {closeHref ? (
            <Link href={closeHref} className="nf-step__round" aria-label={closeLabel}>
              <UiIcon name="close" size={20} />
            </Link>
          ) : onClose ? (
            <button type="button" className="nf-step__round" aria-label={closeLabel} onClick={onClose}>
              <UiIcon name="close" size={20} />
            </button>
          ) : (
            <span className="nf-step__round nf-step__round--empty" aria-hidden="true" />
          )}
        </div>
        <div
          className="nf-step__progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={clamped}
          aria-label={stepLabel ?? `Step ${clamped} of ${total}`}
        >
          <span className="nf-step__progress-fill" style={{ inlineSize: `${percent}%` }} />
        </div>
      </header>

      <div className="nf-step__main">
        {/* Keyed by step, so each question arrives with the slide. */}
        <div key={clamped} className="nf-step__page" data-direction={direction}>
          {eyebrow ? <p className="nf-step__eyebrow">{eyebrow}</p> : null}
          <h1 className="nf-step__title">{title}</h1>
          {subtitle ? <div className="nf-step__subtitle">{subtitle}</div> : null}
          {notice ? <div className="nf-step__notice">{notice}</div> : null}
          <div className="nf-step__content">{children}</div>
        </div>
      </div>

      <footer className="nf-step__foot">
        <p className="nf-step__count">{stepLabel ?? `Step ${clamped} of ${total}`}</p>
        <div className="nf-step__actions">
          {secondary ? (
            <Button
              variant="quiet"
              size="lg"
              type={secondary.type ?? "button"}
              form={secondary.form}
              disabled={secondary.disabled}
              onClick={secondary.onClick}
              data-testid={secondary.testId}
            >
              {secondary.label}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            type={primary.type ?? "button"}
            form={primary.form}
            disabled={primary.disabled}
            loading={primary.loading}
            onClick={primary.onClick}
            data-testid={primary.testId ?? "step-continue"}
          >
            {primary.label}
          </Button>
        </div>
      </footer>
    </div>
  );
}
