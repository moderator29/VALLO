import type { AlertView } from "@/lib/admin/queries";
import { AlertResolve } from "../_components/AdminActions";
import { ConsiderStr } from "../_components/ConsiderStr";
import { fill, type AdminCommon, type AdminCopy } from "../_components/copy";
import type { AdminUi } from "../_components/ui";
import type { QueueStatusOption } from "../_components/QueueFilters";
import { Constants } from "@/lib/supabase/database.types";
/* `Tone` moved out of the admin console and into the shared StatusPill when
   the four copies of it were collapsed into one. Same type, one home. */
import type { StatusTone } from "@/components/ui/StatusPill";
import { gradeForSeverity } from "@/lib/trust/standards";
import { dueChip } from "../_components/due";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { AlertAcknowledge } from "./AlertAcknowledge";
import { ACK_COPY } from "./ack-copy";

/**
 * The alerts desk's cards, out of the page so the preview harness draws the
 * same card the desk draws.
 */

export const SEVERITY_TONE: Record<AlertView["severity"], StatusTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

/** `alert_status` is `open, resolved`, read from the generated enum. */
export function alertStatusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return Constants.public.Enums.alert_status.map((value) => ({
    value,
    label: ui.statusLabel(value),
  }));
}

/**
 * A risk alert: a case that outlives a single flag.
 *
 * An alert stays open until somebody says what was done about it, which is
 * why resolving asks for a note. An open row carries the clock /standards
 * publishes, computed from the same module, and a resolved one says who
 * resolved it, because "resolved" with nobody against it is how
 * accountability quietly disappears.
 */
export function AlertCard({
  alert,
  copy,
  common,
  ui,
}: {
  alert: AlertView;
  copy: AdminCopy["alerts"];
  common: AdminCommon;
  ui: AdminUi;
}) {
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip status={alert.status} />
        <ui.StatusChip
          label={fill(copy.severityChip, { level: copy.severity[alert.severity] })}
          tone={SEVERITY_TONE[alert.severity]}
        />
        {alert.status === "open" && (
          <ui.StatusChip
            {...dueChip(alert.createdAt, gradeForSeverity(alert.severity), common)}
          />
        )}
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {ui.when(alert.createdAt)}
        </span>
      </div>

      {/* The row's plated glyph, as the render shows one per row. A risk
          alert is the warning mark, in the warning tone. */}
      <h3 className="mt-xs flex items-center gap-inline text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
        <IconPlate size="sm" tone="warning">
          <UiIcon name="alert-triangle" size={20} />
        </IconPlate>
        <span className="min-w-0">{alert.title}</span>
      </h3>
      {alert.description && (
        <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {alert.description}
        </p>
      )}

      {alert.entityType && (
        <p className="mt-xs break-words text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {fill(copy.attachedTo, { type: alert.entityType, id: alert.entityId ?? "" }).trim()}
        </p>
      )}

      {/* SCUML item 6: open an STR case from this alert. */}
      <ConsiderStr from="risk_alert" id={alert.id} />

      {alert.status === "open" ? (
        <>
          <AlertAcknowledgement alert={alert} ui={ui} />
          <AlertResolve alertId={alert.id} copy={copy} common={common} />
        </>
      ) : (
        <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {fill(copy.resolvedWhen, { when: ui.when(alert.resolvedAt) })}{" "}
          {fill(common.resolvedBy, { who: alert.resolvedByName ?? common.someone })}.{" "}
          {common.noteInAuditLog}
        </p>
      )}
    </li>
  );
}

/**
 * C13: WHO HAS THIS ALERT. An acknowledged alert names the person and the
 * time; an open one nobody has taken offers "I have this". Nothing is drawn
 * when the desk cannot store an acknowledgement yet (the pending migration),
 * so the button never promises what the database would refuse.
 */
export function AlertAcknowledgement({ alert, ui }: { alert: AlertView; ui: AdminUi }) {
  if (!alert.acknowledgementsAvailable) return null;
  if (alert.acknowledgedAt) {
    const when = ui.when(alert.acknowledgedAt);
    return (
      <p className="mt-sm flex items-start gap-inline text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
        <UiIcon name="user-check" size={16} />
        <span className="min-w-0">
          {alert.acknowledgedByName
            ? fill(ACK_COPY.by, { who: alert.acknowledgedByName, when })
            : fill(ACK_COPY.byUnknown, { when })}
        </span>
      </p>
    );
  }
  return <AlertAcknowledge alertId={alert.id} />;
}

/**
 * One inventory drift finding from the nightly sweep.
 *
 * Both ids, unclipped: the alert's own, which the audit line carries, and the
 * entity the sweep named, which is what an operator opens to put the calendar
 * right. The same resolve control as the general queue, which writes the
 * audit log; resolving says a person looked, it does not move inventory.
 */
export function DriftCard({
  alert,
  copy,
  common,
  ui,
}: {
  alert: AlertView;
  copy: AdminCopy["alerts"];
  common: AdminCommon;
  ui: AdminUi;
}) {
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip label="Inventory drift" tone="warning" />
        <ui.StatusChip
          label={fill(copy.severityChip, { level: copy.severity[alert.severity] })}
          tone={SEVERITY_TONE[alert.severity]}
        />
        <ui.StatusChip {...dueChip(alert.createdAt, gradeForSeverity(alert.severity), common)} />
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {ui.when(alert.createdAt)}
        </span>
      </div>
      {/* Drift is a disagreement about a calendar, so the calendar clock is
          its object rather than the general warning mark. */}
      <h3 className="mt-xs flex items-center gap-inline text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
        <IconPlate size="sm">
          <UiIcon name="calendar-clock" size={20} />
        </IconPlate>
        <span className="min-w-0">{alert.title}</span>
      </h3>
      {alert.description && (
        <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {alert.description}
        </p>
      )}
      <dl className="mt-xs grid gap-2xs text-[length:var(--nf-text-caption)]">
        <div className="flex flex-wrap gap-x-sm">
          <dt className="text-[var(--nf-content-muted)]">Alert</dt>
          {/* Stays `overflow-wrap: anywhere` on purpose: a reference is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
          <dd className="font-mono text-[var(--nf-content-secondary)] [overflow-wrap:anywhere] [user-select:all]">
            {alert.id}
          </dd>
        </div>
        {alert.entityId && (
          <div className="flex flex-wrap gap-x-sm">
            <dt className="text-[var(--nf-content-muted)]">Names</dt>
            {/* Stays `overflow-wrap: anywhere` on purpose: a reference is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
            <dd className="font-mono text-[var(--nf-content-secondary)] [overflow-wrap:anywhere] [user-select:all]">
              {alert.entityId}
            </dd>
          </div>
        )}
      </dl>
      <AlertResolve alertId={alert.id} copy={copy} common={common} />
    </li>
  );
}

/** The drift section's title and hint, shared by the desk and its preview. */
export function driftSectionCopy(openCount: number): { title: string; hint: string } {
  return {
    title: `Inventory drift · ${openCount} open`,
    hint: "Room-nights where the calendar and the bookings disagree, from the nightly sweep. Oldest first. Resolving records that a person put the calendar right; it does not change inventory by itself.",
  };
}
