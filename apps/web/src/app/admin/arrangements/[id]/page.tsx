import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { ArrangementRecord } from "../ArrangementRecord";
import { readArrangementRecord } from "../read-one";

export const metadata: Metadata = { title: "Protected payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Money > Protected payments > one payment (BUILD 7.11, the dispute desk):
 * the record and its trail, and the decision staff make on it. The door and
 * the read are `../read-one.ts`; the decision is `lib/admin/arrangement-actions.ts`.
 */
export default async function AdminArrangementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [locale, read] = await Promise.all([getLocale(), readArrangementRecord(id)]);
  return <ArrangementRecord read={read} locale={locale} />;
}
