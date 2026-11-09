import "@/app/(app)/circle/circle.css";
import { PostFlow } from "@/app/(app)/circle/_parts/PostFlow";

import { COMMUNITY } from "../circle-fixtures";

/** Start a discussion in one community (/circle/c/[slug]/new). Publishing in the harness refuses without a session. */
export const dynamic = "force-dynamic";

export default function PreviewCircleDiscussion() {
  return <PostFlow mode="discussion" communities={[{ id: COMMUNITY.id, name: COMMUNITY.name }]} presetCommunityId={COMMUNITY.id} closeHref="/preview/features" />;
}
