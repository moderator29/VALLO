import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { readAgentEarnings, type AgentEarnings } from "@/lib/agent/earnings-queries";
import { getPayoutAccounts } from "@/lib/agent/payout-queries";
import { PayoutAccounts } from "@/components/agent/PayoutAccounts";
import { PepQuestionPanel } from "@/components/compliance/PepQuestionPanel";
import { ListingPitch } from "../list/ListingPitch";
import { EarningsWorkspace } from "./EarningsWorkspace";
import { ButtonLink } from "@/components/ui/Button";
import { readMyEarnings } from "@/lib/money/history";
import { parseBefore } from "@/lib/money/history-model";
import { EarningsHistory } from "@/components/app/money-history/EarningsHistory";
import { PayoutList } from "@/components/money/PayoutList";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { readMyChargebackHold } from "@/lib/money/chargeback-hold";
import { ChargebackHoldNotice } from "@/components/money/ChargebackHoldNotice";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agentEarnings.title, robots: { index: false, follow: false } };
}

const UNREADABLE_EARNINGS: AgentEarnings = {
  months: [],
  totalGrossMinor: 0,
  totalAgentShareMinor: 0,
  totalNetMinor: 0,
  settledStays: 0,
  currentMonth: null,
  readable: false,
};

/**
 * /agent/earnings: what has settled from the host's stays, read straight
 * from the ledger.
 *
 * Shaped like /agent/listings and /agent/bookings: the server page resolves
 * who is asking and reads under their own RLS-bound client, then hands the
 * figures to a plain rendering component. Nothing here mutates, so the
 * workspace stays a server component with no client JavaScript to ship.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/earnings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/earnings" profile={null}>
        <div className="mx-auto max-w-md py-section text-center">
          <IconPlate size="lg">
            <UiIcon name="bank" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-md">{t.agentEarnings.title}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            {t.agentEarnings.unconfigured}
          </p>
          <ButtonLink href="/agent/dashboard" variant="secondary" className="mt-lg">
            {t.agent.nav.dashboard}
          </ButtonLink>
        </div>
      </AgentShell>
    );
  }

  const before = parseBefore((await searchParams).before);
  const [earnings, payout, history, hold] = await Promise.all([
    readAgentEarnings(context).then((read) => read ?? UNREADABLE_EARNINGS),
    getPayoutAccounts(),
    readMyEarnings(before),
    readMyChargebackHold(),
  ]);

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/earnings"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      <PageFrame title={t.agentEarnings.title} subtitle={t.agentEarnings.lede} fallback="/agent/dashboard" width="wide">
      <div>

      {/* Chargebacks: the payout rule, said calmly, only when it applies. */}
      <ChargebackHoldNotice hold={hold} copy={t.chargebacks.hold} locale={locale} />

      <EarningsWorkspace t={t.agentEarnings} earnings={earnings} locale={locale} />

      {/*
        THE PAYMENT-BY-PAYMENT HISTORY, under the monthly ledger above.

        The ledger groups settled stays by month; this is each payment Paystack
        split to this lister and each refund that reversed part of one, read
        from `my_earnings_history` under their own session. Both are records
        of money that already moved, so neither offers anything to withdraw.
        A signed-out read cannot happen here (the context above is signed in),
        and if it somehow did the section is left out rather than drawn empty.
      */}
      {history.state !== "signed-out" && (
        <section id="history" aria-labelledby="nf-earnings-history" className="mt-section-tight">
          <h2 id="nf-earnings-history" className="nf-h3 mb-heading">
            Payments and reversals
          </h2>
          {/* D51 rule 4: each payment carries the same three figures the
              lister saw before publishing (what was paid, the platform fee,
              what they received), read from the record. The empty and
              unreadable states stay the history's own. */}
          {history.state === "ok" && history.entries.length > 0 ? (
            <>
              <PayoutList entries={history.entries} locale={locale} />
              {history.nextBefore ? (
                <ButtonLink
                  href={`/agent/earnings?before=${encodeURIComponent(history.nextBefore)}#history`}
                  variant="secondary"
                  size="md"
                  className="mt-row"
                >
                  Show earlier
                </ButtonLink>
              ) : null}
            </>
          ) : (
            <EarningsHistory
              read={history}
              before={before}
              basePath="/agent/earnings"
              locale={locale}
              next={{ href: "/agent/bookings", label: "See your bookings" }}
            />
          )}
        </section>
      )}

      {/* Seeing what you earned is only half of it. This is where it goes.
          Every state that is not "ready" is handled inside the read, and an
          unreadable one simply renders nothing rather than a broken panel. */}
      {/* SCUML item 20: the PEP question, asked where payouts are set up. */}
      {payout.state === "ready" && <PepQuestionPanel askedAt="payout" />}
      {payout.state === "ready" && (
        <PayoutAccounts
          success={t.success}
          accounts={payout.accounts}
          banks={payout.banks}
          resolveAvailable={payout.resolveAvailable}
        />
      )}
      </div>
      </PageFrame>
    </AgentShell>
  );
}
