import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate, type IconPlateTone } from "@/components/ui/IconPlate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { RecipientPreview } from "@/lib/email/everyone-gets";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE ONE CONFIRM PANEL (plan item 22, spec section 15, references 35 and 37).
 *
 * Every consequential action confirms in the same anatomy:
 *
 *   [plate] Title: the action and the amount              [x]
 *           One line of context
 *   | LABEL      | LABEL        | LABEL       |   the summary strip
 *   Line item                           N280,000   itemised, from the record
 *   Total                               N360,000
 *   [check] Reassurance, success tint             only a product fact
 *   WHAT HAPPENS NEXT  [glyph] step, [glyph] step
 *   WHAT EVERYONE GETS  one card per recipient, the exact words sent
 *   Who is told                      [Cancel] [Primary]
 *
 * CONTENT ONLY. It renders inside the existing `Sheet` on a phone or the
 * existing dialog on a desk, and changes neither. It owns no action either:
 * the flow passes its own primary (the same button, the same server action
 * and the same validation it already had) and its own cancel, so wrapping a
 * flow in this panel cannot change what the flow does. Lines, totals and the
 * reassurance come from the caller, which takes them from the record's own
 * builders (`move-in-lines.ts`, `purchase-lines.ts`, `lib/money/copy.ts`),
 * never retyped here. "What everyone gets" takes `RecipientPreview` cards
 * from `lib/email/everyone-gets.ts`, built from the same senders as the real
 * email and push, so the preview cannot drift from what is sent.
 *
 * Server-safe: the caller's buttons carry any client behaviour.
 */
export type ConfirmFact = { label: string; value: ReactNode };
export type ConfirmLine = { label: ReactNode; amount: ReactNode };
export type ConfirmStep = { icon: UiIconName; text: ReactNode };

export function ConfirmPanel({
  icon,
  tone = "brand",
  title,
  context,
  close,
  summary,
  lines,
  total,
  reassurance,
  next,
  nextLabel = "What happens next",
  everyone,
  everyoneLabel = "What everyone gets",
  told,
  children,
  cancel,
  primary,
  error,
  className,
}: {
  icon: UiIconName;
  tone?: IconPlateTone;
  /** The action and, where there is one, the amount: "Accept Seyi's booking?". */
  title: ReactNode;
  context?: ReactNode;
  /** The corner close control, when the container does not draw its own. */
  close?: ReactNode;
  /** Up to three facts that identify what is being confirmed. */
  summary?: ConfirmFact[];
  lines?: ConfirmLine[];
  total?: ConfirmLine;
  /** A product fact from `lib/money/copy.ts` or the record. Never a promise. */
  reassurance?: ReactNode;
  next?: ConfirmStep[];
  nextLabel?: string;
  everyone?: RecipientPreview[];
  everyoneLabel?: string;
  /** "Tunde and Seyi are told at once." */
  told?: ReactNode;
  /** The flow's own fields (a reason, a note), kept exactly as they were. */
  children?: ReactNode;
  cancel?: ReactNode;
  /** The flow's own primary button: it repeats the action. */
  primary: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  const facts = (summary ?? []).slice(0, 3);
  return (
    <div className={["nf-confirm", className ?? ""].filter(Boolean).join(" ")} data-testid="confirm-panel">
      <div className="nf-confirm__head">
        <IconPlate size="sm" tone={tone}>
          <UiIcon name={icon} size={20} />
        </IconPlate>
        <div className="min-w-0 flex-1">
          <p className="nf-confirm__title">{title}</p>
          {context ? <p className="nf-confirm__context">{context}</p> : null}
        </div>
        {close}
      </div>

      {facts.length > 0 ? (
        <dl className="nf-confirm__strip" data-cells={facts.length}>
          {facts.map((fact) => (
            <div key={fact.label} className="nf-confirm__fact">
              <dt className="nf-section-label">{fact.label}</dt>
              <dd className="nf-confirm__value">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {(lines && lines.length > 0) || total ? (
        <div className="nf-confirm__lines">
          {(lines ?? []).map((line, index) => (
            <div key={index} className="nf-confirm__line">
              <span className="min-w-0">{line.label}</span>
              <span className="nf-numeric">{line.amount}</span>
            </div>
          ))}
          {total ? (
            <div className="nf-confirm__line nf-confirm__total">
              <span className="min-w-0">{total.label}</span>
              <span className="nf-numeric">{total.amount}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {reassurance ? (
        <p className="nf-confirm__assure">
          <UiIcon name="circle-check" size={16} className="shrink-0" />
          <span>{reassurance}</span>
        </p>
      ) : null}

      {/* The two section labels are h2: the panel's own title is a paragraph, and
          the container above it (a sheet, a dialog or a page) owns the h1 or the
          dialog's title, so an h3 here skipped a level (axe heading-order). */}
      {next && next.length > 0 ? (
        <section className="nf-confirm__section">
          <h2 className="nf-section-label">{nextLabel}</h2>
          <ol className="nf-confirm__steps">
            {next.map((step, index) => (
              <li key={index}>
                <UiIcon name={step.icon} size={16} className="nf-confirm__step-glyph" />
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {everyone && everyone.length > 0 ? (
        <section className="nf-confirm__section">
          <h2 className="nf-section-label">{everyoneLabel}</h2>
          <ul className="nf-confirm__people">
            {everyone.map((person, index) => (
              <li key={`${person.role}-${index}`} className="nf-confirm__person">
                <div className="nf-confirm__who">
                  <span className="nf-confirm__avatar" aria-hidden="true">
                    {(person.name ?? person.role).trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="nf-confirm__name">{person.name ?? person.role}</span>
                    {person.name ? <span className="nf-confirm__role">{person.role}</span> : null}
                  </span>
                  <StatusBadge tone="neutral">{person.channel}</StatusBadge>
                </div>
                {person.email ? (
                  <div className="nf-confirm__message">
                    <p className="nf-confirm__subject">{person.email.subject}</p>
                    <p className="nf-confirm__preheader">{person.email.preheader}</p>
                  </div>
                ) : null}
                {person.push ? (
                  <div className="nf-confirm__message">
                    <p className="nf-confirm__subject">{person.push.title}</p>
                    <p className="nf-confirm__preheader">{person.push.body}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children}

      {/* A refusal in words is said by the one banner at the top of the
          screen and kept here for a screen reader (founder, 7 November 2026,
          "THE BANNER EVERYWHERE"); anything richer keeps its line. */}
      {typeof error === "string" ? (
        <FieldProblem id="nf-confirm-problem" message={error} />
      ) : error ? (
        <p className="nf-confirm__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="nf-confirm__foot">
        {told ? <p className="nf-confirm__told">{told}</p> : <span />}
        <div className="nf-confirm__actions">
          {cancel}
          {primary}
        </div>
      </div>
    </div>
  );
}
