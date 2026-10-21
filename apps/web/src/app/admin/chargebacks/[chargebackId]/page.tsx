import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getChargebackDetail } from "@/lib/admin/reads/chargebacks";
import { CalmNote } from "../../_components/panels";
import { ChargebackCase } from "../ChargebackCase";
import { CHARGEBACKS_BASE } from "../ChargebacksDesk";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.chargebacks.desk.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * One chargeback (`ChargebackCase.tsx`), behind the same door as the desk:
 * `requireAdmin("finance")`, the people the chargeback functions admit.
 */
export default async function AdminChargebackPage({ params }: { params: Promise<{ chargebackId: string }> }) {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.chargebacks.desk;
  const { chargebackId } = await params;
  const read = await getChargebackDetail(chargebackId);

  if (read.state !== "ok" || !read.data) {
    return (
      <div className="nf-console">
        <Link href={CHARGEBACKS_BASE} className="nf-chip mb-md inline-flex w-fit items-center gap-2xs">
          {copy.detail.back}
        </Link>
        <h1 className="sr-only">{read.state === "ok" ? copy.detail.goneTitle : copy.unavailableTitle}</h1>
        {read.state === "ok" ? (
          <CalmNote title={copy.detail.goneTitle} fills={copy.detail.goneBody} action={{ href: CHARGEBACKS_BASE, label: copy.showEvery }} />
        ) : (
          <CalmNote kind="error" title={copy.unavailableTitle} fills={copy.unavailableBody} />
        )}
      </div>
    );
  }

  return <ChargebackCase detail={read.data} now={requestTime()} copy={copy} overrideCopy={t.chargebacks.override} locale={locale} />;
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
