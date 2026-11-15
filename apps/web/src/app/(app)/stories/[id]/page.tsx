import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveSession } from "@/lib/actions/session";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { reportWordsOf } from "@/components/social/sheet-words";
import {
  getStory,
  getStoryComments,
  getStoryFaces,
  listStories,
} from "@/lib/social/stories-queries";
import { loadPublicProfile } from "@/lib/social/profiles-queries";
import { StoryViewer } from "@/components/social/story/StoryViewer";
import { SocialPaused } from "@/components/social/SocialPaused";
import { isSocialEnabled } from "@/lib/social/flag";

export const dynamic = "force-dynamic";

/* One read of the story per request, shared by the page and its title. The
   title used to make its own, a second round trip on every open. */
const readStory = cache(getStory);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await readStory(id);
  if (!story) return { title: "Story" };
  return {
    title: story.headline,
    description: story.standfirst ?? undefined,
  };
}

/**
 * One story.
 *
 * `/stories/[id]` is the address every notification links to, so this route is
 * load bearing rather than convenient. A story that does not resolve renders
 * the designed not found, whether it never existed, was removed, sits in a
 * paused place, or belongs to somebody who has blocked this reader. Telling
 * those apart would leak the existence of each, and `private.can_see_story`
 * already refuses all four the same way.
 */
export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /*
   * EVERYTHING AT ONCE (the founder, 15 November 2026: "when I click a story it
   * is slow to load, even on a fast network"). This was three waves in a row:
   * the social switch, then the story and the session, then the faces, the
   * comments, the rail and the author. Only the author's profile needs the
   * story first (for the handle), so everything else now starts together and
   * the page waits for one wave and a profile instead of three waves. The
   * faces take the like count only to say how many more there are, which is
   * worked out here once the story is in. Nothing read for a story this reader
   * may not see reaches them: a missing story is the not found below, and the
   * reads run under the reader's own access anyway.
   */
  const [enabled, story, session, rawFaces, comments, more] = await Promise.all([
    isSocialEnabled(),
    readStory(id),
    resolveSession(),
    getStoryFaces(id, 0),
    getStoryComments(id),
    listStories({ limit: 12 }),
  ]);
  if (!enabled) return <SocialPaused title="Story" />;
  if (!story) notFound();

  const author = story.author.handle ? await loadPublicProfile(story.author.handle) : null;
  const overflow = Math.max(0, story.likeCount - rawFaces.faces.length);

  return (
    <StoryViewer
      story={story}
      faces={rawFaces.faces}
      overflow={overflow}
      comments={comments}
      more={more}
      signedIn={session.state === "signed-in"}
      viewerId={session.state === "signed-in" ? session.user.id : null}
      viewerFollows={author?.state === "found" ? author.viewerFollows : false}
      reportWords={reportWordsOf(getDictionary(await getLocale()))}
    />
  );
}
