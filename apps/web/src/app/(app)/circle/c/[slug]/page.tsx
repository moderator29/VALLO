import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { readSort } from "@/lib/features/circle/model";
import { readCirclePosts, readCommunity } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";

import { CommunityScreen } from "../../_parts/CommunityScreen";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await readCommunity((await params).slug);
  return { title: page ? page.community.name : CIRCLE_COPY.title, ...(page?.community.description ? { description: page.community.description } : {}) };
}

/** A community: who it is for, the live counts, join or ask, its posts sorted three ways. */
export default async function CommunityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const page = await readCommunity(slug);
  if (!page) notFound();
  const sort = readSort(query.sort);
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  const canRead = page.community.visibility === "public" || page.membership?.status === "active";
  const posts = canRead ? await readCirclePosts({ communityId: page.community.id, sort, cursor }) : { live: true, posts: [], next: null };
  return <CommunityScreen page={page} posts={posts} sort={sort} now={requestNow()} />;
}
