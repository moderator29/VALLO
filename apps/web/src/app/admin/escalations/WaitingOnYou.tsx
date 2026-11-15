import Link from "next/link";
import { getDictionary, type Locale } from "@vallo/i18n";
import { adminUi } from "../_components/ui";
import { Panel, PanelEmpty, PanelLink } from "../_components/panels";
import type { EscalationListData, EscalationRead } from "@/lib/admin/escalations/read";
import { clockOf, raisedByWords } from "@/lib/admin/escalations/words";
import { deskName } from "./desk-name";
import { ClockWords, ReadState, SeverityBadge } from "./parts";
import { plural } from "@vallo/i18n/core";

/**
 * "WAITING ON YOU": the card on the console overview (the super admin and the
 * COO) and at the top of the COO desk. The three that have waited longest, in
 * plain words, and a link to the rest. It draws what `listEscalations("for_me")`
 * answered; before the SQL has run it is the same "not set up yet" panel.
 */
export function WaitingOnYou({
  read,
  now,
  locale,
  title = "Waiting on you",
  who = "you",
  note,
}: {
  read: EscalationRead<EscalationListData>;
  now: number;
  locale: Locale;
  title?: string;
  /** Whose work this is, in the sentence: "you" on your own card, "the COO" on the COO desk. */
  who?: string;
  /** One quiet line under the title, when the card needs to say where these come from. */
  note?: string;
}) {
  const ui = adminUi(getDictionary(locale), locale);
  const rows = read.state === "ok" ? [...read.data.rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  const overdue = rows.filter((row) => clockOf(row, now).overdue).length;
  return (
    <Panel
      title={title}
      id="escalations-waiting"
      flush={rows.length > 0}
      action={<PanelLink href="/admin/escalations">{rows.length > 3 ? `See all ${rows.length}` : "Open escalations"}</PanelLink>}
    >
      <div data-testid="escalations-waiting-card">
        {read.state !== "ok" ? (
          <ReadState state={read.state} what={title} locale={locale} />
        ) : rows.length === 0 ? (
          <PanelEmpty
            title={`Nothing is waiting on ${who}`}
            body={`No escalation is waiting on ${who}. When one is raised it shows here, oldest first.`}
          />
        ) : (
          <>
            <p className="nf-caption px-card pt-sm" data-testid="escalations-waiting-summary">
              {plural(rows.length, { one: `{count} escalation is waiting on ${who}`, other: `{count} escalations are waiting on ${who}` })}
              {overdue > 0 ? `, ${overdue} overdue` : ""}. The oldest first.{note ? ` ${note}` : ""}
            </p>
            <ul className="nf-rows nf-group" aria-label={title}>
              {rows.slice(0, 3).map((row) => {
                const clock = clockOf(row, now);
                return (
                  <li key={row.id} className="nf-row flex-col items-stretch gap-xs sm:flex-row sm:items-start sm:gap-sm" data-testid="escalations-waiting-row">
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/escalations/${row.id}`} className="nf-body block min-w-0 break-words font-semibold text-content hover:underline">
                        {row.title}
                      </Link>
                      <span className="nf-caption block min-w-0 break-words">
                        {raisedByWords(row, deskName(row.sourceDesk))} <time dateTime={row.createdAt}>{ui.when(row.createdAt)}</time>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-start gap-2xs sm:items-end">
                      <SeverityBadge severity={row.severity} />
                      <ClockWords words={clock.words} overdue={clock.overdue} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
