import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readMyActiveGroups, readMyIdentityState, readMyListingReviews, readRoomListing } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { RoomListingScreen } from "./_parts/ListingScreen";

const copy = getDictionary("en").roommates;

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const read = await readRoomListing((await params).id);
  return { title: read.state === "ok" ? `${read.listing.title}, ${copy.title}` : copy.title };
}

/** A room post: the read, the viewer's groups for the shortlist, then the screen. */
export default async function RoomListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  /* `?viewing=1` (the hub's link) opens the viewing request on arrival. */
  const openViewing = (await searchParams).viewing === "1";
  const [read, groups, reviews, identity] = await Promise.all([readRoomListing(id), readMyActiveGroups(), readMyListingReviews([id]), readMyIdentityState()]);
  return <RoomListingScreen read={read} groups={groups} t={copy} now={requestNow()} openViewing={openViewing} review={reviews[id]} identity={identity} />;
}
