import { PersonTier } from "@/app/admin/_components/PersonTier";
import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  Bars,
  DeskHead,
  Empty,
  Kpi,
  Panel,
  ReadFailed,
  READ_FAILED,
  StatusBar,
} from "../_review/parts";
import { formatDuration, percentChange } from "../_review/metrics";
import type { RungKind, VerificationSummary } from "../_review/contracts";
import { countOf } from "@vallo/i18n/core";

/**
 * Verification, 8E9602E2 panel 2: four KPI cards, the identity verification
 * queue, the Verification funnel, the rung results and Recent verifications.
 *
 * Presentational. The queue rows come from `getKycQueue`; the four
 * cards, the funnel, the rung results and Recent verifications from
 * `getVerificationSummary` (lib/admin/reads/verification.ts), exact counts
 * and complete windows. When that read fails the panels say so.
 *
 * TWO THINGS IN THE RENDER HAVE NO SOURCE AND ARE TRANSLATED. "Match score"
 * and "Provider performance" (NIMC, BVN, Bank, Selfie) describe an identity
 * provider's face match, and no provider or score is recorded anywhere in the
 * schema. What Vallo does record is the four-rung ladder (identity, address,
 * payout account, met in person), so the queue shows rungs passed where the
 * render shows a score, and the side panel shows results per rung.
 */

export type VerificationRow = {
  id: string;
  name: string | null;
  /** The applicant's badge tier, read from `public.person_badge`. */
  badge?: "gold" | "platinum" | null;
  role: string;
  tier: number;
  rungsPassed: number;
  submitted: string;
  pending: number;
  /** The subject, opened under the row: documents, viewer and decisions. */
  body: ReactNode;
};

export type RecentDecision = {
  id: string;
  name: string | null;
  what: string;
  approved: boolean;
  age: string;
};

export type VerificationDeskProps = {
  filters?: ReactNode;
  rows: VerificationRow[];
  empty: { title: string; body: string; cause?: string; link?: { href: string; label: string } };
  summary: VerificationSummary | null;
  /** The ten latest decisions, or null when the read failed. */
  recent: RecentDecision[] | null;
  notes?: ReactNode;
  decided?: ReactNode;
  /** Dojah selfie checks that need a person, drawn above the document queue. */
  selfieChecks?: ReactNode;
  unavailable?: boolean;
};

const COLS = "minmax(0, 2fr) minmax(0, 1fr) 80px 90px minmax(0, 1.3fr) 110px";

const RUNG_WORDS: Record<RungKind, string> = {
  identity: "Identity",
  address: "Address",
  payout: "Payout account",
  in_person: "Met in person",
};

export function VerificationDesk(props: VerificationDeskProps) {
  const { filters, rows, empty, summary, recent, notes, decided, unavailable } = props;
  const s = summary;
  return (
    <div className="nf-rv nf-rv--kyc">
      <DeskHead title="Verification" sub="Verified people. Safer transactions." />

      <div className="nf-rv-kpis">
        <Kpi
          label="Awaiting review"
          figure={s ? String(s.awaiting) : null}
          delta={
            s ? { pct: percentChange(s.awaiting, s.awaitingLastWeek), upIsGood: false, vs: "vs a week ago" } : null
          }
          hint={s ? undefined : READ_FAILED}
        />
        <Kpi
          label="Passed today"
          figure={s ? String(s.passedToday) : null}
          delta={s ? { pct: percentChange(s.passedToday, s.passedYesterday), upIsGood: true, vs: "vs yesterday" } : null}
        />
        <Kpi
          label="Failed today"
          figure={s ? String(s.failedToday) : null}
          delta={s ? { pct: percentChange(s.failedToday, s.failedYesterday), upIsGood: false, vs: "vs yesterday" } : null}
        />
        <Kpi
          label="Median decision time"
          figure={s ? (formatDuration(s.medianDecisionMinutes.thisWeek) ?? "No decisions") : null}
          delta={
            s
              ? {
                  pct: percentChange(s.medianDecisionMinutes.thisWeek, s.medianDecisionMinutes.lastWeek),
                  upIsGood: false,
                  vs: "vs last week",
                }
              : null
          }
          hint={
            s
              ? s.decisionsThisWeek === 0
                ? "No decisions in the last seven days."
                : `Upload to decision, over ${countOf(s.decisionsThisWeek, "decisions")} in the last seven days.`
              : undefined
          }
        />
      </div>

      {filters}

      {props.selfieChecks}

      <div className="nf-rv-split">
        <div className="nf-rv-stack">
          <Panel flush title="Identity verification queue" labelledBy="rv-kyc-queue">
            {unavailable ? (
              <Empty
                kind="error"
                title="The queue could not be read"
                body="The console could not reach the platform data just now. Nothing is shown rather than a queue that looks clear."
              />
            ) : rows.length === 0 ? (
              <Empty {...empty} />
            ) : (
              <div className="nf-rv-rows" style={{ ["--rv-cols" as string]: COLS }}>
                <div className="nf-rv-rows__head" aria-hidden="true">
                  <span>Applicant</span>
                  <span>Role</span>
                  <span>Tier</span>
                  <span>Rungs</span>
                  <span>Submitted</span>
                  <span>Status</span>
                </div>
                {rows.map((row) => (
                  <details key={row.id} className="nf-rv-rows__row">
                    <summary>
                      <span className="nf-rv-rows__cell nf-rv-rows__cell--wide nf-rv-person">
                        <Avatar name={row.name} small />
                        <span>
                          {row.name ?? "No display name"}
                          <PersonTier tier={row.badge ?? null} />
                        </span>
                      </span>
                      <span className="nf-rv-rows__cell" style={{ color: "var(--nf-brand-secondary)" }}>
                        {row.role}
                      </span>
                      <span className="nf-rv-rows__cell">
                        <Badge tone="brand">Tier {row.tier}</Badge>
                      </span>
                      <span className="nf-rv-rows__cell nf-rv-table__num">{row.rungsPassed} of 4</span>
                      <span className="nf-rv-rows__cell nf-rv-table__muted">{row.submitted}</span>
                      <span className="nf-rv-rows__cell">
                        <Badge tone={row.pending > 0 ? "warning" : "success"}>
                          {row.pending > 0
                            ? `${row.pending} to decide`
                            : "Decided"}
                        </Badge>
                      </span>
                    </summary>
                    <div className="nf-rv-detail__body">{row.body}</div>
                  </details>
                ))}
              </div>
            )}
          </Panel>
          {notes}

          <Panel flush title="Recent verifications" labelledBy="rv-kyc-recent">
            {recent === null ? (
              <div style={{ padding: "0 var(--nf-space-md) var(--nf-space-md)" }}>
                <ReadFailed what="These figures" />
              </div>
            ) : recent.length === 0 ? (
              <Empty
                title="No decisions yet"
                body="Every document passed or failed on this desk appears here, newest first, with who it was about."
                cause="Decisions are taken from the queue above, one document at a time."
              />
            ) : (
              <div className="nf-rv-scroll">
                <table className="nf-rv-table" aria-label="Recent verifications">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Document</th>
                      <th scope="col">Result</th>
                      <th scope="col">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="nf-rv-person">
                            <Avatar name={entry.name} small />
                            {entry.name ?? "No display name"}
                          </span>
                        </td>
                        <td>{entry.what}</td>
                        <td>
                          <Badge tone={entry.approved ? "success" : "danger"}>
                            {entry.approved ? "Passed" : "Failed"}
                          </Badge>
                        </td>
                        <td className="nf-rv-table__num nf-rv-table__muted">{entry.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {decided}
        </div>

        <aside className="nf-rv-stack" aria-label="Verification health">
          <Panel title="Verification funnel" labelledBy="rv-kyc-funnel">
            {s ? (
              <StatusBar
                label="Documents by decision"
                segments={[
                  { key: "pending", label: "Awaiting review", value: s.documents.pending, ink: "pending" },
                  { key: "approved", label: "Passed", value: s.documents.approved, ink: "success" },
                  { key: "rejected", label: "Failed", value: s.documents.rejected, ink: "danger" },
                ]}
              />
            ) : (
              <ReadFailed what="These figures" />
            )}
          </Panel>

          <Panel title="Results by rung" labelledBy="rv-kyc-rungs">
            {s ? (
              <Bars
                rows={(Object.keys(RUNG_WORDS) as RungKind[]).map((kind) => {
                  const rung = s.rungs[kind];
                  return {
                    key: kind,
                    label: RUNG_WORDS[kind],
                    parts: [
                      { value: rung.passed, ink: "success", word: "passed" },
                      { value: rung.pending, ink: "pending", word: "pending" },
                      { value: rung.failed, ink: "danger", word: "failed" },
                    ],
                  };
                })}
              />
            ) : (
              <ReadFailed what="These figures" />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
