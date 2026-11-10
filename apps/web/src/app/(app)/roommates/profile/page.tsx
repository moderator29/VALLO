import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { listInstitutions, readMyRoommateProfile } from "@/lib/features/roommates/queries";

import { ProfileFlowScreen } from "./_parts/ProfileFlowScreen";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.profile.create}, ${copy.title}` };
export const dynamic = "force-dynamic";

/** The roommate profile flow: my profile and the school list, then the flow. */
export default async function RoommateProfileFlowPage() {
  const [read, schools] = await Promise.all([readMyRoommateProfile(), listInstitutions({ limit: 1500 })]);
  return <ProfileFlowScreen read={read} schools={schools.items} t={copy} />;
}
