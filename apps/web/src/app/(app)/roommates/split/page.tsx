import type { Metadata } from "next";

import { PageFrame } from "@/components/app/PageFrame";
import { getDictionary } from "@vallo/i18n";
import { ROOMMATES_ROUTES, type Period } from "@/lib/features/roommates/model";
import { readMyActiveGroups } from "@/lib/features/roommates/queries";
import { getLocale } from "@/lib/locale";

import { SplitCalculator } from "./SplitCalculator";
import "../groups/_parts/fe-b.css";

export const metadata: Metadata = { title: "Cost splitter" };
export const dynamic = "force-dynamic";

/**
 * THE COST SPLITTER (FE-B). Pure arithmetic on the member's own figures
 * (`splitCosts` in the model), always labelled as an estimate. A listing can
 * link in with `?rent=<kobo>&period=year|month&people=<1..8>`; a member in a
 * group can post the result to the group's board.
 */
export default async function RoommateSplitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const locale = await getLocale();
  const R = getDictionary(locale).roommates;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const rentRaw = Number(one(params.rent));
  const rent = Number.isFinite(rentRaw) && rentRaw > 0 ? Math.min(Math.round(rentRaw), 1_000_000_000_00) : null;
  const period: Period = one(params.period) === "month" ? "month" : "year";
  const peopleRaw = Number(one(params.people));
  const people = Number.isInteger(peopleRaw) && peopleRaw >= 1 && peopleRaw <= 8 ? peopleRaw : 2;
  const groups = await readMyActiveGroups();
  return (
    <PageFrame title={R.split.title} subtitle={R.split.intro} fallback={ROOMMATES_ROUTES.home} width="wide">
      <SplitCalculator initial={{ rentMinor: rent, period, people }} groups={groups} />
    </PageFrame>
  );
}
