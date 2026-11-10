import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readMyActiveGroups, readProfileGallery, readRoommateProfile } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { RoommateProfileScreen } from "./_parts/ProfileScreen";

const copy = getDictionary("en").roommates;

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const read = await readRoommateProfile((await params).userId);
  return { title: read.state === "ok" ? `${read.profile.name}, ${copy.title}` : copy.title };
}

/** A roommate profile: the read, the viewer's groups for an invite, then the screen. */
export default async function RoommateProfilePage({ params }: Props) {
  const { userId } = await params;
  const [read, groups, gallery] = await Promise.all([readRoommateProfile(userId), readMyActiveGroups(), readProfileGallery(userId)]);
  return <RoommateProfileScreen read={read} groups={groups} t={copy} now={requestNow()} userId={userId} gallery={gallery.map((g) => g.url)} />;
}
