import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { resolveSessionClaims } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { readMyConnections, readRoommateGroup } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";

import { GroupDashboardView, TABS, type Tab } from "./_parts/GroupDashboardView";

export const metadata: Metadata = { title: "Group" };
export const dynamic = "force-dynamic";

const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A group: the read, who is looking, the owner's connections, then the dashboard (`_parts/GroupDashboardView.tsx`). */
export default async function RoommateGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!uuidShape.test(id)) notFound();
  const query = await searchParams;
  const [read, locale, claims] = await Promise.all([readRoommateGroup(id), getLocale(), resolveSessionClaims()]);
  if (read.state === "signed-out") redirect(withNext("/sign-in", ROOMMATES_ROUTES.group(id)));
  const isOwner = read.state === "ok" && read.group.myState === "active" && read.group.myRole === "owner";
  const connections = isOwner ? await readMyConnections() : [];
  const tab = typeof query.tab === "string" && (TABS as readonly string[]).includes(query.tab) ? (query.tab as Tab) : null;
  return (
    <GroupDashboardView
      read={read}
      viewerId={claims.state === "signed-in" ? claims.userId : null}
      now={requestNow()}
      tab={tab}
      connections={connections}
      locale={locale}
    />
  );
}
