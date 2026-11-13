import Link from "next/link";
import type { ReactNode } from "react";

import { deskRefusal } from "@/lib/admin/desk-refusal";

import { PageHead, Panel } from "./panels";

/**
 * SMALL PARTS THE STAFF DESKS SHARE (marketing, content, technical, support
 * lead; 10 November 2026). Server-safe: no hook, no client import. Built on the
 * console's own panels, badges and the stacking data table so the four desks
 * read like every other desk, on a phone first.
 */

/** The standard refusal page: the same four states every desk answers with. */
export function DeskRefused({ title, state, who }: { title: string; state: "unconfigured" | "signed-out" | "not-admin" | "step-up"; who: string }) {
  return (
    <div className="nf-console nf-admin-stack">
      <PageHead title={title} />
      <Panel>
        <p className="nf-body text-[var(--nf-content-secondary)]">{state === "not-admin" ? who : deskRefusal(state)}</p>
      </Panel>
    </div>
  );
}

export type DeskColumn = { key: string; label: string; numeric?: boolean };
export type DeskRow = { key: string; cells: Record<string, ReactNode> };

/** A real table that scrolls inside its panel on a desktop and stacks into labelled rows on a phone. */
export function DeskTable({ caption, columns, rows }: { caption: string; columns: readonly DeskColumn[]; rows: readonly DeskRow[] }) {
  return (
    <div className="nf-admin-dt-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="nf-admin-dt nf-admin-dt--stack">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "text-right" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((c, i) =>
                i === 0 ? (
                  <th key={c.key} scope="row">
                    {row.cells[c.key]}
                  </th>
                ) : (
                  <td key={c.key} data-label={c.label} className={c.numeric ? "text-right tabular-nums" : undefined}>
                    {row.cells[c.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A link to another desk, in the console's link ink. */
export function DeskLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
      {children}
    </Link>
  );
}

/** A short line under a panel saying where a figure comes from. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="nf-caption mt-sm text-[var(--nf-content-secondary)]">{children}</p>;
}

/** A labelled definition row inside a card: caption above, value below. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3xs">
      <dt className="nf-caption text-[var(--nf-content-secondary)]">{label}</dt>
      <dd className="nf-body-sm break-words">{children}</dd>
    </div>
  );
}

/** A plain date for the screen: 12 Nov 2026. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

/** A date and time for the screen, Lagos time: 12 Nov 2026, 14:05. */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
}
