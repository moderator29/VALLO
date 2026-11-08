import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { readRoommatesHub } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";

import { RoommatesHubView, readTab } from "./_parts/HubView";

export const metadata: Metadata = { title: "My roommates" };
export const dynamic = "force-dynamic";

/** My roommates: the hub read and the tab from the address, then the screen (`_parts/HubView.tsx`). */
export default async function RoommatesHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [hub, locale] = await Promise.all([readRoommatesHub(), getLocale()]);
  if (hub.live && !hub.signedIn) redirect(withNext("/sign-in", ROOMMATES_ROUTES.hub));
  return <RoommatesHubView hub={hub} tab={readTab(params.tab)} now={requestNow()} locale={locale} />;
}
