import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getEscalation } from "@/lib/admin/escalations/read";
import { EscalationRecordView } from "../EscalationRecordView";

export const metadata: Metadata = { title: "Escalation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The request's clock, read once so the clock and the actions agree. */
function requestTime(): number {
  return Date.now();
}

/**
 * `/admin/escalations/[id]`: one escalation as a short brief, with its
 * timeline and the actions this viewer may take. The read
 * (`getEscalation`) answers only the raiser, the people it is with, the COO
 * and the super admin; anybody else sees "no such escalation".
 */
export default async function AdminEscalationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [locale, read] = await Promise.all([getLocale(), getEscalation(id)]);
  return <EscalationRecordView read={read} now={requestTime()} locale={locale} />;
}
