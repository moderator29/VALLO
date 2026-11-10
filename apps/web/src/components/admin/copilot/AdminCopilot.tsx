"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { StaffPosition } from "@/lib/admin/staff-positions";
import type { StaffScope } from "@/lib/admin/guard";
import { starterPromptsFor } from "@/lib/admin/copilot/capabilities";
import { CopilotChat } from "./CopilotChat";
import "./admin-copilot.css";

/**
 * THE ADMIN COPILOT, on every desk. One floating button, one sheet, the same
 * engine behind every desk (`/api/admin/copilot`). The route re-checks access
 * itself and resolves the position from the database; this component sends
 * only the desk it is on and the figures the page already read, never a claim
 * about who the person is. The conversation is the shared `CopilotChat`, so
 * the sheet and the full page behave the same.
 */
export function AdminCopilot({
  scope,
  deskName,
  context,
  greeting,
  starters,
}: {
  scope: StaffScope;
  /** Kept for the callers that already pass it; the server reads the real position. */
  position?: StaffPosition | null;
  deskName: string;
  context?: string | null;
  greeting?: string;
  /** Starter chips; the shared set for the scope when omitted. */
  starters?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const launch = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) launch.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <>
      <button ref={launch} type="button" className="nf-copilot-launch nf-tap" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="admin-copilot-launch">
        <UiIcon name="bot" size={22} weight="lean" />
        <span className="sr-only">Open the {deskName} assistant</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={`${deskName} assistant`} closeLabel="Close" testId="admin-copilot-sheet" fullPage sideOnWide>
        <CopilotChat scope={scope} deskName={deskName} context={context ?? null} {...(greeting ? { greeting } : {})} starters={starters ?? starterPromptsFor(scope)} storageKey={`vallo.copilot.v2.${scope}`} autoFocus onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
