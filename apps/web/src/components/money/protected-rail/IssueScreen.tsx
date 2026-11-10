import type { ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  PROTECTED_ADD_PAYOUT,
  PROTECTED_COPIED,
  PROTECTED_FUNDING_ROWS,
  PROTECTED_ISSUE,
  PROTECTED_ISSUE_NEXT_TITLE,
  PROTECTED_ISSUE_ROWS,
  PROTECTED_LISTER_ISSUE,
  PROTECTED_NEED_HELP,
  PROTECTED_WAITING_REFRESH,
  protectedLastConfirmed,
} from "@/lib/money/copy";
import type { ProtectedStage } from "@/lib/money/protected-journey";
import { CopyValue } from "./CopyValue";
import { ISSUE_ICON, type ProtectedIssue, type ProtectedIssueKind } from "./issues";
import { DetailRows, InfoCard, PlaceCard, ScreenHead, StagePill, TimelineSpine, lagosTime, money } from "./kit";
import type { ProtectedDeal } from "./types";

/** The issue's own label and icon, in the pill's shape (never colour alone). */
export function IssuePill({ kind }: { kind: ProtectedIssueKind }) {
  return (
    <span className="nf-pp-pill" data-tone="attention" data-testid="pp-issue-pill">
      <UiIcon name={ISSUE_ICON[kind]} size={16} weight="lean" />
      {PROTECTED_ISSUE[kind].label}
    </span>
  );
}

/**
 * THE SCREENS NOBODY ASKS FOR, FOR THE PAYER (spec two, A to C and the two
 * delays). Same family as every other state: a plate with the issue's icon,
 * its pill, a title and a line, then the facts and what happens now. None
 * blames the payer and none names a time it cannot keep. Server-safe; the
 * one action it can take (read again) is handed in.
 */
export function IssueScreen({
  deal,
  issue,
  stage,
  locale,
  refresh,
  pending = false,
}: {
  deal: ProtectedDeal;
  issue: Exclude<ProtectedIssue, { kind: "payout_missing" }>;
  stage: ProtectedStage;
  locale: Locale;
  refresh?: () => void;
  pending?: boolean;
}) {
  const words = PROTECTED_ISSUE[issue.kind];
  const reference = {
    label: PROTECTED_FUNDING_ROWS.reference,
    value: <CopyValue value={deal.reference} label={PROTECTED_FUNDING_ROWS.reference} copied={PROTECTED_COPIED.reference} />,
  };
  const help = (
    <Link href={deal.links.help} className="nf-pp-link">
      {PROTECTED_NEED_HELP}
    </Link>
  );

  let facts: ReactNode = null;
  if (issue.kind === "amount_mismatch") {
    const received = issue.receivedMinor;
    facts = (
      <DetailRows
        rows={[
          { label: PROTECTED_ISSUE_ROWS.agreed, value: money(deal.amountMinor, locale) },
          ...(received !== null
            ? [
                { label: PROTECTED_ISSUE_ROWS.received, value: money(received, locale) },
                { label: PROTECTED_ISSUE_ROWS.difference, value: money(Math.abs(deal.amountMinor - received), locale), strong: true },
              ]
            : []),
          reference,
        ]}
      />
    );
  } else if (issue.kind === "partner_unavailable") {
    const at = lagosTime(issue.lastConfirmedAt, locale);
    facts = (
      <DetailRows
        rows={[
          {
            label: PROTECTED_ISSUE_ROWS.lastConfirmed,
            value: (
              <span className="nf-pp-stale">
                <StagePill stage={stage} />
                {at ? <span className="nf-pp-stale__at">{protectedLastConfirmed(at)}</span> : null}
              </span>
            ),
          },
          { label: PROTECTED_ISSUE_ROWS.agreed, value: money(deal.amountMinor, locale) },
          reference,
        ]}
      />
    );
  } else if (issue.kind === "release_delayed" || issue.kind === "refund_delayed") {
    const at = lagosTime(issue.askedAt, locale);
    facts = (
      <>
        <PlaceCard place={deal.place} amount={money(deal.amountMinor, locale)} />
        <DetailRows rows={[...(at ? [{ label: PROTECTED_ISSUE_ROWS.askedAt, value: at }] : []), reference]} />
      </>
    );
  } else {
    facts = <DetailRows rows={[{ label: PROTECTED_ISSUE_ROWS.agreed, value: money(deal.amountMinor, locale) }, reference]} />;
  }

  return (
    <div className="nf-pp-screen" data-testid={`pp-issue-${issue.kind}`} data-stage={stage} data-issue={issue.kind}>
      <span className="nf-pp-mark" data-tone="attention" aria-hidden="true">
        <UiIcon name={ISSUE_ICON[issue.kind]} size={30} weight="lean" />
      </span>
      <header className="nf-pp-head">
        <IssuePill kind={issue.kind} />
        <h1 className="nf-pp-title">{words.title}</h1>
        <div className="nf-pp-lead">
          <p>{words.body}</p>
        </div>
      </header>
      {facts}
      <InfoCard icon="info" title={PROTECTED_ISSUE_NEXT_TITLE}>
        <p>{words.next}</p>
      </InfoCard>
      <div className="nf-pp-actions">
        {issue.kind === "partner_unavailable" && refresh ? (
          <Button variant="secondary" size="lg" full onClick={refresh} loading={pending} data-testid="pp-refresh">
            {PROTECTED_WAITING_REFRESH}
          </Button>
        ) : null}
        {help}
      </div>
      {issue.kind === "release_delayed" || issue.kind === "refund_delayed" ? (
        <TimelineSpine stage={stage} stamps={deal.stamps} milestone={deal.milestone} locale={locale} />
      ) : null}
    </div>
  );
}

/**
 * The lister's side of the same issues (spec screen 10 and BUILD 7.6): a
 * notice in the lister's own words, and the payout account warning long
 * before a payout could fail.
 */
export function ListerIssue({ deal }: { deal: ProtectedDeal }) {
  const issue = deal.issue && deal.issue.kind !== "payout_missing" ? deal.issue : null;
  return (
    <>
      {issue ? (
        <p className="nf-pp-notice" data-tone="attention" role="status" data-testid={`pp-lister-issue-${issue.kind}`}>
          <UiIcon name={ISSUE_ICON[issue.kind]} size={18} weight="lean" />
          <span>
            <strong className="nf-pp-notice__title">{PROTECTED_ISSUE[issue.kind].label}</strong> {PROTECTED_LISTER_ISSUE[issue.kind]}
          </span>
        </p>
      ) : null}
      {deal.listerPayoutMissing ? (
        <section className="nf-pp-alert" aria-labelledby="pp-payout-title" data-testid="pp-issue-payout_missing">
          <span className="nf-pp-info__plate" data-tone="attention" aria-hidden="true">
            <UiIcon name={ISSUE_ICON.payout_missing} size={20} weight="lean" />
          </span>
          <div className="nf-pp-info__text">
            <IssuePill kind="payout_missing" />
            <h2 id="pp-payout-title" className="nf-pp-info__title">
              {PROTECTED_ISSUE.payout_missing.title}
            </h2>
            <div className="nf-pp-info__body">
              <p>{PROTECTED_ISSUE.payout_missing.body}</p>
              <p>{PROTECTED_ISSUE.payout_missing.next}</p>
            </div>
            <ButtonLink href="/payouts" variant="primary" size="md" data-testid="pp-add-payout">
              {PROTECTED_ADD_PAYOUT}
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </>
  );
}
