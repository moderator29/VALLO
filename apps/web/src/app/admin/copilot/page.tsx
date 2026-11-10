import type { Metadata } from "next";
import { CopilotCapabilities } from "@/components/admin/copilot/CopilotCapabilities";
import { CopilotChat } from "@/components/admin/copilot/CopilotChat";
import { COPILOT_CAPABILITIES, starterPromptsFor } from "@/lib/admin/copilot/capabilities";
import { holdsAny } from "@/lib/admin/copilot/tools/common";
import { resolveCopilotViewer } from "@/lib/admin/copilot/viewer";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../_components/panels";

export const metadata: Metadata = { title: "Copilot", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE FULL-PAGE COPILOT. The same conversation as the desk sheets, with room
 * to work, every tool the person holds, a list of what it can do for them by
 * desk, and its limits stated plainly. The door is the console's own; the
 * route behind it resolves the person again and offers only their tools.
 */
export default async function AdminCopilotPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Copilot" lede="This page is for Vallo staff." />
      </div>
    );
  }
  const resolved = await resolveCopilotViewer();
  if (resolved.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead title="Copilot" lede="Read the staff handbook first. The copilot opens once you have acknowledged it." />
      </div>
    );
  }
  const { viewer } = resolved;
  const desks = COPILOT_CAPABILITIES.filter((desk) => desk.scopes.length === 0 || holdsAny(viewer, desk.scopes));
  const first = viewer.firstName === "there" ? "" : `, ${viewer.firstName}`;
  return (
    <div className="nf-console" data-testid="admin-copilot-page">
      <PageHead
        title="Copilot"
        lede="Ask about your desks, get a summary, or have something drafted. It reads what you can already see in the console. It suggests changes as cards, and nothing happens until you confirm."
      />
      <div className="nf-copilot-page">
        <CopilotChat
          scope={null}
          deskName="Console"
          greeting={`Hello${first}. Ask me what needs you first today, or pick a question below.`}
          starters={starterPromptsFor(viewer.scopes.length === 1 ? (viewer.scopes[0] ?? null) : null)}
          storageKey="vallo.copilot.v2.page"
          variant="page"
        />
        <CopilotCapabilities desks={desks} />
      </div>
    </div>
  );
}
