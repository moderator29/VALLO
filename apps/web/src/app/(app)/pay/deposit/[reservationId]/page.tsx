import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { ResultScreen } from "@/components/app/ResultSheet";
import { DepositPageBody } from "@/components/app/reservations/DepositPageBody";
import { readGuestDeposit } from "@/lib/reservations/guest-deposit";
import { isDepositReference } from "@/lib/payments/references";
import { withNext } from "@/lib/auth/next-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).tableDeposits.page.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /pay/deposit/[reservationId]: one table deposit, for the guest who asked
 * for the table (track/restaurant-deposits). Where Paystack sends the guest
 * back (`?ref=`), where every deposit notice points, and where the receipt
 * lives. Read under the guest's own session (`readGuestDeposit`), so another
 * person's table is simply not found.
 */
export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reservationId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const t = getDictionary(locale);
  const w = t.tableDeposits.page;
  const read = await readGuestDeposit(reservationId);
  const ref = typeof query.ref === "string" && isDepositReference(query.ref) ? query.ref : null;

  return (
    <PageFrame title={w.title} fallback="/bookings" width="narrow">
      {read.state === "signed-out" ? (
        <ResultScreen
          state="sign-in"
          verdict={w.signedOutTitle}
          consequence={w.signedOutBody}
          actions={[{ label: w.signIn, href: withNext("/sign-in", `/pay/deposit/${reservationId}`), tone: "primary" }]}
        />
      ) : read.state === "missing" ? (
        <ResultScreen
          state="missing"
          verdict={w.notFoundTitle}
          consequence={w.notFoundBody}
          actions={[{ label: w.backToBookings, href: "/bookings?side=stays&from=stays", tone: "primary" }]}
        />
      ) : (
        <DepositPageBody
          view={read.view}
          t={{ deposits: t.tableDeposits, counts: t.counts, venueFallback: t.restaurantPage.fallbackTitle }}
          locale={locale}
          returnReference={ref}
        />
      )}
    </PageFrame>
  );
}
