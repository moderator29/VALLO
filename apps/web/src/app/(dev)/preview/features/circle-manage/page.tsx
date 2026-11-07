import "@/app/(app)/circle/circle.css";
import { ManageScreen } from "@/app/(app)/circle/_parts/ManageScreen";

import { NOW, REQUESTS, communityPage } from "../circle-fixtures";

/** Join requests with sample rows (`?empty=1`: nobody waiting). Fictional people only. */
export const dynamic = "force-dynamic";

export default async function PreviewCircleManage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const empty = (await searchParams).empty === "1";
  return (
    <div className="px-md">
      <ManageScreen community={communityPage("private").community} requests={empty ? [] : REQUESTS} now={NOW} fallback="/preview/features" />
    </div>
  );
}
