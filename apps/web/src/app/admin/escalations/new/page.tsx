import type { Metadata } from "next";
import Link from "next/link";
import { getEscalationCounts } from "@/lib/admin/escalations/read";
import { getLocale } from "@/lib/locale";
import { NewEscalation, readNewEscalationQuery } from "../NewEscalation";

export const metadata: Metadata = { title: "Raise an escalation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * `/admin/escalations/new?category=&record=&label=`: the escalation form as a
 * page, prefilled from the address. THIS ADDRESS IS A CONTRACT: other desks
 * link here (the ID cross-check panel sends `category=identity_fraud` with
 * the person's record), so the three names do not change.
 *
 *   category  one of the escalation categories; anything else is ignored
 *   record    a path inside the console (begins `/admin/`); anything else is dropped
 *   label     what the attached link is called
 */
export default async function NewEscalationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale, counts] = await Promise.all([searchParams, getLocale(), getEscalationCounts()]);
  return (
    <NewEscalation
      query={readNewEscalationQuery(params)}
      counts={counts}
      locale={locale}
      back={
        <Link href="/admin/escalations" className="nf-admin-panel__link" data-testid="escalation-back">
          All escalations
        </Link>
      }
    />
  );
}
