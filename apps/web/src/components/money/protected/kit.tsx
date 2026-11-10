import type { ReactNode } from "react";
import { formatMoney, type Locale } from "@vallo/i18n";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  PROTECTED_STAGE_LABEL,
  PROTECTED_STEP_LABEL,
  PROTECTED_TIMELINE_STOPPED,
  PROTECTED_TIMELINE_TITLE,
} from "@/lib/money/copy";
import {
  STAGE_IDENTITY,
  journeyTimeline,
  type JourneyStamps,
  type MilestoneKind,
  type ProtectedStage,
} from "@/lib/money/protected-journey";
import "./pp-screens.css";

/**
 * THE PROTECTED PAYMENT KIT (spec two, design system): the pieces every
 * screen of the protected rail is built from. Server-safe; the two pieces
 * that need the browser (copying, the live clock) are in their own files.
 */

export function money(minor: number, locale: Locale): string {
  return formatMoney(minor, locale, "NGN");
}

export function lagosTime(iso: string | null, locale: Locale): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const tag = locale === "en" ? "en-NG" : locale;
  return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(at);
}

/** The state, always in words and an icon (never colour alone). */
export function StagePill({ stage }: { stage: ProtectedStage }) {
  const identity = STAGE_IDENTITY[stage];
  return (
    <span className="nf-pp-pill" data-tone={identity.tone} data-testid="pp-stage">
      <UiIcon name={identity.icon} size={16} weight="lean" />
      {PROTECTED_STAGE_LABEL[stage]}
    </span>
  );
}

/** The amount, large, in tabular figures. */
export function AmountHero({ minor, locale, caption }: { minor: number; locale: Locale; caption?: string }) {
  return (
    <div className="nf-pp-amount">
      <p className="nf-pp-amount__figure" data-testid="pp-amount">
        {money(minor, locale)}
      </p>
      {caption ? <p className="nf-pp-amount__caption">{caption}</p> : null}
    </div>
  );
}

/** Label and value rows, as a description list. */
export function DetailRows({ rows, sunken = false }: { rows: { label: string; value: ReactNode; strong?: boolean }[]; sunken?: boolean }) {
  return (
    <dl className="nf-pp-rows" data-sunken={sunken || undefined}>
      {rows.map((row) => (
        <div key={row.label} className="nf-pp-row" data-strong={row.strong || undefined}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The deal, so the payer always knows WHICH payment this is. */
export function PlaceCard({ place, amount }: { place: { title: string; area: string; photo?: string | null }; amount?: string }) {
  return (
    <div className="nf-pp-place">
      {place.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="nf-pp-place__photo" src={place.photo} alt="" width={56} height={56} />
      ) : (
        <span className="nf-pp-place__photo nf-pp-place__photo--empty" aria-hidden="true">
          <UiIcon name="home" size={22} weight="lean" />
        </span>
      )}
      <span className="nf-pp-place__text">
        <span className="nf-pp-place__title">{place.title}</span>
        <span className="nf-pp-place__area">
          <UiIcon name="location" size={14} weight="lean" />
          {place.area}
        </span>
      </span>
      {amount ? <span className="nf-pp-place__amount">{amount}</span> : null}
    </div>
  );
}

/** A card with a plate icon, a title and a body: the custody and release explainers. */
export function InfoCard({ icon, title, children, testId }: { icon: "bank" | "clock" | "shield-check" | "scale" | "info"; title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="nf-pp-info" data-testid={testId}>
      <span className="nf-pp-info__plate" aria-hidden="true">
        <UiIcon name={icon} size={20} weight="lean" />
      </span>
      <div className="nf-pp-info__text">
        <h2 className="nf-pp-info__title">{title}</h2>
        <div className="nf-pp-info__body">{children}</div>
      </div>
    </section>
  );
}

/**
 * The persistent timeline (spec screen 11): transfer, held, milestone,
 * release. Driven only by the recorded state and the provider's stamps.
 */
export function TimelineSpine({
  stage,
  stamps,
  milestone,
  locale,
  title = PROTECTED_TIMELINE_TITLE,
}: {
  stage: ProtectedStage;
  stamps: JourneyStamps;
  milestone: MilestoneKind;
  locale: Locale;
  title?: string;
}) {
  const steps = journeyTimeline(stage, stamps);
  const label = (key: (typeof steps)[number]["key"]) =>
    key === "milestone" ? PROTECTED_STEP_LABEL.milestone[milestone] : PROTECTED_STEP_LABEL[key];
  return (
    <section className="nf-pp-timeline" aria-labelledby="pp-timeline-title" data-testid="pp-timeline">
      <h2 id="pp-timeline-title" className="nf-pp-overline">
        {title}
      </h2>
      <ol>
        {steps.map((step) => (
          <li key={step.key} className="nf-pp-step" data-state={step.state}>
            <span className="nf-pp-step__dot" aria-hidden="true">
              {step.state === "done" ? <UiIcon name="check" size={14} /> : null}
              {step.state === "stopped" ? <UiIcon name="minus" size={14} /> : null}
            </span>
            <span className="nf-pp-step__text">
              <span className="nf-pp-step__label">{label(step.key)}</span>
              {step.state === "stopped" ? <span className="nf-pp-step__at">{PROTECTED_TIMELINE_STOPPED}</span> : null}
              {step.state === "done" && step.at ? <span className="nf-pp-step__at">{lagosTime(step.at, locale)}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The screen's head: an overline, the state, a title and an optional line. */
export function ScreenHead({ eyebrow, stage, title, lead }: { eyebrow?: string; stage?: ProtectedStage; title: string; lead?: ReactNode }) {
  return (
    <header className="nf-pp-head">
      {eyebrow ? <p className="nf-pp-overline">{eyebrow}</p> : null}
      {stage ? <StagePill stage={stage} /> : null}
      <h1 className="nf-pp-title">{title}</h1>
      {lead ? <div className="nf-pp-lead">{lead}</div> : null}
    </header>
  );
}
