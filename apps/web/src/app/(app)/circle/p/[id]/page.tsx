import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { readThread } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";

import { ThreadScreen } from "../../_parts/ThreadScreen";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const thread = await readThread((await params).id);
  return { title: thread?.post.title || CIRCLE_COPY.title };
}

/**
 * A Circle post or question with its answers. The accepted answer first, then
 * the most helpful. Every answer carries `id="a-<id>"`, the anchor the
 * notifications open (`/circle/p/<id>#a-<answer>`).
 */
export default async function CircleThreadPage({ params }: Props) {
  const { id } = await params;
  const thread = await readThread(id);
  if (!thread) notFound();
  return <ThreadScreen thread={thread} now={requestNow()} />;
}
