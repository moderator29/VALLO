import type { ReactNode } from "react";
import { DocCallout } from "@/components/docs/DocArticle";

/**
 * The few parts every chapter of the staff manual shares. Built only from the
 * documentation kit, so the manual reads exactly like the member documents.
 */

/** One numbered section of a chapter: the contents card and the heading read the same record. */
export type ManualSection = { id: string; title: string; body: ReactNode };

/** A chapter's words: the scope paragraph, the "at a glance" bullets and the sections. */
export type ManualBody = { intro: ReactNode; glance: ReactNode[]; sections: ManualSection[] };

/** The class every console link in the prose carries. */
export const A = "font-semibold text-[var(--nf-content-link)] underline underline-offset-2";

/**
 * WHERE A SCREENSHOT OF THE DESK GOES. Real signed-in screenshots come from
 * the capture run against the founder's accounts, which has not happened yet,
 * so the slot says so instead of showing a picture of something else. Never
 * a mock, never invented data.
 */
export function ScreenshotSlot({ desk }: { desk: string }) {
  return (
    <DocCallout tone="note" title="Screenshot slot">
      A screenshot of {desk} goes here once the signed-in capture run is done. Until then, open the desk itself to
      see it.
    </DocCallout>
  );
}

/**
 * A FACT ONLY THE FOUNDER CAN SUPPLY. Where the code and the documents name
 * nobody, the manual says so plainly rather than guessing a name, a number or
 * a rota.
 */
export function FounderToName({ children }: { children: ReactNode }) {
  return (
    <DocCallout tone="warning" title="To be named by the founder">
      {children}
    </DocCallout>
  );
}
