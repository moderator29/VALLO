import "@/app/(app)/circle/circle.css";
import { CommunityScreen } from "@/app/(app)/circle/_parts/CommunityScreen";

import { NOW, POSTS, communityPage } from "../circle-fixtures";

/** A community with sample rows: `?as=member` (default), `visitor`, `private`, `owner`, `?empty=1`. Fictional people only. */
export const dynamic = "force-dynamic";

export default async function PreviewCircleCommunity({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const as = q.as === "visitor" || q.as === "private" || q.as === "owner" ? q.as : "member";
  const empty = q.empty === "1";
  return (
    <div className="px-md">
      <CommunityScreen
        page={communityPage(as)}
        posts={{ live: true, posts: empty ? [] : POSTS, next: empty ? null : "x" }}
        sort={q.sort === "popular" || q.sort === "unanswered" ? q.sort : "newest"}
        now={NOW}
        fallback="/preview/features"
      />
    </div>
  );
}
