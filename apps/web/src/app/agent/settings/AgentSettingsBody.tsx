import Link from "next/link";
import { countOf, type Dictionary } from "@vallo/i18n";
import type { AgentProfile } from "@/lib/agent/types";
import type { PayoutAccount } from "@/lib/agent/payout-queries";
import type { ResolvedProfileSettings } from "@/lib/profile/model";
import { groupNuban } from "@/lib/agent/payout-model";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PageFrame } from "@/components/app/PageFrame";
import { AccountNotificationsCard } from "../../(app)/settings/AccountToggles";
import { forAccountToggles } from "@/lib/i18n/slice";
import { AgentLookupCard } from "@/components/app/doors/AgentLookupCard";
import type { MyAgentLookup } from "@/lib/doors/queries";
import { AgentHoursCard, ReplyTemplatesCard } from "@/components/agent/AgentToolsCards";
import type { Schedule } from "@/lib/agent/hours";
import type { ReplyTemplate } from "@/lib/agent/reply-templates";

/**
 * The body of /agent/settings, apart from its reads.
 *
 * Separated so the whole screen can be rendered from fixtures in the preview
 * harness and read against the register at 390 dark. The route passes exactly
 * what it read; nothing here fetches anything.
 */
export function AgentSettingsBody({
  t,
  agent,
  accounts,
  notifications,
  lookup = null,
  templates = [],
  hours = {},
}: {
  t: Dictionary;
  agent: AgentProfile;
  accounts: PayoutAccount[];
  /** Null when the preference document could not be read. */
  notifications: ResolvedProfileSettings["notifications"] | null;
  /** V-61: the agent's code and number hint. Null draws no card, as before. */
  lookup?: MyAgentLookup | null;
  /** Saved replies and the hours the agent is usually reachable. */
  templates?: ReplyTemplate[];
  hours?: Schedule;
}) {
  const preferred = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

  return (
    /* The Grade 1 page frame: the large title with Back and its line. */
    <PageFrame
      title={t.agent.nav.settings}
      subtitle="What reaches you, where your money lands, and the name guests see."
      fallback="/agent/dashboard"
    >
      <div className="max-w-2xl space-y-md">
        {/* ------------------------------------------------ notifications */}
        {notifications ? (
          <AccountNotificationsCard t={forAccountToggles(t)} initial={notifications} variant="host" />
        ) : (
          <div className="nf-panel nf-panel--card block p-panel">
            <p className="nf-overline">Notifications</p>
            <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              We could not read your preferences just now. Nothing has changed, and
              you are still receiving everything you were receiving before.
            </p>
          </div>
        )}

        <ReplyTemplatesCard templates={templates} />
        <AgentHoursCard initial={hours} />

        {/* -------------------------------------------------------- payout */}
        <div className="nf-panel nf-panel--card block p-panel">
          <p className="nf-overline">Where your earnings go</p>
          {preferred ? (
            <>
              <p className="mt-sm flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                <UiIcon name="verified" size={16} className="shrink-0 text-[var(--nf-state-success)]" />
                {preferred.bankName}
              </p>
              <p className="nf-numeric mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                {groupNuban(preferred.accountNumber)}
              </p>
              <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                {preferred.accountName}
              </p>
              <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                {countOf(accounts.length, "payoutAccounts")}
              </p>
            </>
          ) : (
            <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              You have not told us where to send your earnings yet. Nothing can be
              paid out until you do, and it takes about a minute.
            </p>
          )}
          <Link href="/agent/earnings" className="nf-btn nf-btn--glass nf-btn--sm mt-md">
            {preferred ? "Manage payout accounts" : "Add a payout account"}
          </Link>
        </div>

        {/* ------------------------------------------------------ identity */}
        <div className="nf-panel nf-panel--card block p-panel">
          <p className="nf-overline">Your host identity</p>
          <p className="mt-sm flex flex-wrap items-center gap-x-xs gap-y-2xs text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
            {agent.displayName}
            {agent.verified && (
              <span className="nf-badge nf-badge--brand">
                <UiIcon name="verified" size={12} />
                Verified
              </span>
            )}
          </p>
          <dl className="mt-sm grid gap-xs border-t border-[var(--nf-border-subtle)] pt-sm text-[length:var(--nf-text-body-sm)]">
            <div className="flex items-center justify-between gap-sm">
              <dt className="text-[var(--nf-content-muted)]">Account type</dt>
              <dd className="text-[var(--nf-content-secondary)]">
                {agent.type === "business" ? "Business" : "Individual"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-sm">
              <dt className="text-[var(--nf-content-muted)]">Status</dt>
              {/*
                This printed the raw enum, so an agent read APPROVED in
                shouting capitals about their own account. `columnLabel` is the
                console's three-tier lookup and it is available here: the
                dictionary first, the staged English second, and a humanised
                value last, so this reads a real sentence whichever tier
                answers.
              */}
              <dd className="text-[var(--nf-content-secondary)]">
                {t.agent.standing[agent.status] ?? agent.status}
              </dd>
            </div>
          </dl>
          <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            This is the name Vallo checked and the name on every one of your
            listings, so it is not something to change on your own. Write to
            support and we will change it with you.
          </p>
          <Link href="/contact" className="nf-btn nf-btn--ghost nf-btn--sm mt-sm">
            Ask support to change it
          </Link>
        </div>

        {/* ------------------------------------------- V-61: let renters check */}
        {lookup && <AgentLookupCard copy={t.trustDoors.agentCard} code={lookup.code} hint={lookup.hint} />}

        {/* ------------------------------------------------------ the rest */}
        <div className="nf-panel nf-panel--card block p-panel">
          <p className="nf-overline">Everything else</p>
          <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
            Theme, language, privacy, security and account deletion are one account
            wide, so they live on your Vallo settings page rather than being kept
            in two places.
          </p>
          <Link href="/settings" className="nf-btn nf-btn--glass nf-btn--sm mt-md">
            Open account settings
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
