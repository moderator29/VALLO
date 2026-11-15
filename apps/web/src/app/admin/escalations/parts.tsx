import type { Locale } from "@vallo/i18n";
import { CalmNote, PanelEmpty, PanelUnavailable } from "../_components/panels";
import { Badge, type BadgeTone } from "../_components/Badge";
import {
  SEVERITY_LABEL,
  STATUS_LABEL,
  type EscalationSeverity,
  type EscalationStatus,
} from "@/lib/admin/escalations/types";

/**
 * The few parts the escalation screens share: the urgency and status badges,
 * and the three honest states a read can come back in (not set up yet, not
 * yours, could not be read). Server-safe.
 */

const SEVERITY_TONE: Record<EscalationSeverity, BadgeTone> = { urgent: "error", high: "pending", normal: "info", low: "info" };
const STATUS_TONE: Record<EscalationStatus, BadgeTone> = {
  open: "pending",
  acknowledged: "info",
  in_progress: "info",
  waiting_on_raiser: "pending",
  resolved: "success",
  declined: "error",
};

export function SeverityBadge({ severity }: { severity: EscalationSeverity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} solid={severity === "urgent"}>
      {SEVERITY_LABEL[severity].name}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: EscalationStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * The clock in words. An overdue one is a badge, so it is told apart by its
 * shape and its word ("overdue by 3 hours") as well as its colour.
 */
export function ClockWords({ words, overdue, testId }: { words: string; overdue: boolean; testId?: string }) {
  return overdue ? (
    <span data-testid={testId} data-overdue="true">
      <Badge tone="error">{words}</Badge>
    </span>
  ) : (
    <span className="nf-caption font-semibold text-content" data-testid={testId} data-overdue="false">
      {words}
    </span>
  );
}

export const STATE_COPY = {
  notSetUpTitle: "Escalations are not set up yet",
  notSetUpBody:
    "One database file has to be run before escalations open. Until then, take what you cannot decide to your lead directly, as the staff manual says.",
  notSetUpWho: "Only the founder runs it. The file is:",
  notSetUpFile: "supabase/migrations/pending/staff_escalations_2026-11-15.sql",
  forbiddenTitle: "Staff only",
  forbiddenBody: "Escalations are open to admins and to staff who have acknowledged the handbook.",
  notFoundTitle: "No such escalation",
  notFoundBody: "It does not exist, or it is not one you raised or one that is with you.",
} as const;

/** The plain "not set up yet" panel every escalation screen draws until the SQL has run. */
export function NotSetUp() {
  return (
    <div className="grid min-w-0 gap-xs" data-testid="escalations-not-set-up">
      <CalmNote
        kind="unwired"
        title={STATE_COPY.notSetUpTitle}
        fills={STATE_COPY.notSetUpBody}
        action={{ href: "/admin/manual/escalation", label: "Read the escalation chapter" }}
      />
      {/* On its own line and allowed to wrap: a file path is one long word,
          and inside the note it pushed the panel wider than a phone. */}
      <p className="nf-caption m-0 min-w-0 break-words">
        {STATE_COPY.notSetUpWho} <code className="break-words">{STATE_COPY.notSetUpFile}</code>
      </p>
    </div>
  );
}

/** Whatever a read came back as, other than rows. */
export function ReadState({
  state,
  what,
  locale,
}: {
  state: "not_set_up" | "forbidden" | "not_found" | "unavailable";
  what: string;
  locale: Locale;
}) {
  if (state === "not_set_up") return <NotSetUp />;
  if (state === "forbidden") return <PanelEmpty title={STATE_COPY.forbiddenTitle} body={STATE_COPY.forbiddenBody} />;
  if (state === "not_found") return <PanelEmpty title={STATE_COPY.notFoundTitle} body={STATE_COPY.notFoundBody} />;
  return <PanelUnavailable what={what} locale={locale} />;
}
