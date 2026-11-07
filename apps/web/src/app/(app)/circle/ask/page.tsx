import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { readListingForAsk, readMyCommunities } from "@/lib/features/circle/queries";

import { PostFlow } from "../_parts/PostFlow";

export const metadata: Metadata = { title: CIRCLE_COPY.ask };
export const dynamic = "force-dynamic";

/**
 * ASK THE COMMUNITY. `?community=` starts in that community; `?listing=`
 * attaches a live listing ("Ask about this place", never a draft).
 */
export default async function AskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const mine = await readMyCommunities();
  if (!mine.signedIn) redirect("/sign-in?next=/circle/ask");
  const preset = typeof query.community === "string" && mine.communities.some((c) => c.id === query.community) ? query.community : null;
  const listing = await readListingForAsk(query.listing);
  return (
    <PostFlow
      mode="question"
      communities={mine.communities.map((c) => ({ id: c.id, name: c.name }))}
      presetCommunityId={preset}
      closeHref="/circle"
      listingId={listing?.id ?? null}
      prefillTitle={listing ? `What is it like to live around ${listing.area ?? listing.title}?` : null}
    />
  );
}
