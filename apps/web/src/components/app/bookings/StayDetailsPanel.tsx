import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import type { StayDetails } from "@/lib/bookings/stay-details";

/**
 * D75: the trip page's "getting there" panel. Presentation is deliberately
 * plain (the stays restyle owns the look); what it shows is the database's
 * decision in `my_stay_details`: the address and the way in only once the
 * stay is paid, and a line saying so before.
 */
export function StayDetailsPanel({
  details,
  words: w,
}: {
  details: StayDetails;
  /** The panel's words (`memberFlows.stayDetails`). */
  words: Dictionary["memberFlows"]["stayDetails"];
}) {
  if (details.state === "unpaid") {
    return (
      <section className="nf-panel nf-panel--card mt-lg p-card" data-testid="stay-details-unpaid">
        <h2 className="nf-overline mb-sm text-[var(--nf-content-muted)]">{w.title}</h2>
        <p className="nf-body-sm text-[var(--nf-content-muted)]">{w.unpaid}</p>
      </section>
    );
  }
  if (details.state !== "ready") return null;

  const rows: [string, string][] = [];
  if (details.address) rows.push([w.address, details.areaCity ? `${details.address}, ${details.areaCity}` : details.address]);
  if (details.checkInFrom) rows.push([w.checkInFrom, details.checkInFrom]);
  if (details.checkOutBy) rows.push([w.checkOutBy, details.checkOutBy]);
  if (details.estateName) rows.push([w.estate, details.estateName]);
  if (details.gateDirections) rows.push([w.atGate, details.gateDirections]);
  if (details.securityPhone) rows.push([w.security, details.securityPhone]);
  if (details.accessCode) rows.push([w.accessCode, details.accessCode]);
  if (details.houseRules) rows.push([w.houseRules, details.houseRules]);

  return (
    <section className="nf-panel nf-panel--card mt-lg p-card" data-testid="stay-details">
      <h2 className="nf-overline mb-sm text-[var(--nf-content-muted)]">{w.title}</h2>
      {rows.length > 0 ? (
        <dl className="grid gap-row">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-inline">
              <dt className="nf-caption text-[var(--nf-content-muted)]">{label}</dt>
              <dd className="nf-body-sm text-[var(--nf-content-primary)]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="nf-body-sm text-[var(--nf-content-muted)]">{w.noDetails}</p>
      )}
      <Link href={details.messageHref} className="nf-btn nf-btn--glass nf-btn--sm mt-block" data-testid="stay-message-host">
        {details.hostName
          ? w.messageNamed.replace("{name}", details.hostName)
          : details.kind === "room"
            ? w.messageHotel
            : w.messageHost}
      </Link>
    </section>
  );
}
