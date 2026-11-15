import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getEscalationCounts, listEscalations } from "@/lib/admin/escalations/read";
import { readEscalationView } from "@/lib/admin/escalations/types";
import { EscalationsDesk } from "./EscalationsDesk";

export const metadata: Metadata = { title: "Escalations", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The request's clock, read once so every "due in" on the page agrees. */
function requestTime(): number {
  return Date.now();
}

/**
 * `/admin/escalations`: what waits on me, what I raised and, for the COO and
 * the super admin, everything (`?view=mine`, `?view=all`). Open to every
 * member of staff the console admits: the door and the reads are
 * `lib/admin/escalations/read.ts`, and the database answers only what the
 * caller may see. This page draws.
 */
export default async function AdminEscalationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = readEscalationView(Array.isArray(params.view) ? params.view[0] : params.view);
  const [locale, read, counts] = await Promise.all([getLocale(), listEscalations(view), getEscalationCounts()]);
  return (
    <EscalationsDesk
      read={read}
      view={view}
      canSeeAll={counts.state === "ok" && counts.data.canSeeAll}
      waiting={counts.state === "ok" ? counts.data.waiting : null}
      now={requestTime()}
      locale={locale}
    />
  );
}
