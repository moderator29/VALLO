import { doorWords, requireDeskUser } from "@/lib/admin/my-desk/access";
import { canReview, weekCsv } from "@/lib/admin/weekly-reports/model";
import { readWeekTable } from "@/lib/admin/weekly-reports/queries";
import { isWeekStart, weekWindow } from "@/lib/admin/weekly-reports/week";
import { positionTitle } from "@/lib/admin/staff-positions";

export const dynamic = "force-dynamic";

/** One week of weekly reports as a plain CSV download, for admins, super admins and the COO. */
export async function GET(request: Request) {
  const door = await requireDeskUser();
  if (door.state !== "ok") return new Response(doorWords(door.state), { status: door.state === "signed-out" ? 401 : 403 });
  if (!canReview(door.who)) return new Response("Weekly reports are reviewed by admins, super admins and the COO.", { status: 403 });
  const asked = new URL(request.url).searchParams.get("week");
  const week = isWeekStart(asked) ? asked : weekWindow().weekStart;
  const table = await readWeekTable(door.db, week);
  if (table.state !== "ok") return new Response("The weekly reports could not be read just now.", { status: 503 });
  const body = weekCsv(
    table.data.map(({ person, report }) => ({
      name: person.name,
      roleLabel: person.kind === "super_admin" ? "Super admin" : person.kind === "admin" ? "Admin" : (positionTitle(person.position) ?? "Staff"),
      report,
    })),
  );
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="weekly-reports-${week}.csv"`,
      "cache-control": "no-store",
    },
  });
}
