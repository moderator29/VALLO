"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { safeRecordUrl } from "@/lib/admin/escalations/types";
import { EscalationForm } from "../escalations/EscalationForm";
import { NotSetUp } from "../escalations/parts";

/**
 * ESCALATE, ON EVERY ADMIN PAGE. Placed once, in the console shell (the
 * operator's bar and the staff frame), never per desk: wherever a member of
 * staff is when they meet something they cannot or may not decide, the way
 * to hand it up is in the same place.
 *
 * It opens the one sheet (`components/ui/Sheet`) with the escalation form in
 * it. The page it was opened on is read at that moment, path and query, and
 * travels as the attached record ("Attached: this page"), so nothing about a
 * member has to be typed. The overview has no record to attach.
 *
 * Before the SQL has run the sheet says "not set up yet" instead of offering
 * a form that cannot send.
 */
export const ESCALATE_COPY = {
  button: "Escalate",
  name: "Escalate something you cannot or may not decide",
  title: "Escalate",
  description: "For anything you cannot or may not decide. It goes to the people who can, with a response time.",
  close: "Close",
} as const;

export function EscalateButton({
  staffed,
  setUp = true,
  compact = false,
}: {
  /** Routes that have somebody on them; null when it could not be read. */
  staffed: readonly string[] | null;
  /** False until the escalations SQL has run. */
  setUp?: boolean;
  /** The operator's bar on a phone has room for the glyph only. */
  compact?: boolean;
}) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("/admin");

  /* The form is already the page there. */
  if (pathname === "/admin/escalations/new") return null;

  function show() {
    setSource(typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}`);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="nf-btn nf-btn--glass nf-btn--sm shrink-0"
        onClick={show}
        aria-haspopup="dialog"
        aria-label={ESCALATE_COPY.name}
        title={ESCALATE_COPY.name}
        data-testid="escalate-open"
      >
        <UiIcon name="flag" size={16} />
        <span className={compact ? "hidden sm:inline" : undefined}>{ESCALATE_COPY.button}</span>
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={ESCALATE_COPY.title}
        description={ESCALATE_COPY.description}
        closeLabel={ESCALATE_COPY.close}
        fullPage
        sideOnWide
        testId="escalate-sheet"
      >
        <div className="min-w-0">
          {setUp ? (
            <EscalationForm
              key={source}
              sourcePath={source}
              recordUrl={safeRecordUrl(source)}
              recordLabel={null}
              staffed={staffed}
              onDone={() => setOpen(false)}
            />
          ) : (
            <NotSetUp />
          )}
        </div>
      </Sheet>
    </>
  );
}
