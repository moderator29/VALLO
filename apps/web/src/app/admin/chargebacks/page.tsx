import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getChargebackDesk, readChargebackQuery } from "@/lib/admin/reads/chargebacks";
import { readPage } from "@/lib/admin/reads/money-derive";
import { ChargebacksDesk } from "./ChargebacksDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.chargebacks.desk.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Money > Chargebacks: every card payment a payer's bank reversed, worked
 * from opened to won, or to lost and recovered (`ChargebacksDesk.tsx`).
 *
 * The door is `requireAdmin("finance")`: an admin, or a staff member holding
 * the finance scope, exactly the people `public.staff_chargebacks` and
 * `private.chargeback_actor_ok` admit. Anybody else gets the site's ordinary
 * 404. The reads are `lib/admin/reads/chargebacks.ts`; the moves are
 * `lib/admin/chargeback-actions.ts`.
 */
export default async function AdminChargebacksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const params = await searchParams;
  const query = readChargebackQuery(params);
  const read = await getChargebackDesk();
  const reference = Array.isArray(params.reference) ? params.reference[0] : params.reference;

  return (
    <ChargebacksDesk
      query={query}
      read={read}
      page={readPage(params.page)}
      now={requestTime()}
      copy={t.chargebacks.desk}
      locale={locale}
      prefill={reference?.trim().slice(0, 200) || null}
    />
  );
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
