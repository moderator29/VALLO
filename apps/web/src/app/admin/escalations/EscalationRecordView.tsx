import Link from "next/link";
import { getDictionary, type Locale } from "@vallo/i18n";
import { adminUi } from "../_components/ui";
import { PageHead, Panel, PanelEmpty } from "../_components/panels";
import type { EscalationDetail, EscalationRead } from "@/lib/admin/escalations/read";
import {
  CATEGORY_LABEL,
  NO_TIP_OFF_CATEGORIES,
  SEVERITY_LABEL,
  actionsFor,
  isClosed,
  withWhom,
} from "@/lib/admin/escalations/types";
import { clockOf, eventWords, ownerWords, raisedByWords, statusWords, waitedWords } from "@/lib/admin/escalations/words";
import { deskHref, deskName } from "./desk-name";
import { EscalationActions } from "./EscalationActions";
import { ClockWords, ReadState, SeverityBadge, StatusBadge } from "./parts";

/**
 * ONE ESCALATION, AS A SHORT PLAIN-ENGLISH BRIEF: what happened, what is
 * needed, the attached record as a link, who has it now, the clock, the
 * timeline, and the actions this viewer may take. The receiver should be able
 * to act from this page without asking the raiser to explain it again.
 *
 * It draws what `getEscalation` answered. The actions offered are the ones
 * `mayAct` allows this viewer; the database applies the same rules again.
 */
const COPY = {
  fallbackTitle: "Escalation",
  back: "All escalations",
  brief: "The brief",
  whatHappened: "What happened",
  whatIsNeeded: "What is needed",
  attached: "Attached record",
  openRecord: "Open the attached record",
  noRecord: "No record was attached.",
  noTipOff: "Never tell the member you suspect them.",
  stands: "Where it stands",
  owner: "Who has it now",
  clock: "The clock",
  urgency: "Urgency",
  status: "Status",
  sentTo: "Sent to",
  raised: "Raised",
  closingResolved: "Closing note",
  closingDeclined: "Why it was declined",
  timeline: "Timeline",
  timelineEmpty: "Nothing has been recorded on this escalation yet.",
  act: "What you can do",
  nothingTitle: "Nothing for you to do here",
  nothingOpen: "You can read this escalation. Only the people it is with can act on it.",
  nothingClosed: "This escalation is closed. The person who raised it can reopen it within 14 days.",
} as const;

export function EscalationRecordView({ read, now, locale }: { read: EscalationRead<EscalationDetail>; now: number; locale: Locale }) {
  const ui = adminUi(getDictionary(locale), locale);
  const back = (
    <Link href="/admin/escalations" className="nf-admin-panel__link" data-testid="escalation-back">
      {COPY.back}
    </Link>
  );
  if (read.state !== "ok") {
    return (
      <div className="nf-console nf-admin-stack" data-testid="escalation-record" data-state={read.state}>
        <PageHead title={COPY.fallbackTitle} lead={back} />
        <ReadState state={read.state} what={COPY.fallbackTitle} locale={locale} />
      </div>
    );
  }
  const { record, events, viewer, assignable } = read.data;
  const clock = clockOf(record, now);
  const closed = isClosed(record.status);
  const actions = actionsFor(viewer, { status: record.status, hasRaiser: record.raisedByMe || record.raisedByName !== null, resolvedAt: record.resolvedAt }, now);
  /* A lead may hand a live one to somebody, whoever holds it now. */
  const people = viewer.isLead && !closed ? assignable : [];
  const desk = deskName(record.sourceDesk);
  const stands: { label: string; value: React.ReactNode; testId?: string }[] = [
    { label: COPY.owner, value: ownerWords(record), testId: "escalation-owner" },
    {
      label: COPY.clock,
      testId: "escalation-record-clock",
      value: (
        <span className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
          {closed ? null : <ClockWords words={clock.words} overdue={clock.overdue} />}
          <span>
            {waitedWords(record, now)}
            {closed ? "" : `, answer by ${ui.when(record.dueAt)}`}
          </span>
        </span>
      ),
    },
    { label: COPY.urgency, value: `${SEVERITY_LABEL[record.severity].name}: answered ${SEVERITY_LABEL[record.severity].answer}` },
    { label: COPY.status, value: statusWords(record.status) },
    { label: COPY.sentTo, value: sentToWords(record.routedTo, record.level) },
    { label: COPY.raised, value: ui.when(record.createdAt) },
  ];
  return (
    <div className="nf-console nf-admin-stack" data-testid="escalation-record" data-state="ok" data-status={record.status}>
      <PageHead
        title={record.title}
        lede={`${record.reference} · ${CATEGORY_LABEL[record.category].name}`}
        lead={back}
        trail={
          <span className="flex flex-wrap items-center gap-2xs">
            <SeverityBadge severity={record.severity} />
            <StatusBadge status={record.status} />
          </span>
        }
      />

      <Panel title={COPY.brief} id="escalation-brief">
        <div className="grid gap-sm">
          <p className="nf-caption min-w-0 break-words" data-testid="escalation-raised-by">
            {raisedByWords(record, desk)}{" "}
            <Link href={deskHref(record.sourceDesk)} className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
              Open that desk
            </Link>
          </p>
          <section aria-labelledby="escalation-what-happened-title">
            <h3 id="escalation-what-happened-title" className="nf-label">
              {COPY.whatHappened}
            </h3>
            <p className="nf-body m-0 min-w-0 whitespace-pre-line break-words text-content" data-testid="escalation-what-happened">
              {record.whatHappened}
            </p>
          </section>
          <section aria-labelledby="escalation-what-is-needed-title">
            <h3 id="escalation-what-is-needed-title" className="nf-label">
              {COPY.whatIsNeeded}
            </h3>
            <p className="nf-body m-0 min-w-0 whitespace-pre-line break-words text-content" data-testid="escalation-what-is-needed">
              {record.whatIsNeeded}
            </p>
          </section>
          <section aria-labelledby="escalation-attached-title">
            <h3 id="escalation-attached-title" className="nf-label">
              {COPY.attached}
            </h3>
            {record.recordUrl ? (
              <Link href={record.recordUrl} className="nf-btn nf-btn--glass nf-btn--sm" data-testid="escalation-record-link">
                {record.recordLabel ? `Open: ${record.recordLabel}` : COPY.openRecord}
              </Link>
            ) : (
              <p className="nf-caption m-0">{COPY.noRecord}</p>
            )}
          </section>
          {NO_TIP_OFF_CATEGORIES.includes(record.category) ? (
            <p className="nf-body-sm m-0 font-semibold text-content" data-testid="escalation-no-tip-off">
              {COPY.noTipOff}
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel title={COPY.stands} id="escalation-stands">
        <dl className="grid gap-xs">
          {stands.map((f) => (
            <div key={f.label} className="grid gap-x-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="nf-caption text-content-secondary">{f.label}</dt>
              <dd className="nf-body m-0 min-w-0 break-words text-content" data-testid={f.testId}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        {closed && record.resolution ? (
          <div className="mt-row" data-testid="escalation-closing-note">
            <h3 className="nf-label">{record.status === "resolved" ? COPY.closingResolved : COPY.closingDeclined}</h3>
            <p className="nf-body m-0 min-w-0 whitespace-pre-line break-words text-content">{record.resolution}</p>
            <p className="nf-caption m-0">
              {record.resolvedByName ?? "A colleague"}, {ui.when(record.resolvedAt)}
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel title={COPY.act} id="escalation-actions">
        {actions.length > 0 || people.length > 0 ? (
          <EscalationActions id={record.id} actions={actions} people={people} currentRoute={record.routedTo} />
        ) : (
          <PanelEmpty title={COPY.nothingTitle} body={closed ? COPY.nothingClosed : COPY.nothingOpen} />
        )}
      </Panel>

      <Panel title={COPY.timeline} id="escalation-timeline" flush={events.length > 0}>
        {events.length === 0 ? (
          <PanelEmpty title={COPY.timeline} body={COPY.timelineEmpty} />
        ) : (
          <ol className="nf-rows nf-group" aria-label={COPY.timeline}>
            {events.map((event) => (
              <li key={event.id} className="nf-row flex-wrap items-start" data-testid="escalation-event" data-kind={event.kind}>
                <span className="min-w-0 flex-1 basis-0">
                  <span className="nf-body block min-w-0 break-words font-semibold text-content">{eventWords(event)}</span>
                  {event.body ? (
                    <span className="nf-body mt-2xs block min-w-0 whitespace-pre-line break-words text-content">{event.body}</span>
                  ) : null}
                  <span className="nf-caption block">
                    <time dateTime={event.createdAt}>{ui.when(event.createdAt)}</time>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

/** "The Finance team", or "the COO, after nobody on the Finance team answered in time". */
function sentToWords(routedTo: string, level: number): string {
  const first = withWhom(routedTo, routedTo === "super_admin" ? 2 : routedTo === "coo" ? 1 : 0);
  const now = withWhom(routedTo, level);
  const cap = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
  return now === first ? cap(first) : `${cap(first)} first. It moved up to ${now} when nobody answered in time.`;
}
