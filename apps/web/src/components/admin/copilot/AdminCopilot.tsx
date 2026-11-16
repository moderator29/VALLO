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
/** The copilot on the page that answers Ctrl or Cmd and J. */
let shortcutOwner: object | null = null;

export function AdminCopilot({
  scope,
  deskName,
  context,
  greeting,
  starters,
  launch = "float",
}: {
  /** The desk's scope; null on the console's front page, where it answers across every desk the person holds. */
  scope: StaffScope | null;
  /** Kept for the callers that already pass it; the server reads the real position. */
  position?: StaffPosition | null;
  deskName: string;
  context?: string | null;
  greeting?: string;
  /** Starter chips; the shared set for the scope when omitted. */
  starters?: readonly string[];
  /**
   * "float": the round button in the corner (every desk). "inline": a labelled
   * button that sits in the page's own header, opposite its title (the
   * console's front page, the founder, 16 November 2026: "the AI copilot
   * button opposite the Console overview text").
   */
  launch?: "float" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const launchRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  /* Ctrl or Cmd and J opens the copilot from any desk (16 November 2026).
     One copilot answers per page: the first one mounted claims the key. */
  useEffect(() => {
    if (shortcutOwner) return;
    const me = {};
    shortcutOwner = me;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (shortcutOwner === me) shortcutOwner = null;
    };
  }, []);

  useEffect(() => {
    /* Focus goes back to the button only after the sheet was open, never on the first paint. */
    if (!open && wasOpen.current) launchRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {launch === "inline" ? (
        <button ref={launchRef} type="button" className="nf-copilot-inline nf-tap" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="admin-copilot-launch">
          <span className="nf-copilot-inline__mark" aria-hidden="true">
            <UiIcon name="bot" size={18} weight="lean" />
          </span>
          <span className="nf-copilot-inline__words">
            <span className="nf-copilot-inline__lead">Ask the</span>
            <span className="nf-copilot-inline__main">AI copilot</span>
          </span>
        </button>
      ) : (
        <button ref={launchRef} type="button" className="nf-copilot-launch nf-tap" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="admin-copilot-launch">
          <UiIcon name="bot" size={22} weight="lean" />
          <span className="sr-only">Open the {deskName} assistant</span>
        </button>
      )}
      <Sheet open={open} onOpenChange={setOpen} title={`${deskName} assistant`} closeLabel="Close" testId="admin-copilot-sheet" fullPage sideOnWide>
        <CopilotChat scope={scope} deskName={deskName} context={context ?? null} {...(greeting ? { greeting } : {})} starters={starters ?? starterPromptsFor(scope)} storageKey={`vallo.copilot.v2.${scope ?? "console"}`} autoFocus onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
