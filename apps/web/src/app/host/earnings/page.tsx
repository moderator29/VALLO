import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readMyEarnings } from "@/lib/money/history";
import { parseBefore } from "@/lib/money/history-model";
import { HOST_EARNINGS_EMPTY_BODY, HOST_EARNINGS_EMPTY_TITLE, HOST_STATEMENT_ROW_SUB, PAYOUT_ANSWER } from "@/lib/money/copy";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { PageFrame } from "@/components/app/PageFrame";
import { EarningsHistory } from "@/components/app/money-history/EarningsHistory";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { monthsWithLines } from "@/lib/host/statement";
import { HostInnerNav } from "@/components/host/HostInnerNav";
import { hostInnerNavCopy } from "@/components/host/host-inner-nav";
import { readMyChargebackHold } from "@/lib/money/chargeback-hold";
import { ChargebackHoldNotice } from "@/components/money/ChargebackHoldNotice";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.earnings.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/earnings: what guests' payments paid this host, payment by payment,
 * and any refund that reversed part of one.
 *
 * The same record the agent workspace shows (`my_earnings_history`, read under
 * the host's own session), in the host shell. Most hosts will open this before
 * their first guest has paid, so the empty state is the screen they meet
 * first, and it says the one thing a host needs to know about being paid on
 * Vallo: there is no payout to request. The moment a guest pays, Paystack
 * splits the charge and the host's share goes straight to the bank account
 * on their payout details.
 */
export default async function HostEarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const before = parseBefore((await searchParams).before);
  const [read, hold] = await Promise.all([readMyEarnings(before), readMyChargebackHold()]);
  /* C9: a statement for every month that has a payment in it, from the
     newest page of the same record. */
  const months = read.state === "ok" ? monthsWithLines(read.entries).slice(0, 12) : [];
  const tag = locale === "en" ? "en-NG" : locale;
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    /* The body's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostInnerNav active="earnings" {...hostInnerNavCopy(t)} />
      <PageFrame title={t.experienceHost.earnings.title} fallback="/host">
        <p className={`mb-block ${TYPE.body}`}>{PAYOUT_ANSWER}</p>
        {/* Chargebacks: the payout rule, said calmly, only when it applies. */}
        <ChargebackHoldNotice hold={hold} copy={t.chargebacks.hold} locale={locale} />
        {read.state === "signed-out" ? (
          <EmptyState
          heading="h1"
            icon="bank-column"
            title={t.experienceHost.earnings.signedOutTitle}
            body={HOST_EARNINGS_EMPTY_BODY}
            action={
              <ButtonLink href={authHref(returnHref("/host/earnings", "", "list"), "sign-in")} variant="primary" size="lg">
                {t.common.signIn}
              </ButtonLink>
            }
          />
        ) : (
          <EarningsHistory
            read={read}
            before={before}
            basePath="/host/earnings"
            locale={locale}
            emptyTitle={HOST_EARNINGS_EMPTY_TITLE}
            emptyBody={HOST_EARNINGS_EMPTY_BODY}
            next={{ href: "/host/reservations", label: t.experienceHost.earnings.seeReservations }}
          />
        )}
        {months.length > 0 ? (
          <ListGroup label={t.experienceHost.earnings.statements} className="mt-block" data-testid="host-statements">
            {months.map((month) => (
              <ListRow
                key={month}
                leading={
                  <IconPlate size="sm">
                    <UiIcon name="file-text" size={ICON_PLATE_GLYPH.sm} />
                  </IconPlate>
                }
                title={monthName.format(new Date(`${month}-01T12:00:00Z`))}
                sub={HOST_STATEMENT_ROW_SUB}
                href={`/host/earnings/statement?month=${month}`}
                chevron
              />
            ))}
          </ListGroup>
        ) : null}
      </PageFrame>
    </HostShell>
  );
}
