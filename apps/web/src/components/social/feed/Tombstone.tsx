import { POST_COPY } from "@/lib/social/posts-model";

/**
 * What is left of a deleted post INSIDE A CONVERSATION, and nowhere else.
 *
 * The founder, 23 September (item 4): "A deleted post is deleted ... The only
 * place a tombstone is ever acceptable is inside a conversation that would
 * otherwise break, where somebody replied to it. Nowhere else, and never on a
 * profile."
 *
 * So this is drawn by the thread view alone (`app/(app)/post/[id]/ThreadView`),
 * for a removed post that `getThread` kept because a reply that is still there
 * hangs off it. `PostCard` draws nothing for a removed post, and every listing
 * read (feed, profile tabs, media grid, activity) excludes removed rows at the
 * query. `lib/social/tombstone-placement.test.ts` fails the build of anybody
 * who imports this anywhere else.
 *
 * The row survives in the database on purpose: `posts.parent_id` is ON DELETE
 * CASCADE, so a hard delete would take other people's replies with it.
 */
export function Tombstone({ replyCount = 0 }: { replyCount?: number }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--nf-border-default)] px-md py-sm">
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
        <span className="font-semibold text-[var(--nf-content-secondary)]">
          {POST_COPY.removed}
        </span>
        {replyCount > 0 ? ` ${POST_COPY.removedReplies}` : null}
      </p>
    </div>
  );
}
