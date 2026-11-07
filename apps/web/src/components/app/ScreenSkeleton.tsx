import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { panelClass } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";

/**
 * The pieces every `loading.tsx` is assembled from.
 *
 * There was no `loading.tsx` anywhere on this platform, which means every
 * navigation into a dynamic route showed the PREVIOUS screen until the data
 * landed and then replaced it wholesale. On a slow Nigerian connection that
 * reads as a tap that did nothing, followed by a page that jumps. `.nf-skeleton`
 * had been fully written for this and used zero times.
 *
 * These exist so the route files stay short enough to actually mirror their
 * screens. A loading file that is expensive to write gets written as a spinner,
 * and a centred spinner is the thing being replaced: it tells the user only that
 * something is happening, and then moves everything when it finishes.
 *
 * The announcement lives here too, once. `aria-busy` plus a polite live region
 * is what turns a pile of grey boxes into "loading" for a screen reader, and it
 * is the single easiest thing to forget per route.
 */
export function LoadingShell({
  /** Announced politely while the screen waits. English until the key lands. */
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  /* V-97: the one loading state. The route keeps its own skeleton; the kit
     supplies the announcement, so every loading screen says it the same way. */
  return (
    <State kind="loading" title={label} {...(className ? { className } : {})}>
      {children}
    </State>
  );
}

/**
 * `PageHeader`'s geometry, without `PageHeader`.
 *
 * The real header is a client component with a router-driven back button, and a
 * loading fallback must not pull the router in to draw a placeholder. The boxes
 * are the same size as the real ones - 36/40px round control, `nf-h2` title,
 * `mb-5 sm:mb-6` - so the title lands where the bar already was.
 */
export function PageHeaderSkeleton({
  subtitle = false,
  layout = "inline",
  back = true,
}: {
  subtitle?: boolean;
  /** Mirrors `PageHeader`'s `layout`: the stacked twin puts the square on its
   *  own row and the title block, at `nf-h1` height, beneath it. `large` is
   *  `PageFrame`'s header (`PageHeader variant="large"`, chrome.css
   *  `.nf-ph-large`): the 44px round back, a 30/36 title, a 15/22 subtitle,
   *  and below it the header's own 1.25rem plus the frame's body gap, so the
   *  first body skeleton lands where the first real control will. */
  layout?: "inline" | "stacked" | "large";
  /** `large` only: root tabs draw no Back (SW16). */
  back?: boolean;
}) {
  if (layout === "large") {
    return (
      <div
        className="flex items-start gap-[0.75rem]"
        style={{ marginBlock: "0.5rem calc(1.25rem + var(--nf-space-lg))" }}
        data-testid="page-header-skeleton-large"
      >
        {back ? <Skeleton circle width="2.75rem" className="-mt-[0.25rem] shrink-0" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex h-[2.25rem] items-center">
            <Skeleton width="55%" height="1.875rem" radius="sm" />
          </div>
          {subtitle ? (
            <div className="mt-[0.25rem] flex h-[1.375rem] items-center">
              <Skeleton width="75%" height="0.9375rem" radius="sm" />
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  if (layout === "stacked") {
    return (
      <div className="mb-heading">
        <Skeleton glass width="2.75rem" height="2.75rem" radius="md" className="shrink-0" />
        <div className="mt-group">
          <Skeleton glass width="55%" height="2rem" radius="sm" />
          {subtitle ? <Skeleton glass className="mt-inline" width="80%" height="1rem" radius="sm" /> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-md flex items-center gap-md sm:mb-lg">
      <Skeleton circle width="2.25rem" className="shrink-0 sm:hidden" />
      <Skeleton circle width="2.5rem" className="hidden shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <Skeleton width="45%" height="1.375rem" radius="sm" />
        {subtitle ? <Skeleton className="mt-2xs" width="65%" height="0.8125rem" radius="sm" /> : null}
      </div>
    </div>
  );
}

/** The page title block used by the workspace screens: `nf-h1` plus a lede. */
export function TitleBlockSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton width="14rem" height="1.75rem" radius="sm" className="max-w-full" />
      <Skeleton className="mt-xs max-w-full" width="22rem" height="0.9375rem" radius="sm" />
    </div>
  );
}

/**
 * A stack of card rows, which is the shape of nearly every queue, ledger and
 * list on the platform. `rows` should match what the screen usually returns
 * rather than what it can return: the point is that the fold looks the same
 * before and after, and a list far longer than the viewport shifts nothing.
 */
export function CardRowsSkeleton({
  rows = 4,
  height = "5.5rem",
  className,
}: {
  rows?: number;
  height?: string;
  className?: string;
}) {
  return (
    <ul className={["space-y-sm", className ?? ""].filter(Boolean).join(" ")}>
      {Array.from({ length: rows }, (_, i) => (
        /* The shared panel card by name (SW-O1); `block` keeps the row's
           own flow, the padding utilities its own inset. */
        <li key={i} className={panelClass({ variant: "card", className: "block p-md sm:p-lg" })}>
          <div className="flex items-start gap-md">
            <Skeleton width="2.75rem" height="2.75rem" radius="md" className="shrink-0" />
            <div className="min-w-0 flex-1" style={{ minHeight: height }}>
              <Skeleton width="55%" height="0.9375rem" radius="sm" />
              <Skeleton className="mt-xs" width="80%" height="0.75rem" radius="sm" />
              <Skeleton className="mt-xs" width="35%" height="0.75rem" radius="sm" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * `PageHeader variant="large"` (spec 8.1), without `PageHeader`.
 *
 * Drawn from the real classes (`nf-ph-large`, its row and text block), so the
 * margins, the wrap and the 30/36 title line are the header's own and the
 * title lands where the bar already was. `actions` reserves the round 44px
 * buttons some large headers carry on the right.
 */
export function LargeHeaderSkeleton({
  subtitle = true,
  actions = 0,
}: {
  subtitle?: boolean;
  actions?: number;
}) {
  return (
    <div className="nf-ph-large" aria-hidden="true">
      <div className="nf-ph-large__row">
        <div className="nf-ph-large__text">
          <Skeleton width="11rem" height="2.25rem" radius="sm" className="max-w-full" />
          {subtitle ? <Skeleton className="mt-2xs" width="16rem" height="1.125rem" radius="sm" style={{ maxWidth: "85%" }} /> : null}
        </div>
        {actions > 0 ? (
          <div className="nf-ph-large__actions">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} circle width="2.75rem" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * `SummaryCard`, before its figure. The real card's own class draws the
 * frame (padding, border, radius, shadow), so only the label, the big figure,
 * the sentence and the status bar are slabs.
 */
export function SummaryCardSkeleton({ bar = true, className }: { bar?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={["nf-summary", className ?? ""].filter(Boolean).join(" ")}>
      <Skeleton width="9rem" height="0.875rem" radius="sm" />
      <Skeleton className="mt-2xs" width="5rem" height="2.5rem" radius="sm" />
      <Skeleton width="85%" height="0.875rem" radius="sm" />
      {bar ? <Skeleton className="mt-xs" height="0.5rem" radius="pill" /> : null}
    </div>
  );
}

/**
 * `ListGroup` with `ListRow`s: the section label above one card of rows,
 * each a round plate, a title and a sub line. Built from the list's own
 * classes, so the row height, the inset hairlines and the card are real.
 */
export function ListGroupSkeleton({
  rows = 3,
  label = true,
  className,
}: {
  rows?: number;
  label?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={["nf-list-section", className ?? ""].filter(Boolean).join(" ")}>
      {label ? (
        <div className="nf-list-section__head">
          <Skeleton width="6rem" height="0.75rem" radius="sm" />
        </div>
      ) : null}
      <ul className="nf-list-group">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="nf-list-item">
            <div className="nf-list-row nf-list-row--two">
              <span className="nf-list-row__lead">
                <Skeleton width="2.25rem" height="2.25rem" radius="md" />
              </span>
              <span className="nf-list-row__text">
                <Skeleton width="55%" height="0.9375rem" radius="sm" />
                <Skeleton width="80%" height="0.75rem" radius="sm" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A settings group (`SettingsGroup` and its rows), before it is read: the
 * quiet label outside the card, then rows at the real `nf-srow` height with
 * the small plate on the rail. `note` reserves the sentence under the card.
 */
export function SettingsGroupSkeleton({
  rows = 3,
  label = true,
  note = false,
  className,
}: {
  rows?: number;
  label?: boolean;
  note?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={["nf-sgroup", className ?? ""].filter(Boolean).join(" ")}>
      {label ? (
        <div className="nf-sgroup__label">
          <Skeleton width="7rem" height="0.75rem" radius="sm" />
        </div>
      ) : null}
      <div className="nf-sgroup__body nf-panel nf-panel--card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="nf-srow">
            <span className="nf-srow__icon">
              <Skeleton width="2.25rem" height="2.25rem" radius="md" />
            </span>
            <span className="nf-srow__body">
              <Skeleton width="50%" height="0.9375rem" radius="sm" />
              <Skeleton className="mt-2xs" width="72%" height="0.75rem" radius="sm" />
            </span>
          </div>
        ))}
      </div>
      {note ? (
        <div className="nf-sgroup__note">
          <Skeleton width="70%" height="0.75rem" radius="sm" />
        </div>
      ) : null}
    </div>
  );
}
