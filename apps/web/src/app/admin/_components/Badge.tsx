import type { ReactNode } from "react";

/*
 * The console's status badge, on its own so a client component can take it
 * without `panels.tsx`, which reads the whole dictionary.
 */
export type BadgeTone = "success" | "pending" | "error" | "info";

/** A status badge: a rounded rectangle carrying its word, per the shape law. */
export function Badge({ tone, solid = false, children }: { tone: BadgeTone; solid?: boolean; children: ReactNode }) {
  return <span className={`nf-admin-badge nf-admin-badge--${tone}${solid ? " nf-admin-badge--solid" : ""}`}>{children}</span>;
}
