import { Skeleton } from "@/components/ui/Skeleton";
import { Panel } from "@/components/ui/Panel";

/**
 * THE PIECES A DESK'S LOADING FILE IS DRAWN FROM.
 *
 * Every desk now opens on the console's one header (`PageHead`, AD-01), so
 * its wait opens on the same head: the title bar and the blue sub-line, at the
 * sizes `.nf-admin-page-head` draws them. Under it each loading file lays out
 * its own desk's shape from the parts below (a tab row, a row of figures, a
 * panel with rows, a list of cards), so the content lands where the boxes
 * were and nothing shifts. Server-safe and data-free: these only draw boxes.
 */

/** The `PageHead` box: an optional round back control, the title, the sub-line, an optional control at the end. */
export function HeadSkeleton({
  title = "12rem",
  lede = true,
  back = false,
  trail = false,
  action = false,
}: {
  title?: string;
  lede?: boolean;
  back?: boolean;
  trail?: boolean;
  action?: boolean;
}) {
  return (
    <div className="nf-admin-page-head">
      <div className="min-w-0 flex-1">
        {back ? <Skeleton circle width="2.5rem" height="2.5rem" className="mb-xs" /> : null}
        <div className="flex flex-wrap items-center gap-sm">
          <Skeleton width={title} height="1.625rem" radius="sm" />
          {trail ? <Skeleton width="5.5rem" height="1.5rem" radius="sm" /> : null}
        </div>
        {lede ? <Skeleton className="mt-2xs" width="min(36rem, 90%)" height="0.8125rem" radius="sm" /> : null}
      </div>
      {action ? <Skeleton width="8rem" height="2.5rem" radius="md" /> : null}
    </div>
  );
}

/** A row of link tabs (`TabRow`, `.nf-admin-seg`). */
export function TabRowSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="flex flex-wrap gap-xs">
      {Array.from({ length: tabs }, (_, i) => (
        <Skeleton key={i} width="6rem" height="2.25rem" radius="pill" />
      ))}
    </div>
  );
}

/** The figure tiles (`ui.StatRow` of `ui.Stat`). */
export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-row sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-panel--card nf-admin-card p-card">
          <Skeleton width="7rem" height="0.75rem" radius="sm" />
          <Skeleton className="mt-inline-tight" width="4rem" height="1.75rem" radius="sm" />
        </div>
      ))}
    </div>
  );
}

/** The KPI cards (`KpiGrid`, `.nf-admin-kpis`). */
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="nf-admin-kpis">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-admin-kpi">
          <Skeleton width="2.75rem" height="2.75rem" radius="sm" />
          <div className="nf-admin-kpi__body">
            <Skeleton width="8rem" height="1rem" radius="sm" />
            <Skeleton width="6rem" height="2.125rem" radius="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A panel with its title and either rows of a list or table, or one block (a chart, a form). */
export function PanelSkeleton({
  rows = 0,
  block,
  rowHeight = "2.5rem",
  title = true,
}: {
  rows?: number;
  block?: string;
  rowHeight?: string;
  title?: boolean;
}) {
  return (
    <Panel as="div" className="nf-admin-panel">
      {title ? <Skeleton width="12rem" height="1.125rem" radius="sm" /> : null}
      {block ? <Skeleton className={title ? "mt-md" : undefined} width="100%" height={block} radius="sm" /> : null}
      {rows > 0 ? (
        <div className={`grid gap-xs${title || block ? " mt-md" : ""}`}>
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} width="100%" height={rowHeight} radius="sm" />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/** A list of cards, one per record (a request, an appeal, a check). */
export function CardListSkeleton({ count = 4, height = "5rem" }: { count?: number; height?: string }) {
  return (
    <div className="grid gap-sm">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width="100%" height={height} radius="lg" />
      ))}
    </div>
  );
}
