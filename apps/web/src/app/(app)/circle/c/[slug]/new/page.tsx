import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { readCommunity } from "@/lib/features/circle/queries";

import { PostFlow } from "../../../_parts/PostFlow";

export const metadata: Metadata = { title: "Start a discussion" };
export const dynamic = "force-dynamic";

/** Start a discussion in one community (members only; the database holds that rule too). */
export default async function NewDiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await readCommunity(slug);
  if (!page) notFound();
  if (!page.signedIn) redirect(`/sign-in?next=/circle/c/${slug}/new`);
  if (page.membership?.status !== "active") redirect(`/circle/c/${slug}`);
  return (
    <PostFlow
      mode="discussion"
      communities={[{ id: page.community.id, name: page.community.name }]}
      presetCommunityId={page.community.id}
      closeHref={`/circle/c/${slug}`}
    />
  );
}
