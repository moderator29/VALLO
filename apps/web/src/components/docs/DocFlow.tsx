import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import "@/app/css/docs-kit.css";

/**
 * THE FLOW (the founder's "high end" pass, 10 November 2026). A process a
 * member goes through, drawn as a numbered vertical stepper: a plate with the
 * step's glyph, the step's name, and the one line it ends with. Where the
 * step happens on a real screen the NAME is the link into it, never a
 * separate "click here". A flow that stops short of paying (rent, a sale)
 * says why in its `end` line, which a caller fills from `lib/money/copy.ts`.
 *
 * An ordered list, so a screen reader hears "list, 4 items" and each step in
 * order. Server-safe; it draws itself with no motion at all.
 */
export type DocFlowStep = {
  icon: UiIconName;
  title: string;
  /** What the member has once this step is done, in one line. */
  outcome: ReactNode;
  /** The real screen this step happens on, when there is one. */
  href?: string;
};

export function DocFlow({ label, steps, end }: { label: string; steps: DocFlowStep[]; end?: ReactNode }) {
  return (
    <figure className="nf-doc-flow">
      <figcaption className="nf-doc-flow__label">{label}</figcaption>
      <ol className="nf-doc-flow__list">
        {steps.map((step, i) => (
          <li key={step.title} className="nf-doc-flow__step">
            <span className="nf-doc-flow__mark">
              <IconPlate size="sm" tone="brand">
                <UiIcon name={step.icon} size={18} />
              </IconPlate>
            </span>
            <span className="nf-doc-flow__text">
              <span className="nf-doc-flow__title">
                <span className="nf-doc-flow__num">{i + 1}.</span>{" "}
                {step.href ? (
                  <Link href={step.href} className="nf-doc-flow__link">
                    {step.title}
                    <UiIcon name="chevron-right" size={14} />
                  </Link>
                ) : (
                  step.title
                )}
              </span>
              <span className="nf-doc-flow__outcome">{step.outcome}</span>
            </span>
          </li>
        ))}
      </ol>
      {end ? (
        <p className="nf-doc-flow__end">
          <UiIcon name="info" size={16} />
          <span>{end}</span>
        </p>
      ) : null}
    </figure>
  );
}
