import "@/app/css/chargebacks.css";
import "../money/_desk/desk.css";
import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { dateTimeLabel, dayLabel } from "@/lib/format/when";
import {
  AGE_BUCKETS,
  CHARGEBACK_STATES,
  ageDays,
  chargebacksHref,
  deadlineOf,
  holdsPayouts,
  isNarrowed,
  isUndecided,
  narrowChargebacks,
  type ChargebackCounts,
  type ChargebackQuery,
  type ChargebackRow,
  type ChargebackState,
  type RecoveryState,
} from "@/lib/admin/reads/chargebacks-model";
import { CalmNote, DeskHead, NumberedPager, Panel, TableNote } from "../money/_desk/Desk";
import { OpenChargebackButton } from "./ChargebackActions";

/**
 * MONEY > CHARGEBACKS (`/admin/chargebacks`), the finance desk.
 *
 * At the top, one count per state (and "lost, still owed", the payout
 * hold), each a link that narrows the desk. Then the filters, a plain GET
 * form (state, amount range, age, booking, reference or dispute id), so a
 * filtered desk is an address. Then every chargeback in the order the
 * database gives it: undecided and still owed first, the nearest evidence
 * deadline at the top. A row opens the case. Last, recording a new one.
 *
 * Pure: the page reads (`getChargebackDesk`) and the preview feeds fixtures.
 */

export const CHARGEBACKS_BASE = "/admin/chargebacks";
export const PAGE_SIZE = 25;

type Copy = Dictionary["chargebacks"]["desk"];

export const STATE_TONE: Record<ChargebackState, StatusTone> = {
  opened: "warning",
  evidence_requested: "warning",
  evidence_submitted: "info",
  won: "success",
  lost: "danger",
};

export const RECOVERY_TONE: Record<RecoveryState, StatusTone> = {
  none: "neutral",
  owed: "danger",
  recovered: "success",
  written_off: "neutral",
};

export function ChargebacksDesk({
  query,
  read,
  page,
  now,
  copy,
  locale,
  prefill,
}: {
  query: ChargebackQuery;
  read: { state: "ok"; data: { rows: ChargebackRow[]; counts: ChargebackCounts } } | { state: "unavailable" };
  page: number;
  now: number;
  copy: Copy;
  locale: Locale;
  /** `?reference=` from a payment's link: the record sheet opens on it. */
  prefill?: string | null;
}) {
  const f = copy.filters;
  const href = (patch: Partial<ChargebackQuery>) => chargebacksHref(CHARGEBACKS_BASE, query, patch);
  const narrowed = isNarrowed(query);
  const rows = read.state === "ok" ? narrowChargebacks(read.data.rows, query, now) : [];
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownPage = Math.min(page, pages);
  const pageRows = rows.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);
  const counts = read.state === "ok" ? read.data.counts : null;
  const params: Record<string, string | undefined> = {
    state: query.state ?? undefined,
    min: query.min !== null ? String(query.min) : undefined,
    max: query.max !== null ? String(query.max) : undefined,
    age: query.age ?? undefined,
    booking: query.booking ?? undefined,
    q: query.q ?? undefined,
  };

  const countCard = (key: "all" | ChargebackState | "owed", label: string, value: number | null, note?: string, warn = false) => {
    const target = key === "all" ? null : key;
    const current = (query.state ?? null) === target;
    return (
      <Link
        key={key}
        href={href({ state: current && target ? null : target })}
        className={`nf-panel nf-panel--card nf-cb-count${warn && value ? " nf-cb-count--warn" : ""}`}
        aria-current={current ? "true" : undefined}
        data-testid={`chargeback-count-${key}`}
      >
        <span className="nf-cb-count__label">{label}</span>
        <span className="nf-cb-count__value nf-numeric">{value === null ? "-" : value}</span>
        {note ? <span className="nf-cb-count__note">{note}</span> : null}
      </Link>
    );
  };

  return (
    <div className="nf-console nf-md" data-testid="admin-chargebacks">
      <DeskHead
        title={copy.title}
        lede={copy.lede}
        aside={<OpenChargebackButton copy={copy} defaults={prefill ? { reference: prefill } : undefined} />}
      />

      <nav aria-label={copy.countsLabel} className="nf-cb-counts">
        {countCard("all", copy.countAll, counts?.all ?? null)}
        {CHARGEBACK_STATES.map((state) =>
          countCard(state, copy.states[state], counts ? counts[state] : null, isUndecided(state) ? copy.countOpenNote : copy.countClosedNote),
        )}
        {countCard("owed", copy.countOwed, counts?.owed ?? null, copy.countOwedNote, true)}
      </nav>

      <form method="get" action={CHARGEBACKS_BASE} className="nf-cb-filters" aria-label={f.label}>
        <label className="block">
          <span className="nf-label">{f.state}</span>
          <select name="state" className="nf-field w-full" defaultValue={query.state ?? ""}>
            <option value="">{f.anyState}</option>
            {CHARGEBACK_STATES.map((state) => (
              <option key={state} value={state}>
                {copy.states[state]}
              </option>
            ))}
            <option value="owed">{f.owedOnly}</option>
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{f.age}</span>
          <select name="age" className="nf-field w-full" defaultValue={query.age ?? ""}>
            <option value="">{f.anyAge}</option>
            {AGE_BUCKETS.map((age) => (
              <option key={age} value={age}>
                {f.ages[age]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{f.minAmount}</span>
          <input name="min" inputMode="decimal" className="nf-field w-full" defaultValue={query.min ?? ""} />
        </label>
        <label className="block">
          <span className="nf-label">{f.maxAmount}</span>
          <input name="max" inputMode="decimal" className="nf-field w-full" defaultValue={query.max ?? ""} />
        </label>
        <label className="block nf-cb-filters__wide">
          <span className="nf-label">{f.booking}</span>
          <input name="booking" className="nf-field w-full font-mono" placeholder={f.bookingPlaceholder} defaultValue={query.booking ?? ""} autoComplete="off" />
        </label>
        <label className="block nf-cb-filters__wide">
          <span className="nf-label">{f.search}</span>
          <input name="q" type="search" enterKeyHint="search" className="nf-field w-full" placeholder={f.searchPlaceholder} defaultValue={query.q ?? ""} autoComplete="off" />
        </label>
        <div className="nf-cb-filters__actions">
          <button type="submit" className="nf-btn nf-btn--primary nf-btn--sm">
            {f.apply}
          </button>
          {narrowed ? (
            <Link href={CHARGEBACKS_BASE} className="nf-btn nf-btn--glass nf-btn--sm">
              {f.clear}
            </Link>
          ) : null}
        </div>
      </form>

      <Panel
        title={copy.tableTitle}
        hint={read.state === "ok" ? copy.shown.replace("{shown}", String(total)).replace("{total}", String(read.data.counts.all)) : copy.tableHint}
        className="mt-md"
      >
        {read.state !== "ok" ? (
          <CalmNote kind="error" title={copy.unavailableTitle} fills={copy.unavailableBody} />
        ) : (
          <>
            <div className="nf-md-scroll"><table className="nf-md-table" aria-label={copy.caption}>
              <thead>
                <tr>
                  <th scope="col">{copy.columns.opened}</th>
                  <th scope="col">{copy.columns.reference}</th>
                  <th scope="col">{copy.columns.lister}</th>
                  <th scope="col">{copy.columns.state}</th>
                  <th scope="col">{copy.columns.due}</th>
                  <th scope="col" className="nf-md-num">
                    {copy.columns.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <TableNote
                    columns={6}
                    note={
                      narrowed
                        ? { title: copy.noMatchTitle, fills: copy.noMatchFills, action: { href: CHARGEBACKS_BASE, label: copy.showEvery } }
                        : { title: copy.emptyTitle, fills: copy.emptyFills, creates: copy.emptyCreates }
                    }
                  />
                ) : (
                  pageRows.map((row) => {
                    const days = ageDays(row.openedAt, now);
                    const deadline = deadlineOf(row, now);
                    return (
                      <tr key={row.id} data-testid="chargeback-row">
                        <td className="nf-md-date" data-label={copy.columns.opened}>
                          {dayLabel(row.openedAt, { now: new Date(now), locale })}
                          <span className="nf-cb-sub">{days === 0 ? copy.openedToday : copy.openedAgo.replace("{days}", String(days))}</span>
                        </td>
                        <td data-label={copy.columns.reference}>
                          <Link href={`${CHARGEBACKS_BASE}/${row.id}`} className="nf-cb-ref hover:underline">
                            {row.reference || row.providerDisputeId}
                          </Link>
                          <span className="nf-cb-sub">{row.listingTitle ?? row.providerDisputeId}</span>
                        </td>
                        <td data-label={copy.columns.lister}>
                          {row.listerUnattributed || !row.listerId ? (
                            <StatusPill tone="warning">{copy.unattributed}</StatusPill>
                          ) : (
                            (row.listerName ?? copy.unnamed)
                          )}
                        </td>
                        <td data-label={copy.columns.state}>
                          <StatusPill tone={STATE_TONE[row.state]}>{copy.states[row.state]}</StatusPill>
                          {row.state === "lost" ? <span className="nf-cb-sub">{copy.recovery[row.recoveryState]}</span> : null}
                        </td>
                        <td data-label={copy.columns.due}>
                          {deadline === "none" ? (
                            <span className="text-[var(--nf-content-muted)]">{copy.noDeadline}</span>
                          ) : deadline === "overdue" ? (
                            <span className="nf-cb-due--overdue">
                              {copy.overdue.replace("{when}", dateTimeLabel(row.evidenceDueAt!, { now: new Date(now), locale }))}
                            </span>
                          ) : (
                            copy.dueOn.replace("{when}", dateTimeLabel(row.evidenceDueAt!, { now: new Date(now), locale }))
                          )}
                        </td>
                        <td className="nf-md-num nf-md-strong" data-label={copy.columns.amount}>
                          <Amount minorUnits={row.amountMinor} currency={row.currency} locale={locale} showFraction />
                          {holdsPayouts(row) ? (
                            <span className="nf-cb-sub">
                              <Amount minorUnits={row.amountMinor - row.recoveredMinor} currency={row.currency} locale={locale} showFraction /> {copy.recovery.owed.toLowerCase()}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table></div>
            {total > PAGE_SIZE ? (
              <NumberedPager base={CHARGEBACKS_BASE} params={params} page={shownPage} total={total} pageSize={PAGE_SIZE} noun={copy.rowsNoun} locale={locale} />
            ) : null}
          </>
        )}
      </Panel>

      <Panel title={copy.open.title} hint={copy.open.hint} className="mt-md">
        <p className="nf-body text-[var(--nf-content-secondary)]">{copy.open.lede}</p>
        <div className="mt-sm">
          <OpenChargebackButton copy={copy} variant="secondary" defaults={prefill ? { reference: prefill } : undefined} />
        </div>
      </Panel>
    </div>
  );
}
