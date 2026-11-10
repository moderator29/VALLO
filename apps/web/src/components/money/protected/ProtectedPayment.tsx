"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@vallo/i18n";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  PROTECTED_COPIED,
  PROTECTED_DISPUTE_ADD,
  PROTECTED_DISPUTE_BODY,
  PROTECTED_DISPUTE_NEXT,
  PROTECTED_DISPUTE_TITLE,
  PROTECTED_DOWNLOAD_RECEIPT,
  PROTECTED_EXPIRED_BODY,
  PROTECTED_EXPIRED_CTA,
  PROTECTED_EXPIRED_TITLE,
  PROTECTED_FAILED_BODY,
  PROTECTED_FAILED_TITLE,
  PROTECTED_FUNDING_CTA,
  PROTECTED_FUNDING_CTA_NOTE,
  PROTECTED_FUNDING_EXACT,
  PROTECTED_FUNDING_EYEBROW,
  PROTECTED_FUNDING_ROWS,
  PROTECTED_FUNDING_WARNING,
  PROTECTED_HERO_EYEBROW,
  PROTECTED_HERO_PROMISE,
  PROTECTED_HERO_TITLE,
  PROTECTED_HOW_LINK,
  PROTECTED_MILESTONE,
  PROTECTED_MILESTONE_CONFIRM_BODY,
  PROTECTED_MILESTONE_CONFIRM_CTA,
  PROTECTED_MILESTONE_CONFIRM_TITLE,
  PROTECTED_MILESTONE_PROBLEM,
  PROTECTED_NEED_HELP,
  PROTECTED_NEXT_TITLE,
  PROTECTED_NOT_YET,
  PROTECTED_REFUNDED_BODY,
  PROTECTED_REFUNDED_TITLE,
  PROTECTED_REFUND_PROCESSING_BODY,
  PROTECTED_REFUND_PROCESSING_TITLE,
  PROTECTED_RELEASED_BODY,
  PROTECTED_RELEASED_TITLE,
  PROTECTED_RELEASE_PROCESSING_BODY,
  PROTECTED_RELEASE_PROCESSING_TITLE,
  PROTECTED_REVIEW_ROWS,
  PROTECTED_REVIEW_STATE_BODY,
  PROTECTED_REVIEW_STATE_TITLE,
  PROTECTED_STAGE_LABEL,
  PROTECTED_STILL_WAITING,
  PROTECTED_VIEW_DETAILS,
  PROTECTED_WAITING_BODY,
  PROTECTED_WAITING_CLOSE,
  PROTECTED_WAITING_REFRESH,
  PROTECTED_WAITING_TITLE,
  PROTECTED_WHEN_PAID,
  PROTECTED_WHEN_PAID_TITLE,
  PROTECTED_WHERE_TITLE,
  PROTECTED_WHERE_VALLO,
  protectedLastUpdated,
} from "@/lib/money/copy";
import { PROTECTED_FUNDS_WORDING_FULL } from "@/lib/money/protected-wording";
import { stageFor, type ProtectedStage } from "@/lib/money/protected-journey";
import { CopyValue } from "./CopyValue";
import { TransferClock } from "./TransferClock";
import { AmountHero, DetailRows, InfoCard, PlaceCard, ScreenHead, TimelineSpine, lagosTime, money } from "./kit";
import type { ProtectedDeal } from "./types";

export type ProtectedActions = {
  /** Asks the server to read the provider again. Never marks anything funded. */
  refresh: () => void;
  /** The payer says they transferred: also only a request to look again. */
  reportTransfer: () => void;
  confirmMilestone: () => void;
  raiseProblem: () => void;
  newDetails: () => void;
};

/**
 * SCREENS 3 TO 9 OF THE PROTECTED RAIL, chosen by the recorded state (spec
 * two; references R71, R79, R80). The screen is never chosen by what the
 * payer pressed: `stageFor` reads `provider_arrangements.status`, which only
 * the provider's signed report or a read-back moves.
 */
export function ProtectedPayment({
  deal,
  now,
  locale,
  actions,
  pending = false,
  stillWaiting = false,
}: {
  deal: ProtectedDeal;
  now: number;
  locale: Locale;
  actions: ProtectedActions;
  pending?: boolean;
  /** The server says the confirmation is taking longer than usual. */
  stillWaiting?: boolean;
}) {
  const stage = stageFor({
    status: deal.status,
    transferReported: deal.transferReported,
    fundingExpiresAt: deal.funding?.expiresAt ?? null,
    now,
  });
  const amount = money(deal.amountMinor, locale);
  const timeline = <TimelineSpine stage={stage} stamps={deal.stamps} milestone={deal.milestone} locale={locale} />;
  const help = (
    <Link href={deal.links.help} className="nf-pp-link">
      {PROTECTED_NEED_HELP}
    </Link>
  );
  const reference = (
    <DetailRows
      rows={[
        {
          label: PROTECTED_FUNDING_ROWS.reference,
          value: <CopyValue value={deal.reference} label={PROTECTED_FUNDING_ROWS.reference} copied={PROTECTED_COPIED.reference} />,
        },
      ]}
    />
  );

  switch (stage) {
    case "awaiting_transfer":
      return (
        <div className="nf-pp-screen" data-testid="pp-funding" data-stage={stage}>
          <ScreenHead eyebrow={PROTECTED_FUNDING_EYEBROW} stage={stage} title={PROTECTED_STAGE_LABEL[stage]} />
          <AmountHero minor={deal.amountMinor} locale={locale} caption={PROTECTED_FUNDING_EXACT} />
          {deal.funding ? (
            <>
              <DetailRows
                sunken
                rows={[
                  { label: PROTECTED_FUNDING_ROWS.bank, value: deal.funding.bank },
                  { label: PROTECTED_FUNDING_ROWS.accountName, value: deal.funding.accountName },
                  {
                    label: PROTECTED_FUNDING_ROWS.accountNumber,
                    value: (
                      <CopyValue
                        value={deal.funding.accountNumber}
                        label={PROTECTED_FUNDING_ROWS.accountNumber}
                        copied={PROTECTED_COPIED.accountNumber}
                        testId="pp-account-number"
                      />
                    ),
                  },
                  {
                    label: PROTECTED_FUNDING_ROWS.reference,
                    value: <CopyValue value={deal.reference} label={PROTECTED_FUNDING_ROWS.reference} copied={PROTECTED_COPIED.reference} />,
                  },
                ]}
              />
              <TransferClock expiresAt={deal.funding.expiresAt} now={now} />
            </>
          ) : null}
          <p className="nf-pp-notice" data-tone="attention">
            <UiIcon name="info" size={18} weight="lean" />
            {PROTECTED_FUNDING_WARNING}
          </p>
          <div className="nf-pp-actions">
            <Button variant="primary" size="lg" full onClick={actions.reportTransfer} loading={pending} data-testid="pp-reported">
              {PROTECTED_FUNDING_CTA}
            </Button>
            <p className="nf-pp-fine nf-pp-fine--center">{PROTECTED_FUNDING_CTA_NOTE}</p>
          </div>
          {timeline}
        </div>
      );

    case "confirming":
      return (
        <div className="nf-pp-screen" data-testid="pp-waiting" data-stage={stage}>
          <div className="nf-pp-orbit" aria-hidden="true">
            <span />
            <UiIcon name="bank" size={30} weight="lean" />
          </div>
          <ScreenHead stage={stage} title={PROTECTED_WAITING_TITLE} lead={<p>{PROTECTED_WAITING_BODY}</p>} />
          {stillWaiting ? (
            <p className="nf-pp-notice" role="status">
              <UiIcon name="clock" size={18} weight="lean" />
              {PROTECTED_STILL_WAITING}
            </p>
          ) : null}
          <DetailRows
            rows={[
              { label: PROTECTED_FUNDING_ROWS.reference, value: deal.reference },
              { label: PROTECTED_REVIEW_ROWS.amount, value: amount, strong: true },
              ...(deal.funding ? [{ label: PROTECTED_FUNDING_ROWS.bank, value: `${deal.funding.bank}, ${deal.funding.accountNumber}` }] : []),
            ]}
          />
          {deal.lastCheckedAt ? <p className="nf-pp-fine">{protectedLastUpdated(lagosTime(deal.lastCheckedAt, locale) ?? "")}</p> : null}
          <p className="nf-pp-fine">{PROTECTED_WAITING_CLOSE}</p>
          <div className="nf-pp-actions">
            <Button variant="secondary" size="lg" full onClick={actions.refresh} loading={pending} data-testid="pp-refresh">
              {PROTECTED_WAITING_REFRESH}
            </Button>
            {help}
          </div>
          {timeline}
        </div>
      );

    case "protected":
      return <HeroAndMilestone deal={deal} stage={stage} actions={actions} pending={pending} timeline={timeline} amount={amount} />;

    case "expired":
      return (
        <StateScreen stage={stage} icon="alert-triangle" title={PROTECTED_EXPIRED_TITLE} body={PROTECTED_EXPIRED_BODY} testId="pp-expired">
          {reference}
          <div className="nf-pp-actions">
            <Button variant="primary" size="lg" full onClick={actions.newDetails} loading={pending}>
              {PROTECTED_EXPIRED_CTA}
            </Button>
            {help}
          </div>
        </StateScreen>
      );

    case "release_processing":
      return (
        <StateScreen stage={stage} icon="hand-coins" title={PROTECTED_RELEASE_PROCESSING_TITLE} body={PROTECTED_RELEASE_PROCESSING_BODY} testId="pp-release">
          <PlaceCard place={deal.place} amount={amount} />
          {timeline}
        </StateScreen>
      );

    case "released":
    case "refunded":
      return (
        <StateScreen
          stage={stage}
          icon={stage === "released" ? "circle-check" : "receipt"}
          title={stage === "released" ? PROTECTED_RELEASED_TITLE : PROTECTED_REFUNDED_TITLE}
          body={stage === "released" ? PROTECTED_RELEASED_BODY : PROTECTED_REFUNDED_BODY}
          testId={stage === "released" ? "pp-released" : "pp-refunded"}
        >
          <PlaceCard place={deal.place} amount={amount} />
          {reference}
          {deal.links.receipt ? (
            <div className="nf-pp-actions">
              <ButtonLink href={deal.links.receipt} variant="primary" size="lg" full>
                {PROTECTED_DOWNLOAD_RECEIPT}
              </ButtonLink>
            </div>
          ) : null}
          {timeline}
        </StateScreen>
      );

    case "disputed":
      return (
        <StateScreen stage={stage} icon="scale" title={PROTECTED_DISPUTE_TITLE} body={PROTECTED_DISPUTE_BODY} testId="pp-dispute">
          <PlaceCard place={deal.place} amount={amount} />
          <InfoCard icon="info" title={PROTECTED_NEXT_TITLE}>
            <p>{PROTECTED_DISPUTE_NEXT}</p>
          </InfoCard>
          <div className="nf-pp-actions">
            <Button variant="primary" size="lg" full onClick={actions.raiseProblem}>
              {PROTECTED_DISPUTE_ADD}
            </Button>
            {help}
          </div>
          {timeline}
        </StateScreen>
      );

    case "refund_processing":
      return (
        <StateScreen stage={stage} icon="repost-loop" title={PROTECTED_REFUND_PROCESSING_TITLE} body={PROTECTED_REFUND_PROCESSING_BODY} testId="pp-refunding">
          <PlaceCard place={deal.place} amount={amount} />
          {reference}
          {timeline}
        </StateScreen>
      );

    case "requires_review":
      return (
        <StateScreen stage={stage} icon="user-check" title={PROTECTED_REVIEW_STATE_TITLE} body={PROTECTED_REVIEW_STATE_BODY} testId="pp-review-state">
          {reference}
          <div className="nf-pp-actions">{help}</div>
          {timeline}
        </StateScreen>
      );

    case "failed":
      return (
        <StateScreen stage={stage} icon="circle-x" title={PROTECTED_FAILED_TITLE} body={PROTECTED_FAILED_BODY} testId="pp-failed">
          {reference}
          <div className="nf-pp-actions">{help}</div>
        </StateScreen>
      );
  }
}

/** A state screen: a plate with the state's icon, the pill, a title, a body. */
function StateScreen({
  stage,
  icon,
  title,
  body,
  testId,
  children,
}: {
  stage: ProtectedStage;
  icon: "alert-triangle" | "hand-coins" | "circle-check" | "receipt" | "scale" | "repost-loop" | "user-check" | "circle-x";
  title: string;
  body: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nf-pp-screen" data-testid={testId} data-stage={stage}>
      <span className="nf-pp-mark" aria-hidden="true">
        <UiIcon name={icon} size={30} weight="lean" />
      </span>
      <ScreenHead stage={stage} title={title} lead={<p>{body}</p>} />
      {children}
    </div>
  );
}

/** SCREEN 5 AND 6: the money held, and the category's own milestone. */
function HeroAndMilestone({
  deal,
  stage,
  actions,
  pending,
  timeline,
  amount,
}: {
  deal: ProtectedDeal;
  stage: ProtectedStage;
  actions: ProtectedActions;
  pending: boolean;
  timeline: React.ReactNode;
  amount: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const milestone = PROTECTED_MILESTONE[deal.milestone];
  return (
    <div className="nf-pp-screen" data-testid="pp-protected" data-stage={stage}>
      <div className="nf-pp-shield" aria-hidden="true">
        <UiIcon name="shield-check" size={44} weight="lean" />
      </div>
      <ScreenHead eyebrow={PROTECTED_HERO_EYEBROW} stage={stage} title={PROTECTED_HERO_TITLE} lead={<p>{PROTECTED_HERO_PROMISE[deal.milestone]}</p>} />
      <PlaceCard place={deal.place} amount={amount} />
      {timeline}

      <section className="nf-pp-milestone" aria-labelledby="pp-milestone-title" data-testid="pp-milestone">
        <h2 id="pp-milestone-title" className="nf-pp-milestone__title">
          {milestone.title}
        </h2>
        <p>{milestone.body}</p>
        {deal.dates ? <p className="nf-pp-fine">{deal.dates}</p> : null}
        <div className="nf-pp-actions">
          <Button variant="primary" size="lg" full onClick={() => setConfirming(true)} data-testid="pp-milestone-yes">
            {milestone.yes}
          </Button>
          <Button variant="secondary" size="lg" full onClick={actions.raiseProblem} data-testid="pp-milestone-problem">
            {PROTECTED_MILESTONE_PROBLEM}
          </Button>
        </div>
      </section>

      <InfoCard icon="clock" title={PROTECTED_WHEN_PAID_TITLE}>
        <p>{PROTECTED_WHEN_PAID[deal.milestone]}</p>
      </InfoCard>
      <InfoCard icon="bank" title={PROTECTED_WHERE_TITLE} testId="pp-custody">
        <p>{PROTECTED_FUNDS_WORDING_FULL}</p>
        <p>{PROTECTED_WHERE_VALLO}</p>
      </InfoCard>
      <div className="nf-pp-actions">
        <ButtonLink href={deal.links.agreement} variant="secondary" size="lg" full>
          {PROTECTED_VIEW_DETAILS}
        </ButtonLink>
        <Link href={deal.links.how} className="nf-pp-link">
          {PROTECTED_HOW_LINK}
        </Link>
      </div>

      <Sheet
        open={confirming}
        onOpenChange={setConfirming}
        title={PROTECTED_MILESTONE_CONFIRM_TITLE}
        description={PROTECTED_MILESTONE_CONFIRM_BODY}
        closeLabel={PROTECTED_NOT_YET}
        testId="pp-milestone-sheet"
        footer={
          <div className="nf-pp-actions">
            <Button
              variant="primary"
              size="lg"
              full
              loading={pending}
              onClick={() => {
                actions.confirmMilestone();
                setConfirming(false);
              }}
              data-testid="pp-milestone-confirm"
            >
              {PROTECTED_MILESTONE_CONFIRM_CTA}
            </Button>
            <Button variant="secondary" size="lg" full onClick={() => setConfirming(false)}>
              {PROTECTED_NOT_YET}
            </Button>
          </div>
        }
      >
        <PlaceCard place={deal.place} amount={amount} />
      </Sheet>
    </div>
  );
}
