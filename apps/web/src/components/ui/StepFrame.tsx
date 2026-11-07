"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useOverlay } from "@/lib/ui/use-overlay";
import { useClientMount } from "@/lib/ui/client-mount";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { NATIVE_BACK_EVENT } from "@/lib/native/native-back-event";

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
 *               home indicator, and on the keys when the keyboard is up
 *               (the web view shrinks to the space above it, N3)
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

/* The overlay's geometry, inline as well as in grade1.css, so the frame still
   covers the screen and scrolls if a stylesheet has not arrived (a weak
   connection) while the page behind it is locked. */
const OVERLAY_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: "var(--nf-z-modal)",
  overflowY: "auto",
} as const;

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
  art,
  overlay = false,
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
  /**
   * The step's Continue. Omitted when the step's own control lives in the
   * content (a money step whose confirm is DragToConfirm: a second lit button
   * in the foot would duplicate or bypass that deliberate gate); the foot then
   * draws only "Step N of M" and `secondary` if given.
   */
  primary?: StepAction;
  /** A quiet second action beside the primary, such as "Skip for now". */
  secondary?: StepAction;
  /** Which way the content slides in: from the right going forward, from the left going back. */
  direction?: "forward" | "back";
  /** A banner inside the frame above the content: "1 thing to fix". */
  notice?: ReactNode;
  /** Vallo's own object for the step (a 3D clay object), above the eyebrow. */
  art?: ReactNode;
  /**
   * A full screen over the app (portalled to the body, the page behind locked,
   * Escape and Android Back close it through `onClose`), for a flow that
   * opens from a page rather than owning a route: verification, the wizard.
   */
  overlay?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const clamped = Math.min(Math.max(step, 1), Math.max(total, 1));
  const percent = Math.round((clamped / Math.max(total, 1)) * 100);
  const words = { ...SAVE_WORDS, ...saveWords };
  const saveText = save === "idle" ? null : words[save];
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mounted = useClientMount();
  /* Focus goes to the frame itself, not its first control, so the close X
     is not drawn focused the moment the screen opens; Tab still starts there. */
  useOverlay({ open: overlay, onClose: () => onClose?.(), panelRef, autoFocus: false });
  useEffect(() => {
    if (overlay && mounted) panelRef.current?.focus({ preventScroll: true });
  }, [overlay, mounted]);
  /* Android Back (N4): one step back, not out of the whole flow. On the
     first step there is no Back, so the press falls through to Close. */
  const backRef = useRef(onBack);
  useEffect(() => {
    backRef.current = onBack;
  }, [onBack]);
  useEffect(() => {
    if (!overlay) return;
    const claim = (event: Event) => {
      if (!backRef.current) return;
      event.preventDefault();
      backRef.current();
    };
    document.addEventListener(NATIVE_BACK_EVENT, claim);
    return () => document.removeEventListener(NATIVE_BACK_EVENT, claim);
  }, [overlay]);

  const frame = (
    <div
      ref={panelRef}
      className={overlay ? "nf-g1step nf-g1step--overlay" : "nf-g1step"}
      data-testid={testId}
      {...(overlay ? { role: "dialog", "aria-modal": true, "aria-label": title, tabIndex: -1, style: OVERLAY_STYLE } : {})}
    >
      <header className="nf-g1step__top">
        <div className="nf-g1step__bar">
          {onBack ? (
            <button type="button" className="nf-g1step__round" aria-label={backLabel} onClick={onBack}>
              <UiIcon name="arrow-left" size={20} />
            </button>
          ) : (
            <span className="nf-g1step__round nf-g1step__round--empty" aria-hidden="true" />
          )}
          <p className="nf-g1step__save" data-save={save} aria-live="polite">
            {saveText ? (
              <>
                {save === "saved" || save === "device" ? (
                  <span className="nf-g1step__save-mark" aria-hidden="true">
                    <UiIcon name="check" size={12} />
                  </span>
                ) : null}
                {saveText}
              </>
            ) : null}
          </p>
          {closeHref ? (
            <Link href={closeHref} className="nf-g1step__round" aria-label={closeLabel}>
              <UiIcon name="close" size={20} />
            </Link>
          ) : onClose ? (
            <button type="button" className="nf-g1step__round" aria-label={closeLabel} onClick={onClose}>
              <UiIcon name="close" size={20} />
            </button>
          ) : (
            <span className="nf-g1step__round nf-g1step__round--empty" aria-hidden="true" />
          )}
        </div>
        <div
          className="nf-g1step__progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={clamped}
          aria-label={stepLabel ?? `Step ${clamped} of ${total}`}
        >
          <span className="nf-g1step__progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      </header>

      <div className="nf-g1step__main">
        {/* Keyed by step, so each question arrives with the slide. */}
        <div key={clamped} className="nf-g1step__page" data-direction={direction}>
          {art ? <div className="nf-g1step__art">{art}</div> : null}
          {eyebrow ? <p className="nf-g1step__eyebrow">{eyebrow}</p> : null}
          <h1 className="nf-g1step__title">{title}</h1>
          {subtitle ? <div className="nf-g1step__subtitle">{subtitle}</div> : null}
          {notice ? <div className="nf-g1step__notice">{notice}</div> : null}
          <div className="nf-g1step__content">{children}</div>
        </div>
      </div>

      <footer className="nf-g1step__foot">
        <p className="nf-g1step__count">{stepLabel ?? `Step ${clamped} of ${total}`}</p>
        <div className="nf-g1step__actions">
          {secondary ? (
            <Button
              variant="quiet"
              size="md"
              type={secondary.type ?? "button"}
              form={secondary.form}
              disabled={secondary.disabled}
              onClick={secondary.onClick}
              data-testid={secondary.testId}
            >
              {secondary.label}
            </Button>
          ) : null}
          {primary ? (
            <Button
              variant="primary"
              size="md"
              type={primary.type ?? "button"}
              form={primary.form}
              disabled={primary.disabled}
              loading={primary.loading}
              onClick={primary.onClick}
              data-testid={primary.testId ?? "step-continue"}
            >
              {primary.label}
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  );
  if (!overlay) return frame;
  return mounted ? createPortal(frame, document.body) : null;
}
