"use client";

import { banner } from "@/lib/ui/toast";
import type { SheetWords } from "@/components/social/sheet-words";
import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { initial as initialOf } from "@/lib/text/initial";
import { Button } from "@/components/ui/Button";
import { usePathname, useRouter } from "next/navigation";
import { withNext } from "@/lib/auth/next-link";
import { PostCard, type PostView } from "@/components/social/feed/PostCard";
import { Composer } from "@/components/social/feed/Composer";
import { ReportSheet } from "@/components/social/ReportSheet";
import { DELETE_WORDS, DeleteSheet } from "@/components/social/DeleteSheet";
import { ActionSheet, actionsForPost } from "@/components/social/ActionSheet";
import { PostEditor } from "@/components/social/feed/PostEditor";
import { ViewportPost } from "@/components/social/feed/ViewportPost";
import { Expand } from "@/components/social/Expand";
import { Tombstone } from "@/components/social/feed/Tombstone";
import { leadProps } from "@/components/social/feed/lead";
import { feedback } from "@/lib/ui/feedback";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { sayNowSettleLater } from "@/lib/ui/optimistic";
import {
  blockUser,
  muteTarget,
  unblockUser,
  unmuteTarget,
  removePost,
  reportPost,
  toggleMark,
  toggleRepost,
} from "@/lib/social/posts-actions";
import { POST_COPY, POST_REPORT_REASONS } from "@/lib/social/posts-model";
import { countOf } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { setOrKeep } from "@/lib/offline/send-or-keep";

/** The phone could not keep a tap for later (storage refused): the change goes back. */
const OUTBOX_KEEP_FAILED = "You are offline, and this phone could not keep that for later.";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type ThreadReply = PostView & { depth: number; parentId: string | null; mutedAuthor: boolean };

type Thread = {
  root: PostView;
  replies: ThreadReply[];
};

/**
 * A thread.
 *
 * Replies are indented by depth and nothing else: no connecting line, no rail,
 * no bracket. Indentation alone is enough to read a three-deep conversation on
 * a 390px screen, and the depth cap exists precisely so it stays that way.
 *
 * A removed post keeps its place as a tombstone only while somebody's reply
 * still hangs off it, because a thread that suddenly starts halfway through is
 * a thread nobody can follow. A removed post nobody answered is not here at
 * all: `getThread` prunes it at the read.
 */
export function ThreadView({
  thread,
  signedIn,
  openReply = false,
  sheet,
}: {
  thread: Thread;
  signedIn: boolean;
  /** The post action sheet's two lines, from the server (`sheetWordsOf`). */
  sheet: SheetWords;
  /** Arrived from a card's comment glyph: open addressed to the root. */
  openReply?: boolean;
}) {
  const locale = useClientLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [root, setRoot] = useState(thread.root);
  const [replies, setReplies] = useState(thread.replies);
  const [replyingTo, setReplyingTo] = useState<string | null>(
    openReply ? thread.root.id : null,
  );
  /* The post a report sheet is open for. Reporting is a decision, not a tap. */
  const [reporting, setReporting] = useState<PostView | null>(null);
  /* The post currently being changed. One at a time: two open editors on one
     screen is two drafts somebody can lose. */
  const [editing, setEditing] = useState<string | null>(null);
  /* One sheet for the whole thread, holding the post it was opened for. */
  const [sheetFor, setSheetFor] = useState<PostView | null>(null);
  /* The post the delete slide is open for. */
  const [deleting, setDeleting] = useState<PostView | null>(null);
  /* Muted replies the reader has chosen to open anyway. Per reply, and it lasts
     as long as the page: a mute is a standing preference and unfolding one line
     is not a decision to undo it. */
  const [unfolded, setUnfolded] = useState<string[]>([]);
  /* The replies on the page when it opened. Only a reply that arrives after
     (yours, after the refresh) opens into the list (`Expand`). */
  const [firstReplies] = useState(() => new Set(thread.replies.map((reply) => reply.id)));
  const [, startTransition] = useSafeTransition();

  /*
   * The server is the truth. When a refresh brings a new thread, take it.
   *
   * Derived during render rather than in an effect, the same conversion as
   * `Feed` and `FilterDrawer`: in an effect the screen paints the previous
   * post and its replies for one frame after a refresh and then swaps both,
   * which on a thread somebody has just replied to shows them the state before
   * their reply. The comparison is by reference, exactly what the dependency
   * array was, so this resets on the same renders it always did and one commit
   * earlier.
   */
  const [lastThread, setLastThread] = useState(thread);
  if (thread !== lastThread) {
    setLastThread(thread);
    setRoot(thread.root);
    setReplies(thread.replies);
  }

  const patch = (id: string, next: Partial<PostView>) => {
    setRoot((r) => (r.id === id ? { ...r, ...next } : r));
    setReplies((all) => all.map((p) => (p.id === id ? { ...p, ...next } : p)));
  };

  const requireSignIn = () => {
    if (signedIn) return false;
    /* Back to this thread after signing in: sign-in reads only `next`. */
    router.push(withNext("/sign-in", pathname));
    return true;
  };

  const onLike = (post: PostView) => {
    if (requireSignIn()) return;
    const liked = !post.liked;
    /* One light tap when a like lands; taking it back is quiet. */
    if (liked) feedback("select");
    patch(post.id, { liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    startTransition(async () => {
      try {
        /* The heart has already moved. No signal, or a stall: the like is kept
           on the phone and sent when the signal returns, and nothing goes back. */
        const sent = await setOrKeep("like_post", post.id, liked, () => toggleMark({ postId: post.id, mark: "LIKE", want: liked }));
        if (sent.state === "kept") return;
        const result = sent.state === "sent" ? sent.result : null;
        if (!result || !result.ok) {
          patch(post.id, { liked: post.liked, likeCount: post.likeCount });
          banner.error(result && !result.ok ? result.error : OUTBOX_KEEP_FAILED);
          return;
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const onRepost = (post: PostView) => {
    if (requireSignIn()) return;
    const reposted = !post.reposted;
    patch(post.id, { reposted, repostCount: post.repostCount + (reposted ? 1 : -1) });
    startTransition(async () => {
      try {
        const sent = await setOrKeep("repost_post", post.id, reposted, () => toggleRepost({ postId: post.id, want: reposted }));
        if (sent.state === "kept") return;
        const result = sent.state === "sent" ? sent.result : null;
        if (!result || !result.ok) {
          patch(post.id, { reposted: post.reposted, repostCount: post.repostCount });
          banner.error(result && !result.ok ? result.error : OUTBOX_KEEP_FAILED);
          return;
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const onMenuAction = (
    post: PostView,
    action: string,
  ) => {
    if (action === "copy" || action === "share") {
      const url = `${window.location.origin}/post/${post.id}`;
      if (
        action === "share" &&
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        void navigator.share({ url }).catch(() => {
          /* Cancelling a share sheet is not a failure and gets no message. */
        });
        return;
      }
      void navigator.clipboard?.writeText(url);
      banner.quick(POST_COPY.copied);
      return;
    }
    /* Contact agent, the one row in the sheet that had no branch in either
       handler. `/messages/new?listing=` resolves the agent server side and is
       the same bridge the listing page uses. */
    if (action === "contact") {
      if (!post.listing) {
        banner.error("There is no flat on this post to ask about.");
        return;
      }
      router.push(`/messages/new?listing=${post.listing.id}`);
      return;
    }
    if (requireSignIn()) return;
    /* The one row this sheet offers that already had a handler and no way to
       reach it. `onRepost` was passed into every card and nothing ever called
       it. */
    if (action === "repost") {
      onRepost(post);
      return;
    }
    if (action === "report") {
      setReporting(post);
      return;
    }
    if (action === "edit") {
      setEditing(post.id);
      return;
    }

    /* The slide asks (`DeleteSheet`); `removeConfirmed` below does it. */
    if (action === "delete") {
      setDeleting(post);
      return;
    }
    /* Optimistic, as in the feed: the disc marks on the tap and goes back
       the moment the server disagrees. */
    if (action === "save") {
      const saved = !post.saved;
      if (saved) feedback("select");
      patch(post.id, { saved });
      /* Said on the tap, with Undo (lib/ui/optimistic.ts); the server answer
         only corrects. */
      void sayNowSettleLater({
        message: saved ? POST_COPY.savedDone : POST_COPY.unsavedDone,
        undo: {
          undo: () => toggleMark({ postId: post.id, mark: "SAVE", want: !saved }),
          undone: saved ? POST_COPY.unsavedUndone : POST_COPY.savedUndone,
          onUndone: () => patch(post.id, { saved: !saved }),
        },
        send: () => setOrKeep("save_post", post.id, saved, () => toggleMark({ postId: post.id, mark: "SAVE", want: saved })),
        rollBack: () => patch(post.id, { saved: post.saved }),
        notKeptWords: OUTBOX_KEEP_FAILED,
      });
      return;
    }

    startTransition(async () => {
      try {
        // A "hide" key used to live here writing the identical mute behind a row
        // labelled "Not interested". One key now, named for what it does.
        if (action === "mute" || action === "block") {
          const target = post.author?.id;
          if (!target) {
            banner.error("There is nobody to do that to on this post.");
            return;
          }
          const result =
            action === "block"
              ? await blockUser({ userId: target })
              : await muteTarget({ targetKind: "USER", targetId: target });
          if (result.ok) {
            bannerWithUndo(action === "block" ? POST_COPY.blockedDone : POST_COPY.mutedDone, {
              undo: () =>
                action === "block" ? unblockUser({ userId: target }) : unmuteTarget({ targetKind: "USER", targetId: target }),
              undone: action === "block" ? POST_COPY.blockedUndone : POST_COPY.mutedUndone,
              onUndone: () => router.refresh(),
            });
          } else banner.error(result.error);
          router.refresh();
          return;
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* The deletion itself, once the slide has been drawn across. Resolves
     false when the server refused, so the track never says "Deleted" for a
     post that is still there. */
  const removeConfirmed = async (): Promise<boolean> => {
    const post = deleting;
    if (!post) return false;
    const result = await removePost({ postId: post.id });
    if (!result.ok) {
      banner.error(result.error);
      return false;
    }
    /* A deleted root with nothing still under it is not a conversation any
       more, and `getThread` answers not found for it. Leave for the feed
       rather than refresh into that. */
    if (post.id === root.id && replies.every((reply) => reply.removed)) {
      router.replace("/around");
      return true;
    }
    router.refresh();
    return true;
  };

  /*
   * Wrapped in the same viewport recorder the feed uses.
   *
   * **A post opened on its own page used to count no view at all.** Every card
   * renders a view count, `recordView` is a validated action with a counter
   * trigger behind it, and the only caller lived inside `Feed.tsx`, so the one
   * surface where somebody has deliberately opened a post to read it was the one
   * surface that recorded nothing. Replies were invisible to it too.
   */
  /*
   * WHERE A REPLY TO THIS ACTUALLY ATTACHES.
   *
   * `private.place_post` refuses an insert at depth greater than three, with
   * "This thread is as deep as it goes. Reply higher up so people can follow
   * it." Every card in this view carried a reply control regardless, so a
   * person answering the deepest comment in a conversation typed a reply, sent
   * it, and got an error they could do nothing about. That is the same defect
   * as a Reserve button on a listing that cannot be booked: a control offered
   * for an action the database will always refuse.
   *
   * So at the cap the reply attaches to the PARENT instead, which is exactly
   * what the error message asks for and lands the new reply in the same visible
   * branch, one level shallower. Nobody is told to go and find somewhere else
   * to click. The composer still names the person being answered, because that
   * is who is being answered whichever row the row hangs off.
   */
  const MAX_DEPTH = 3;
  const replyTargetOf = (post: PostView): string => {
    const reply = replies.find((r) => r.id === post.id);
    if (!reply || reply.depth < MAX_DEPTH) return post.id;
    return reply.parentId ?? post.id;
  };

  /*
   * THE ONE PLACE A TOMBSTONE IS DRAWN (founder, item 4).
   *
   * A deleted post reaches this view only when `getThread` kept it, which it
   * does only while a reply that is still there hangs off it. Here, and only
   * here, it renders as the minimal "This post was removed" line so the
   * conversation does not break. `PostCard` itself draws nothing for a removed
   * post, so no feed or profile can ever show one.
   */
  /* The post the reply page is open for, read from the live list so a like
     made meanwhile is shown as it is now. */
  const replyTarget: PostView | null =
    replyingTo === null
      ? null
      : replyingTo === root.id
        ? root
        : (replies.find((reply) => reply.id === replyingTo) ?? null);
  const replyField = useRef<HTMLTextAreaElement>(null);

  const card = (post: PostView) =>
    post.removed ? (
      <Tombstone replyCount={post.replyCount} />
    ) : (
    <ViewportPost postId={post.id}>
      <PostCard
        post={post}
        detail={post.id === root.id}
        onLike={() => onLike(post)}
        onRepost={() => onRepost(post)}
        onReply={() => setReplyingTo(post.id)}
        // The control is keyed on the post tapped; where the reply LANDS is
        // decided by `replyTargetOf` when the composer renders.
        onShare={() => onMenuAction(post, "share")}
        onSave={() => onMenuAction(post, "save")}
        onMenu={() => setSheetFor(post)}
        editor={
          editing === post.id ? (
            <PostEditor
              postId={post.id}
              initialBody={post.rawBody ?? post.body ?? ""}
              onDone={() => setEditing(null)}
              onSaved={(body, held) => {
                patch(post.id, { body, rawBody: body, edited: true });
                if (held) banner.info(POST_COPY.editHeld);
                else banner.success(POST_COPY.editedDone);
                router.refresh();
              }}
            />
          ) : undefined
        }
      />
    </ViewportPost>
    );

  return (
    <div className="flex flex-col gap-[var(--nf-feed-gap)]">
      {card(root)}


      {replies.length > 0 ? (
        <h2 className="mt-xs text-[length:var(--nf-text-overline)] font-semibold uppercase tracking-[0.14em] text-[var(--nf-content-muted)]">
          {countOf(replies.length, "replies", locale)}
        </h2>
      ) : (
        /*
         * A THREAD WITH NO REPLIES SAID NOTHING AT ALL.
         *
         * The heading above only draws when there is a count, so an unanswered
         * post rendered the card, the composer, and then blank screen: no
         * heading, no line, nothing to tell somebody whether the replies had
         * failed to load or had never been written. One quiet line, in the
         * same voice as the feed's end of session, and it points at the
         * composer directly above rather than repeating it as a second
         * control.
         */
        <p className="mt-xs text-center text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          {signedIn
            ? "Nobody has replied yet. Yours would be the first."
            : "Nobody has replied yet."}
        </p>
      )}

      {/*
        THE CONVERSATION, JOINED BY ITS LINE (reference 2's connector).

        Each reply steps in one level per depth (capped at three, as the
        depth cap is) and hangs off a thin rail drawn down its left edge, so
        a reply visibly belongs to the post above it rather than floating as
        another card in a feed. A reply that arrives while the thread is open
        (yours, after the refresh) opens into the list (`Expand`); what was
        there when the page opened is simply there.
      */}
      {replies.map((reply, index) => {
        /* The first six replies arrive 40ms apart (motion 10), the way the
           feed's first six do; the rest are simply there. */
        const lead = leadProps(index);
        return (
        <Expand
          key={reply.id}
          appear={!firstReplies.has(reply.id)}
          className="nf-thread__reply"
          style={{ "--nf-thread-depth": Math.min(reply.depth, 3) } as React.CSSProperties}
        >
        <div
          style={lead.style}
          className={["flex flex-col gap-[var(--nf-feed-gap)]", lead.className ?? ""].filter(Boolean).join(" ")}
        >
          {reply.mutedAuthor && !unfolded.includes(reply.id) ? (
            <MutedReply
              who={reply.author?.handle ? `@${reply.author.handle}` : "somebody you muted"}
              onShow={() => setUnfolded((open) => [...open, reply.id])}
            />
          ) : (
            card(reply)
          )}
        </div>
        </Expand>
        );
      })}

      {/* THE PINNED WAY IN (the feed set): a smoked "Post your reply" bar
          that stays at the foot of the thread and opens the full page. Never
          under a deleted root: `place_post` refuses a reply to a parent that
          is not LIVE, so the page would only ever fail. */}
      {!root.removed ? (
        <button type="button" className="nf-reply-bar" onClick={() => setReplyingTo(root.id)}>
          <UiIcon name="chat-bubble" size={16} />
          Post your reply
        </button>
      ) : null}

      {/*
        EVERY REPLY IS A FULL PAGE (the founder: "if users want to comment it
        should open full page... not some small box"). The post being
        answered sits above the field, joined to it by a thread line, with
        "Replying to @handle" in brand blue, so the box can never be mistaken
        for an answer to a different card. One page for the root and for
        every reply in the thread.
      */}
      <Sheet
        open={replyTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReplyingTo(null);
        }}
        title="Reply"
        hideTitle
        fullPage
        initialFocus={replyField}
      >
        {replyTarget ? (
          <Composer
            page
            parentId={replyTargetOf(replyTarget)}
            signedIn={signedIn}
            autoFocus
            fieldRef={replyField}
            onDone={() => setReplyingTo(null)}
            context={<ReplyContext post={replyTarget} />}
          />
        ) : null}
      </Sheet>

      {sheetFor ? (
        <ActionSheet
          label="What would you like to do?"
          actions={actionsForPost({
            isMine: sheetFor.isMine,
            isAgentAuthor: Boolean(sheetFor.author?.isAgent),
            hasListing: Boolean(sheetFor.listing),
            saved: sheetFor.saved,
            reposted: sheetFor.reposted,
            repostCount: sheetFor.repostCount,
            editable: sheetFor.editable,
            hasAuthor: Boolean(sheetFor.author?.id),
            who: sheetFor.author?.handle ? `@${sheetFor.author.handle}` : sheet.thisPerson,
          }, sheet.menu)}
          onChoose={(key) => onMenuAction(sheetFor, key)}
          onClose={() => setSheetFor(null)}
          body={sheet.body}
          dismissLabel={sheet.dismissLabel}
        />
      ) : null}

      <DeleteSheet
        open={deleting !== null}
        title={DELETE_WORDS.post.title}
        body={DELETE_WORDS.post.body}
        onClose={() => setDeleting(null)}
        onConfirm={removeConfirmed}
      />

      {reporting ? (
        <ReportSheet
          title={sheet.reportTitle}
          subject={
            reporting.author?.handle
              ? sheet.reportPostedBy.replace("{handle}", reporting.author.handle)
              : sheet.reportPostedOnAround
          }
          reasons={POST_REPORT_REASONS}
          words={sheet.report}
          submit={({ reason, detail }) =>
            reportPost({ postId: reporting.id, reason, detail })
          }
          onClose={() => setReporting(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * A reply from somebody the reader has muted.
 *
 * Collapsed, not removed. Removing it would leave the replies underneath it
 * hanging off a parent that is not on the page, and a mute is a decision about
 * what to read, never a decision to delete other people's words from somebody
 * else's conversation. The line names who it is and offers to open it, because
 * the one moment a reader most wants to break their own mute is when the person
 * has answered something they are reading.
 */
function MutedReply({ who, onShow }: { who: string; onShow: () => void }) {
  return (
    <div className="nf-panel nf-panel--card flex-row flex-wrap items-center justify-between gap-sm px-md py-sm">
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
        You muted {who}.
      </p>
      <Button variant="quiet" size="sm" onClick={onShow}>
        Read it anyway
      </Button>
    </div>
  );
}

/*
 * The tombstone lives in `components/social/feed/Tombstone.tsx` and is drawn by
 * `card` above, in this conversation and nowhere else (founder, item 4). It is
 * keyed on `post.removed`, never on `body === null`: a post with no words is
 * not a post that was taken down.
 */

/** The handle to address a reply to, or an honest stand-in for a deleted one. */
function handleOf(post: PostView): string {
  if (post.author?.handle) return `@${post.author.handle}`;
  return post.author?.displayLabel ?? "this post";
}

/**
 * The line above an open composer, naming who it answers.
 *
 * Deliberately not a placeholder inside the text box: a placeholder disappears
 * the moment somebody types, which is exactly when they most want to be able to
 * glance up and check. It stays for the whole time the composer is open.
 */
/**
 * WHAT IS BEING ANSWERED, ABOVE THE FIELD, AND WHO.
 *
 * The author's face with a thread line running down from it towards the
 * field, their name and handle, the first lines of what they said, and
 * "Replying to @handle" in brand blue. At three levels of nesting a box
 * under one card and a box under another look identical; naming the person
 * removes the guess.
 */
function ReplyContext({ post }: { post: PostView }) {
  const name = post.author?.displayLabel ?? (post.authorKind === "BOT" ? "Vallo AI" : "Vallo");
  return (
    <div>
      <div className="nf-reply-context">
        <span className="nf-reply-context__rail" aria-hidden="true">
          <span className="nf-reply-context__face">
            {post.author?.avatarPath ? (
              <RemoteImage src={post.author.avatarPath} alt="" width={72} height={72} sizes="36px" />
            ) : (
              initialOf(name)
            )}
          </span>
          <span className="nf-reply-context__line" />
        </span>
        <div className="min-w-0">
          <p className="nf-reply-context__who">
            <span className="nf-reply-context__name">{name}</span>
            {post.author?.handle ? (
              <span className="nf-reply-context__handle">@{post.author.handle}</span>
            ) : null}
          </p>
          {post.body ? <p className="nf-reply-context__body">{post.body}</p> : null}
        </div>
      </div>
      <p className="nf-reply-context__to">
        Replying to <strong>{handleOf(post)}</strong>
      </p>
    </div>
  );
}
