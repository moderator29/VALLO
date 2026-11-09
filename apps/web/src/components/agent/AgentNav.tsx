import Link from "next/link";
import type { AgentProfile } from "@/lib/agent/types";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { NoWorkspaceDoor } from "./agent-doors";

/**
 * Shared Agent Mode navigation pieces.
 *
 * The desktop rail and the mobile drawer must present the exact same ten
 * destinations with the exact same styling (Master Rule 17: one IA, one
 * chrome). Extracting the list, the mode pill and the identity card here means
 * neither surface can drift from the other. These components carry no hooks,
 * so they render on the server inside AgentRail and in the client bundle
 * inside the drawer without any boundary friction.
 */
/*
 * `buildAgentNav` and `AgentNavList` used to live here. They moved to
 * `agent-nav-model.ts` and `components/app/NavTree.tsx`, because the two modes
 * were rendering two navigations that looked like two products: this one drew
 * ten 26px 3D BrandIcons in a column, which is the content family doing a
 * navigation's job, and a flat list of ten in which "List a property" sat at
 * the same level as "Settings".
 *
 * What is left here is what is genuinely Agent Mode's own: the mode pill and
 * the identity card.
 */

/** The "Agent Mode" marker pill. Brand blue, like every other accent. */
export function AgentModePill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-xs rounded-xs px-sm py-2xs text-[length:var(--nf-text-overline)] font-bold",
        className ?? "",
      ].join(" ")}
      style={{
        background: "color-mix(in oklab, var(--nf-mode-agent) 20%, transparent)",
        /* The primary ink, not the accent mixed with white: that read on the
           night canvas and all but vanished on paper, and this pill now heads
           the rail and the drawer where the lockup used to be. */
        color: "var(--nf-content-primary)",
      }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--nf-mode-agent)]" />
      {label}
    </span>
  );
}

/**
 * Agent identity card: avatar initial, display name, verified marker.
 *
 * A null profile is a real state, not a missing one. It used to be filled from
 * a seed object called "Demo Agent", status APPROVED, verified true, so a
 * stranger opening an agent route was addressed as an approved verified agent
 * by name. The card now says what is true instead, and offers the way in.
 * Whoever sees a null profile is signed in with no listing workspace yet; the
 * door is `noWorkspaceDoor` (agent-doors.ts).
 */

export function AgentIdentityCard({
  profile,
  verifiedLabel,
  door,
}: {
  profile: AgentProfile | null;
  verifiedLabel: string;
  /** What the card says and where it leads when there is no agent profile. */
  door: NoWorkspaceDoor;
}) {
  if (!profile) {
    return (
      <div className="nf-panel nf-panel--card flex flex-row items-center gap-md p-sm">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--nf-border-subtle)] text-[var(--nf-content-muted)]"
          aria-hidden="true"
        >
          <UiIcon name="user" size={16} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          {/* A sentence, and it was ending mid-word in the rail. It wraps. */}
          <span className="block text-[length:var(--nf-text-body-sm)] font-semibold leading-snug text-[var(--nf-content-secondary)]">
            {door.label}
          </span>
          <Link
            href={door.href}
            /* A block as wide as its words, on one line. As an inline-block
               it measured a 32px box with "Apply / to list" broken over two
               lines: the theme's old `--spacing-block` key made `inline-block`
               also set inline-size (fixed in app/css/theme.css). The block
               needs no display trick either way. */
            className="nf-tap mt-3xs block w-fit whitespace-nowrap text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
          >
            {door.cta}
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="nf-panel nf-panel--card flex flex-row items-center gap-md p-sm">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[length:var(--nf-text-caption)] font-bold text-[var(--nf-content-on-brand)]"
        style={{ background: "var(--nf-gradient-agent)" }}
        aria-hidden="true"
      >
        {profile.displayName.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        {/* A NAME DOES NOT TRUNCATE. Nigerian names are frequently long and
            hyphenated, and this is the agent's own name in their own
            workspace: "Oluwaseun Adeyemi-Ogun..." is the product telling
            somebody it could not be bothered to fit them in. It wraps. */}
        <span className="block text-[length:var(--nf-text-body-sm)] font-semibold [overflow-wrap:anywhere]">
          {profile.displayName}
        </span>
        {profile.verified && (
          <span className="mt-3xs inline-flex items-center gap-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-state-success)]">
            <UiIcon name="verified" size={12} />
            {verifiedLabel}
          </span>
        )}
      </span>
    </div>
  );
}
