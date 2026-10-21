import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostTablesBody } from "@/app/host/reservations/HostTablesBody";
import { ReserveTable } from "@/app/(app)/listing/[id]/ReserveTable";
import { DepositStep } from "@/components/app/reservations/DepositStep";
import { DepositPageBody } from "@/components/app/reservations/DepositPageBody";
import { PageHeader } from "@/components/app/PageHeader";
import { DESK_NOW } from "../restaurant-desk/fixtures";
import { DESK_DEPOSITS, GUEST_RULES, PREVIEW_WINDOWS, deskWithDeposits, guestDeposit } from "./fixtures";

/**
 * Restaurant table deposits (track/restaurant-deposits), from fixtures.
 * Real components, made-up rows. `?view=`:
 *
 *   desk        the table desk with the deposit settings card and deposit lines
 *   nopayout    the settings card when no bank account can take a deposit
 *   guest       the reservation form at a venue that asks a deposit (party of 4 shows it)
 *   free        the same form at a venue that sets no deposit (no payment step)
 *   step        the one step left after the request: pay by card
 *   page        the deposit page, owed
 *   paid        the deposit page after paying, with its receipt (confirmation)
 *   applied     the deposit page once it came off the bill
 */
export const dynamic = "force-dynamic";

export default async function PreviewRestaurantDeposits({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "desk";
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (view === "desk" || view === "nopayout") {
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide>
        <HostTablesBody
          copy={t.hostWorkspace}
          words={t.experienceHost}
          desk={t.tableDesk}
          locale={locale}
          now={DESK_NOW}
          board={deskWithDeposits()}
          deposits={view === "nopayout" ? { ...DESK_DEPOSITS, payoutReady: false } : DESK_DEPOSITS}
          depositWords={t.tableDeposits.desk}
        />
      </HostShell>
    );
  }

  const deposit = { rules: GUEST_RULES, windows: PREVIEW_WINDOWS, words: t.tableDeposits.guest, locale };
  return (
    <div className="mx-auto max-w-2xl px-md py-block">
      <PageHeader title={view === "page" || view === "paid" || view === "applied" ? t.tableDeposits.page.title : "Yellow Chilli Ikoyi"} fallback="/preview" />
      {view === "guest" || view === "free" ? (
        <ReserveTable
          businessId="00000000-0000-4000-8000-0000000d9000"
          windows={PREVIEW_WINDOWS}
          windowCopy={t.experienceDetail.window}
          success={t.success}
          deposit={view === "guest" ? deposit : null}
          copy={t.memberFlows}
          locale={locale}
        />
      ) : view === "step" ? (
        <DepositStep
          reservationId="00000000-0000-4000-8000-0000000d0001"
          due={{ amountMinor: 2_000_000, refundUntil: "2026-10-15T19:30:00.000Z", refundUntilHours: 24, perGuest: true }}
          party={4}
          words={t.tableDeposits.guest}
          locale={locale}
        />
      ) : (
        <DepositPageBody
          view={guestDeposit(view === "paid" ? "paid" : view === "applied" ? "applied" : "due")}
          t={{ deposits: t.tableDeposits, counts: t.counts, venueFallback: t.restaurantPage.fallbackTitle }}
          locale={locale}
          now={DESK_NOW}
        />
      )}
    </div>
  );
}
