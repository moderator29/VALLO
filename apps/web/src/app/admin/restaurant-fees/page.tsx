import type { Metadata } from "next";
import { formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getRestaurantFees, monthWords } from "@/lib/admin/restaurant-fees";
import { billPayOn } from "@/lib/reservations/bill-pay";
import { adminUi } from "../_components/ui";
import { DisputeDecision } from "./DisputeDecision";

export const metadata: Metadata = {
  title: "Restaurant fees",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ANSWER_WORDS: Record<string, string> = {
  SEATED: "seated",
  NO_SHOW: "no-show",
  dined: "dined",
  did_not_dine: "did not dine",
};

/**
 * Founder decision D: restaurants list for free and pay per seated table.
 * This desk shows, per restaurant per month, the seated tables and guests and
 * what is owed, the bills paid through Vallo, and the disagreements a person
 * has to decide. Nothing here charges anybody; the invoice is sent by hand.
 */
export default async function RestaurantFeesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const [read, billsOn] = await Promise.all([getRestaurantFees(6), billPayOn()]);
  const money = (minor: number) => formatMoney(minor, locale, "NGN");

  const header = (
    <ui.QueueHeader
      title="Restaurant fees"
      lede="Seated tables per restaurant per month and what each owes. Booking a table is free for diners; restaurants pay per seated table."
      {...(read.state === "ok" ? { count: read.disputes.length } : {})}
    />
  );

  if (read.state === "not-ready") {
    return (
      <div className="nf-console">
        {header}
        <ui.QueueEmpty
          title="Not switched on yet"
          body="Seated tables are counted once the restaurant seating migration is applied. Nothing is owed until then."
          everHadRows={false}
        />
      </div>
    );
  }
  if (read.state !== "ok") {
    return (
      <div className="nf-console">
        {header}
        <ui.QueueUnavailable />
      </div>
    );
  }

  return (
    <div className="nf-console">
      {header}
      <p className="nf-caption mb-block">
        {money(read.feeMinor)} per seated table.{" "}
        {read.commissionBps === null
          ? "Paying the bill through Vallo is not available yet: the commission on paid bills has not been set."
          : `Commission on bills paid through Vallo: ${(read.commissionBps / 100).toFixed(2)}%.`}{" "}
        {/* The commission is set live, so without this line the desk read as
            if diners could already pay through Vallo. */}
        {billsOn ? "Bill payment through Vallo is on." : "Bill payment through Vallo is switched off (restaurant_bill_pay)."}
      </p>

      {read.disputes.length > 0 && (
        <section className="mb-block">
          <h2 className="nf-h4">Disagreements to decide</h2>
          <p className="nf-caption mt-inline-tight">
            Counting a no-show as seated sends any table deposit kept for it back to the guest&apos;s card, through the hourly refund.
          </p>
          <ul className="mt-row flex flex-col gap-row">
            {read.disputes.map((d) => (
              <li key={d.reservationId} className="nf-panel nf-panel--card nf-admin-card p-card">
                <p className="nf-body font-semibold">{d.businessName}</p>
                <p className="nf-caption mt-inline-tight">
                  {d.reservedFor
                    ? new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Lagos",
                      }).format(new Date(d.reservedFor))
                    : "Time not known"}
                  {d.partySize ? `, ${d.partySize} guests` : ""}
                </p>
                <p className="nf-body mt-row">
                  The restaurant said {ANSWER_WORDS[d.restaurantAnswer ?? ""] ?? "nothing"}; the diner said{" "}
                  {ANSWER_WORDS[d.dinerAnswer ?? ""] ?? "nothing"}.
                </p>
                <DisputeDecision reservationId={d.reservationId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {read.rows.length === 0 ? (
        <ui.QueueEmpty
          title="No seated tables yet"
          body="A restaurant's seated tables appear here as soon as a table is marked seated."
          everHadRows={false}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="nf-table w-full" data-testid="restaurant-fees">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Restaurant</th>
                <th scope="col">Seated tables</th>
                <th scope="col">Seated guests</th>
                <th scope="col">Owed</th>
                <th scope="col">Bills paid</th>
                <th scope="col">Commission</th>
              </tr>
            </thead>
            <tbody>
              {read.rows.map((r) => (
                <tr key={`${r.businessId}-${r.month}`}>
                  <td>{monthWords(r.month)}</td>
                  <td>{r.businessName}</td>
                  <td className="nf-numeric">{r.seatedTables}</td>
                  <td className="nf-numeric">{r.seatedGuests}</td>
                  <td className="nf-numeric">{money(r.feeMinor)}</td>
                  <td className="nf-numeric">{r.billsPaid}</td>
                  <td className="nf-numeric">{money(r.billCommissionMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
