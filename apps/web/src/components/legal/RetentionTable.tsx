import { DocTable } from "@/components/docs/DocTable";
import { RETENTION_COLUMNS, RETENTION_SCHEDULE, RETENTION_STATUS } from "@/lib/legal/retention";

/**
 * THE RETENTION TABLE on the Privacy page. Draws `RETENTION_SCHEDULE` and
 * nothing typed by hand, so the page cannot drift from the schedule.
 */
export function RetentionTable() {
  return (
    <>
      <DocTable
        caption="How long Vallo keeps each kind of data"
        columns={[
          { key: "what", label: RETENTION_COLUMNS.what },
          { key: "period", label: RETENTION_COLUMNS.period },
          { key: "why", label: RETENTION_COLUMNS.why },
        ]}
        rows={RETENTION_SCHEDULE.map((row) => ({ id: row.id, cells: { what: row.what, period: row.period, why: row.why } }))}
      />
      <p>{RETENTION_STATUS}</p>
    </>
  );
}
