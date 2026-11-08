import "@/app/(app)/circle/circle.css";
import { PostFlow } from "@/app/(app)/circle/_parts/PostFlow";

/** The Ask flow with sample communities. Publishing in the harness goes to the real action, which refuses without a session. */
export const dynamic = "force-dynamic";

export default async function PreviewCircleAsk({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <PostFlow
      pickType={q.pick === "1"}
      initialPosted={q.posted === "1" ? { id: "00000000-0000-4000-8000-0000000000aa", held: false } : null}
      presetCommunityId={q.posted === "1" ? "00000000-0000-4000-8000-000000000001" : null}
      mode="question"
      communities={[
        { id: "00000000-0000-4000-8000-000000000001", name: "Lekki renters" },
        { id: "00000000-0000-4000-8000-000000000002", name: "First-time renters in Lagos" },
      ]}
      closeHref="/preview/features"
    />
  );
}
