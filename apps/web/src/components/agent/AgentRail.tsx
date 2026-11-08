import type { Dictionary } from "@vallo/i18n/core";
import type { AgentProfile } from "@/lib/agent/types";
import { ModeSwitcher } from "./ModeSwitcher";
import { AgentIdentityCard } from "./AgentNav";
import { noWorkspaceDoor } from "./agent-doors";
import { buildAgentNav } from "./agent-nav-model";
import { DeskSidebar } from "@/components/app/desk/DeskSidebar";
import { forAgentNav } from "@/lib/i18n/slice";

/**
 * Agent Mode navigation rail (desktop, lg and up).
 *
 * Ten destinations, frozen (Master Rule 17): the same `buildAgentNav` model
 * the phone drawer (AgentMobileNav) draws, so the two surfaces cannot drift.
 *
 * Drawn by the shared workspace sidebar (plan item 20, spec 8.3): the desk
 * switcher at the head (the agent workspace and the agent's own name, where
 * the "Agent Mode" pill used to sit), the groups under section labels, the
 * current row marked with no container behind it, and the established foot:
 * the identity card and the switch back to Personal Mode.
 */
export function AgentRail({
  t,
  active,
  profile,
  unreadMessages = 0,
}: {
  t: Dictionary;
  active: string;
  /** The real agent behind this workspace, or null when nobody is. */
  profile: AgentProfile | null;
  /** Real unread count for the messages badge. Zero renders no badge. */
  unreadMessages?: number;
}) {
  return (
    <DeskSidebar
      label={t.agent.mode.workspaceLabel}
      switcher={{
        name: profile?.role === "owner" ? t.desk.sidebar.ownerDesk : t.desk.sidebar.agentDesk,
        icon: "building-apartment",
      }}
      sections={buildAgentNav(t, unreadMessages)}
      active={active}
      mainLabel={t.desk.sidebar.main}
      foot={
        <>
          <AgentIdentityCard
            profile={profile}
            verifiedLabel={profile?.role === "owner" ? t.agent.mode.verifiedOwner : t.agent.mode.verifiedAgent}
            door={noWorkspaceDoor(t.agent.mode)}
          />
          {/* This rail only renders inside Agent Mode, so the switch always
              offers Personal, independent of the cookie's current value. */}
          <ModeSwitcher t={forAgentNav(t)} current="working" variant="menu" />
        </>
      }
    />
  );
}
