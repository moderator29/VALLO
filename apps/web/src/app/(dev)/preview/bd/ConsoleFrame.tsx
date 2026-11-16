import type { ReactNode } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { AdminPreviewFrame } from "../f5/AdminPreviewFrame";

/**
 * The console frame around one of BD's desks. It drew its own copy of the
 * rail and the bar from the same pieces, and the copy drifted: on a phone it
 * put the menu on a second row under the bar, which no operator ever saw. It
 * is the REAL frame now (`AdminFrame`, through F5's `AdminPreviewFrame`), so
 * every desk preview that uses it shows the chrome the operators get. The
 * real `app/admin/layout.tsx` gates on `requireAdmin`, which this sandbox
 * cannot satisfy; the rows inside are fixtures. Never the proof of a write;
 * only the proof of the look.
 */
export function ConsoleFrame({ t, children }: { t: Dictionary; children: ReactNode }) {
  return (
    <AdminPreviewFrame t={t}>
      <div className="nf-console">{children}</div>
    </AdminPreviewFrame>
  );
}
