import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getVisitCalendar, getVisitDetail, readVisitQuery } from "@/lib/admin/reads/visits";
import { lagosDay } from "@/lib/visit-calendar/model";
import { VisitsDesk } from "./VisitsDesk";
import { requestNow } from "@/lib/format/when";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.visitOps.admin.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Bookings > Visits: every inspection request on the platform as a week or a
 * month calendar, with a read-only detail per visit (`VisitsDesk.tsx`).
 *
 * The door is `requireAdmin("operations")`: an admin, or a staff member who
 * holds the operations scope (the same scope that reads inspections on
 * Operations > In flight). Anybody else gets the site's ordinary 404, as the
 * provider checks do. The reads are `lib/admin/reads/visits.ts`.
 */
export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const today = lagosDay(requestNow());
  const query = readVisitQuery(await searchParams, today);
  const read = await getVisitCalendar(query);
  const open = read.state === "ok" && query.visit ? read.data.rows.find((row) => row.id === query.visit) : undefined;
  const detail = open ? await getVisitDetail(open.id) : null;

  return (
    <VisitsDesk
      query={query}
      today={today}
      read={read}
      detail={detail && detail.state === "ok" ? detail.data : null}
      copy={t.visitOps}
      locale={locale}
    />
  );
}
