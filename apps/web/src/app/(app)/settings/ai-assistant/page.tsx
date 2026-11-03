import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/PageHeader";
import { resolveSession } from "@/lib/actions/session";
import { AUDIT_WORDS } from "@/lib/assistant/permissions";
import { readAssistantState, readAuditRows, readLearnedPreferences } from "@/lib/assistant/access";
import { dateTimeLabel } from "@/lib/format/when";
import { LearnedList, LegalLinks, MasterSwitch, PermissionRows } from "./AssistantControls";
import "@/app/css/home.css";

export const metadata: Metadata = {
  title: "VALLO AI Assistant",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Settings, VALLO AI Assistant. Off for everybody until they turn it on
 * themselves through the agreement screen. Once on: what it may do (one switch
 * per permission, read and act kept apart), what it learned about you, and what
 * it did.
 */
export default async function AiAssistantSettingsPage() {
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect("/sign-in?next=/settings/ai-assistant");

  const state = await readAssistantState(session.supabase);
  const [audit, learned] = state.enabled
    ? await Promise.all([readAuditRows(session.supabase, 30), readLearnedPreferences(session.supabase)])
    : [[], []];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="VALLO AI Assistant" subtitle="Your personal property assistant" fallback="/settings" />

      <div className="space-y-block">
        <section className="nf-panel nf-panel--card p-card">
          <MasterSwitch enabled={state.enabled} />
          {!state.enabled ? (
            <p className="nf-ai-set__hint nf-ai-note">
              Turning it on opens the agreement. Until you do, the assistant has no access to your account, your bookings or your money.
            </p>
          ) : state.needsReaccept ? (
            <p className="nf-rv-msg" role="status">
              The terms were updated. Read them again in the links below; the assistant keeps working under the version you accepted.
            </p>
          ) : null}
        </section>

        {state.enabled ? (
          <>
            <section aria-labelledby="ai-perms-title" className="nf-panel nf-panel--card p-card">
              <h2 id="ai-perms-title" className="nf-ai-section">What it may do</h2>
              <PermissionRows granted={state.permissions} />
            </section>

            <section aria-labelledby="ai-learned-title" className="nf-panel nf-panel--card p-card">
              <h2 id="ai-learned-title" className="nf-ai-section">What it learned about you</h2>
              <LearnedList items={learned.map((l) => ({ key: l.key, weight: Number(l.weight) }))} />
            </section>

            <section aria-labelledby="ai-activity-title" className="nf-panel nf-panel--card p-card">
              <h2 id="ai-activity-title" className="nf-ai-section">Recent activity</h2>
              {audit.length === 0 ? (
                <p className="nf-ai-set__hint">Nothing yet.</p>
              ) : (
                <ul className="nf-ai-activity" data-testid="ai-activity">
                  {audit.map((row) => (
                    <li key={row.id} className="nf-ai-activity__row">
                      <span>
                        {AUDIT_WORDS[row.event] ?? row.event.replace(/_/g, " ")}
                        {row.permission ? `: ${row.permission.replace(/_/g, " ")}` : ""}
                        {row.tool ? ` (${row.tool.replace(/_/g, " ")})` : ""}
                        {row.outcome !== "ok" ? `, ${row.outcome}` : ""}
                      </span>
                      <span className="nf-ai-set__hint">{dateTimeLabel(row.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        <section className="nf-panel nf-panel--card p-card">
          <h2 className="nf-ai-section">The documents</h2>
          <LegalLinks />
        </section>
      </div>
    </div>
  );
}
