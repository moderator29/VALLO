import type { ReactNode } from "react";
import { DocCallout } from "@/components/docs/DocArticle";

/**
 * The few parts every position handbook shares, drawn only from the
 * documentation kit so a handbook reads exactly like the staff manual and the
 * member documents.
 */

/** The class every console link in a handbook's prose carries. */
export const A = "font-semibold text-[var(--nf-content-link)] underline underline-offset-2";

/**
 * A FACT ONLY THE FOUNDER CAN SUPPLY. Where the code and the documents name
 * nobody, a handbook says so plainly rather than guessing a name, a number or
 * a rota. The same pattern as the staff manual's `FounderToName`.
 */
export function FounderToName({ children }: { children: ReactNode }) {
  return (
    <DocCallout tone="warning" title="To be named by the founder">
      {children}
    </DocCallout>
  );
}

/**
 * HOW IT STANDS TODAY (the founder, 15 November 2026). Wherever a handbook
 * says a part of the product is switched off or not open to members, it says
 * in the same breath that this is today's position, that it is read against
 * the code often and changes, and that the live answer is on the screen
 * itself. No handbook names a date by which anything will open, because
 * nobody here can keep that appointment.
 */
export function TodayNote({ children }: { children: ReactNode }) {
  return (
    <DocCallout tone="note" title="How it stands today">
      <p>{children}</p>
      <p>
        That is where it stands today, 15 November 2026. This page is read against the console&apos;s own code often and
        what is open changes. The screen itself is the live answer, never this handbook: if the two disagree, believe the
        screen and tell the founder.
      </p>
    </DocCallout>
  );
}
