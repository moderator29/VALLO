import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { ArrangementsDesk } from "./ArrangementsDesk";
import { readArrangementFilter, readArrangementOps } from "./read";

export const metadata: Metadata = { title: "Protected payments", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Money > Protected payments (BUILD 7.11): the read-only arrangement
 * operations desk. `?show=review` keeps only the arrangements recorded as
 * requires review. The door and the read are `./read.ts`; this page draws.
 */
export default async function AdminArrangementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = readArrangementFilter(Array.isArray(params.show) ? params.show[0] : params.show);
  const [locale, read] = await Promise.all([getLocale(), readArrangementOps(filter)]);
  return <ArrangementsDesk read={read} filter={filter} locale={locale} />;
}
