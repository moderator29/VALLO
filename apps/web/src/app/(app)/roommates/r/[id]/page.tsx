import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readMyActiveGroups, readRoomListing } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { RoomListingScreen } from "./_parts/ListingScreen";

const t = getDictionary("en").roommates;

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const read = await readRoomListing((await params).id);
  return { title: read.state === "ok" ? `${read.listing.title}, ${t.title}` : t.title };
}

/** A room post: the read, the viewer's groups for the shortlist, then the screen. */
export default async function RoomListingPage({ params }: Props) {
  const { id } = await params;
  const [read, groups] = await Promise.all([readRoomListing(id), readMyActiveGroups()]);
  return <RoomListingScreen read={read} groups={groups} t={t} now={requestNow()} />;
}
