import { PageFrame } from "@/components/app/PageFrame";
import { AUDIT_WORDS } from "@/lib/assistant/permissions";
import type { AssistantState, AuditRow, LearnedPreference } from "@/lib/assistant/access";
import { dateTimeLabel } from "@/lib/format/when";
import { LearnedList, LegalLinks, MasterSwitch, PermissionRows } from "./AssistantControls";

/**
 * The screen itself, from what the page read. Exported so the preview
 * harness (`/preview/pages-frame?p=ai-assistant-on`) can draw the switched-on
 * state with sample rows; the page is its only real caller.
 */
export function AssistantSettingsBody({
  state,
  audit,
  learned,
}: {
  state: AssistantState;
  audit: readonly AuditRow[];
  learned: readonly LearnedPreference[];
}) {
  return (
    <PageFrame title="VALLO AI Assistant" subtitle="Your personal property assistant" fallback="/settings" width="narrow">
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
    </PageFrame>
  );
}
