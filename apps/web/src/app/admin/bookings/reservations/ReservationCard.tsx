import { plural, type PluralForms } from "@vallo/i18n/core";
import { BOOKING_STATUSES, type AdminReservationRow } from "@/lib/admin/bookings-queries";
import type { ReservationDecision } from "@/lib/admin/schema";
import type { AdminUi } from "../../_components/ui";
import type { QueueStatusOption } from "../../_components/QueueFilters";
import { ReservationDecisions } from "./ReservationDecisions";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

/**
 * The reservation desk's rows, out of the page so the preview harness draws
 * the same card the desk draws. A page file may export only what Next allows,
 * which is why these live beside it rather than in it.
 */

/** The same five chips as the stays board: the table reuses the enum. */
export function reservationStatusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return BOOKING_STATUSES.map((value) => ({ value, label: ui.statusLabel(value) }));
}

/** Which decisions a row can take. The action re-proves it against the row. */
export function offersFor(row: AdminReservationRow): ReservationDecision[] {
  if (row.past) return [];
  if (row.status === "PENDING") return ["confirm", "decline"];
  if (row.status === "CONFIRMED") return ["cancel"];
  return [];
}

/**
 * One table, under the console's eye.
 *
 * A host answers a request from their own board and, when they do not, the
 * guest waits on a table nobody has said yes or no to. This card is where an
 * operator sees that and answers on the host's behalf, and where a confirmed
 * table can be called off by Vallo with a reason the guest reads.
 */
export function TableCard({
  row,
  ui,
  guestsWord,
}: {
  row: AdminReservationRow;
  ui: AdminUi;
  guestsWord: PluralForms;
}) {
  const guest = row.guestName ?? "A guest without a display name";
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip status={row.status} />
        {row.past && row.status !== "CANCELLED" && (
          <ui.StatusChip label="Time has passed" tone="neutral" />
        )}
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Asked {ui.when(row.createdAt)}
        </span>
      </div>

      {/* THE ROW CARRIES ITS PLATED GLYPH, as the governing render shows
          one on every queue row. A restaurant's table is the concierge
          bell. */}
      <h3 className="mt-xs flex items-center gap-inline text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
        <IconPlate size="sm">
          <UiIcon name="concierge-bell" size={20} />
        </IconPlate>
        <span className="min-w-0">{row.placeName}</span>
      </h3>
      <p className="mt-3xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
        {ui.when(row.reservedFor)}
        {" · "}
        {guest}
        {" · "}
        {plural(row.partySize, guestsWord, "en")}
      </p>
      {row.note && (
        <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {row.note}
        </p>
      )}
      {/* THE ID IS NEVER CLIPPED. It is what a guest quotes and what an operator
          pastes into the search box or a colleague's message. */}
      <p className="mt-xs font-mono text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)] [overflow-wrap:anywhere] [user-select:all]">
        {row.id}
      </p>

      <ReservationDecisions
        reservationId={row.id}
        guestName={guest}
        placeName={row.placeName}
        offers={offersFor(row)}
      />
    </li>
  );
}

/** One of the board's three groups. Renders nothing when the group is empty. */
export function ReservationGroup({
  title,
  rows,
  ui,
  guestsWord,
}: {
  title: string;
  rows: AdminReservationRow[];
  ui: AdminUi;
  guestsWord: PluralForms;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-xl first:mt-0">
      <h2 className="nf-admin-section-title">{title}</h2>
      <ul className="nf-queue-list">
        {rows.map((row) => (
          <TableCard key={row.id} row={row} ui={ui} guestsWord={guestsWord} />
        ))}
      </ul>
    </section>
  );
}
