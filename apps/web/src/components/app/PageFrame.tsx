import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

/**
 * THE PAGE FRAME (Platform Grade 1, November 2026; docs/UX_SYSTEM.md, "Page
 * frame"). One top for every ordinary page, so no page re-invents its header:
 * the large bold title that folds into the shell header on scroll
 * (`PageHeader variant="large"`), an optional one-line subtitle, actions at the
 * right, an optional tab or segmented row directly under it, then the content
 * on the Grade 1 rhythm (`.nf-g1page`: the gutter, the title-to-first-control
 * gap, the section gap, the dock clearance at the foot).
 *
 * It wraps `PageHeader` rather than replacing it: the 103 pages already on
 * `PageHeader` keep working, and a page moves onto the frame during the
 * page sweep. Full-bleed screens (a listing hero, a map, a thread) do not use
 * it; long flows use `StepFrame`.
 */
export function PageFrame({
  title,
  subtitle,
  actions,
  fallback,
  back = true,
  tabs,
  width = "default",
  testId,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Where Back goes when the page has no declared parent. */
  fallback?: string;
  back?: boolean;
  /** A `Segmented` or tab row, drawn directly under the title. */
  tabs?: ReactNode;
  /** `narrow` for a form or a settings page, `wide` for a desk. */
  width?: "narrow" | "default" | "wide";
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="nf-g1page" data-width={width} data-testid={testId}>
      <PageHeader
        title={title}
        variant="large"
        back={back}
        {...(subtitle ? { subtitle } : {})}
        {...(actions ? { actions } : {})}
        {...(fallback ? { fallback } : {})}
      />
      {tabs ? <div className="nf-g1page__tabs">{tabs}</div> : null}
      <div className="nf-g1page__body">{children}</div>
    </div>
  );
}
