import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { readCommunity, readJoinRequests } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";

import { ManageScreen } from "../../../_parts/ManageScreen";

export const metadata: Metadata = { title: "Join requests" };
export const dynamic = "force-dynamic";

/** Join requests for a private community, for its owner and moderators only (RLS shows nobody else any). */
export default async function ManageCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await readCommunity(slug);
  if (!page) notFound();
  if (!page.signedIn) redirect(`/sign-in?next=/circle/c/${slug}/manage`);
  const runner = page.membership?.status === "active" && (page.membership.role === "owner" || page.membership.role === "moderator");
  if (!runner) redirect(`/circle/c/${slug}`);
  const requests = await readJoinRequests(page.community.id);
  return <ManageScreen community={page.community} requests={requests} now={requestNow()} />;
}
