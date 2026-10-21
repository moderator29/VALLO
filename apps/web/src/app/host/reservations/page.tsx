import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { billPayOn } from "@/lib/reservations/bill-pay";
import { readHostTableBoard } from "./board";
import { HostTablesBody } from "./HostTablesBody";
import { readDeskDeposits } from "@/lib/reservations/deposit-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.screens.tables, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/reservations: where a venue answers a table.
 *
 * THIS ROUTE WAS PROMISED BY THE DATABASE AND DID NOT EXIST.
 * `private.notify_reservation` has sent a business host here since M7, and the
 * only board that could answer a table was `/agent/bookings`, behind
 * `getAgentContext`, which requires an `agents` row. A restaurant owner
 * onboarded through the host wizard has a `businesses` row and no `agents`
 * row, so they could be sent a table, be notified about it, tap the
 * notification, and land on a 404 with a guest waiting for an answer.
 *
 * The reader is `getHostReservations`, which leans on RLS alone and answers
 * for both spines, so this page never restates who owns which venue. See
 * `board.ts` for the one thing this surface adds to it and why.
 */
export default async function HostReservationsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host/reservations", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          icon="concierge-bell"
          title={t.hostWorkspace.reservations.signedOutTitle}
          body={t.hostWorkspace.reservations.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  /* One instant for the whole render: the board's split, Lagos today and the
     client's own cut all agree on it. */
  const now = new Date();
  /* D75: the deposit card, only while `restaurant_deposits` is on (read on
     the server, failing closed); null leaves the desk as it was. */
  const [read, deposits, billsOn] = await Promise.all([readHostTableBoard(now), readDeskDeposits(), billPayOn()]);

  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide>
      <HostTablesBody
        copy={t.hostWorkspace}
        words={t.experienceHost}
        desk={t.tableDesk}
        locale={locale}
        now={now}
        /* A bill is entered on the desk only when the guest could then pay it
           through Vallo (`restaurant_bill_pay` on and Paystack configured);
           until then they pay the venue. */
        billsOn={billsOn}
        board={read.state === "ok" ? read.board : null}
        unavailable={read.state === "unavailable"}
        deposits={deposits}
        depositWords={t.tableDeposits.desk}
      />
    </HostShell>
  );
}
