import type { ReactNode } from "react";
import type { Locale } from "@vallo/i18n";
import { PageHead, Panel } from "../_components/panels";
import type { EscalationCounts, EscalationRead } from "@/lib/admin/escalations/read";
import {
  LIMITS,
  carriesPersonalNumber,
  deskRoot,
  isEscalationCategory,
  safeRecordUrl,
  type EscalationCategory,
} from "@/lib/admin/escalations/types";
import { EscalationForm } from "./EscalationForm";
import { ReadState } from "./parts";

/**
 * THE ESCALATION FORM AS A PAGE (`/admin/escalations/new`), drawn from what
 * the address carried. The page reads; this draws, so the preview and the
 * tests can feed it the same shape.
 */
export type NewEscalationQuery = {
  category: EscalationCategory | null;
  recordUrl: string | null;
  recordLabel: string | null;
};

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * The three things the address may carry, each checked: a category the
 * console knows, a record that is a path inside the console, and a label
 * that is short and carries no number. Anything else is dropped, never
 * trusted.
 */
export function readNewEscalationQuery(params: Record<string, string | string[] | undefined>): NewEscalationQuery {
  const category = first(params.category);
  const recordUrl = safeRecordUrl(first(params.record));
  const label = (first(params.label) ?? "").trim().slice(0, LIMITS.recordLabel.max);
  return {
    category: isEscalationCategory(category) ? category : null,
    recordUrl,
    recordLabel: recordUrl && label.length > 0 && !carriesPersonalNumber(label) ? label : null,
  };
}

const COPY = {
  title: "Raise an escalation",
  lede: "For anything you cannot or may not decide. Say what happened and what you need. It goes to the people who can decide it, with a response time, and you are told the outcome.",
  panel: "The escalation",
} as const;

export function NewEscalation({
  query,
  counts,
  locale,
  back,
}: {
  query: NewEscalationQuery;
  counts: EscalationRead<EscalationCounts>;
  locale: Locale;
  back?: ReactNode;
}) {
  /* Raised about a record: the desk is where that record lives. */
  const sourcePath = query.recordUrl ? deskRoot(query.recordUrl.split("?")[0] ?? "") : "/admin/escalations";
  return (
    <div className="nf-console nf-admin-stack" data-testid="escalation-new">
      <PageHead title={COPY.title} lede={COPY.lede} lead={back} />
      <Panel title={COPY.panel} id="escalation-new-form">
        {counts.state === "not_set_up" || counts.state === "forbidden" ? (
          <ReadState state={counts.state} what={COPY.title} locale={locale} />
        ) : (
          <EscalationForm
            sourcePath={sourcePath}
            recordUrl={query.recordUrl}
            recordLabel={query.recordLabel}
            {...(query.category ? { initialCategory: query.category } : {})}
            staffed={counts.state === "ok" ? counts.data.staffed : null}
          />
        )}
      </Panel>
    </div>
  );
}
