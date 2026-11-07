import "@/app/(app)/circle/circle.css";
import { ThreadScreen } from "@/app/(app)/circle/_parts/ThreadScreen";

import { NOW, threadOf } from "../circle-fixtures";

/** A thread with sample rows: `?kind=question` (default, seen by the asker), `discussion`, `empty`, `visitor`. Fictional people only. */
export const dynamic = "force-dynamic";

export default async function PreviewCircleThread({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const k = (await searchParams).kind;
  const kind = k === "discussion" || k === "empty" || k === "visitor" ? k : "question";
  return (
    <div className="px-md">
      <ThreadScreen thread={threadOf(kind)} now={NOW} fallback="/preview/features" />
    </div>
  );
}
