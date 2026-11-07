"use client";

import { initial } from "@/lib/text/initial";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { BackChevron } from "@/components/social/profile/BackChevron";
import { FollowButton } from "@/components/social/profile/FollowButton";
import { ReportSheet } from "@/components/social/ReportSheet";
import { DELETE_WORDS, DeleteSheet } from "@/components/social/DeleteSheet";
import { ActionPill } from "@/components/social/feed/ActionPill";
import type { ReportWords } from "@/components/social/sheet-words";
import { CommentsSheet } from "@/components/social/comments/CommentsSheet";
import { StoryRail } from "./StoryRail";
import { markStorySeen } from "./seen";
import { feedback } from "@/lib/ui/feedback";
import { StorySequence } from "./StorySequence";
import type { Face, StoryCard, StoryComment, StoryView } from "@/lib/social/stories-queries";
import type { CommentRow } from "@/components/social/comments/CommentsSheet";
import {
  commentOnStory,
  recordStoryView,
  removeStory,
  deleteStoryComment,
  reportStoryComment,
  toggleStoryCommentLike,
  toggleStoryMark,
} from "@/lib/social/stories-actions";
import { blockUser, muteTarget, reportProfile } from "@/lib/social/posts-actions";
import { POST_COPY, PROFILE_REPORT_REASONS } from "@/lib/social/posts-model";
import { STORY_COPY } from "@/lib/social/stories-model";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { banner } from "@/lib/ui/toast";
import { countOf, formatNumber } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * A story, full bleed.
 *
 * The picture IS the page, not a card on one. Everything floats over it in the
 * order somebody actually reads: who is telling me this, what happened, what I
 * can do about it, who else cared, and then the way in to what people said.
 *
 * The glass card over the lower image is the one piece of chrome that earns its
 * blur: a headline in large tight type has to stay readable over a photograph
 * nobody has seen, and a scrim alone cannot promise that on a bright image.
 *
 * Every action calls a story action rather than a post one. A story owns its
 * reactions, its comments and its views now, and the only things borrowed from
 * the rest of the platform are the ones that should be shared: blocking and
 * muting a person, and reporting the account behind the piece.
 */
export function StoryViewer({
  story,
  faces,
  overflow,
  comments,
  more,
  signedIn,
  viewerId = null,
  viewerFollows,
  reportWords,
}: {
  story: StoryView;
  faces: Face[];
  overflow: number;
  comments: StoryComment[];
  more: StoryCard[];
  signedIn: boolean;
  /** The signed-in reader's id: the seen ring is kept per account on a shared phone. */
  viewerId?: string | null;
  viewerFollows: boolean;
  /** The report sheets' reasons and words, from the server (`reportWordsOf`). */
  reportWords: ReportWords;
}) {
  const signInHref = useSignInHref();
  const locale = useClientLocale();
  const router = useRouter();
  const [liked, setLiked] = useState(story.liked);
  const [likeCount, setLikeCount] = useState(story.likeCount);
  const [saved, setSaved] = useState(story.saved);
  const [saveCount, setSaveCount] = useState(story.saveCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [, startTransition] = useSafeTransition();
  const counted = useRef(false);

  /*
   * Escape closes the actions menu.
   *
   * It is a popover, not a sheet, but it lays a full-screen scrim over the page
   * to catch the dismissing click, and a scrim with no keyboard dismissal is a
   * dead end: somebody who opened it with the keyboard could reach nothing
   * behind it and had no way out. `ActionSheet` and `ReportSheet` on this same
   * screen have always done this; the menu was the one overlay in the social
   * layer that did not.
   *
   * No focus trap and no scroll lock, deliberately. Both belong to a sheet that
   * owns the screen. This is a menu attached to a button, it closes on the next
   * click anywhere, and taking the page's scroll away for it would be the
   * heavier behaviour of a different component.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /* One view, once, when the page is genuinely open. The database counts one
     person once a day regardless, so this only decides whether to make the
     call at all. */
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    const timer = window.setTimeout(() => void recordStoryView({ storyId: story.id }), 900);
    return () => window.clearTimeout(timer);
  }, [story.id]);

  /* The ring on the feed goes quiet for this story. Kept on this device only
     (`./seen`), and marked when the story is opened rather than finished: the
     ring says "you have been here", which a half-watched story has. A run
     replaces the entry as it steps, so this fires for each story in turn. */
  useEffect(() => {
    markStorySeen(story.id, viewerId);
  }, [story.id, viewerId]);

  const who = story.author.label;
  /* B16: this story and the recent run, as the sequence reads them. */
  const current = useMemo(
    () => ({ id: story.id, imageUrl: story.imageUrl, authorLabel: story.author.label }),
    [story.id, story.imageUrl, story.author.label],
  );

  const requireSignIn = () => {
    if (signedIn) return false;
    router.push(signInHref);
    return true;
  };

  const mark = (kind: "LIKE" | "SAVE") => {
    if (requireSignIn()) return;
    const on = kind === "LIKE" ? !liked : !saved;
    /* A light tap in the hand when a mark lands; taking one back is quiet. */
    if (on) feedback("select");
    if (kind === "LIKE") {
      setLiked(on);
      setLikeCount((n) => n + (on ? 1 : -1));
    } else {
      setSaved(on);
      setSaveCount((n) => n + (on ? 1 : -1));
    }
    startTransition(async () => {
      try {
        const result = await toggleStoryMark({ storyId: story.id, mark: kind });
        if (!result.ok) {
          if (kind === "LIKE") {
            setLiked(!on);
            setLikeCount((n) => n + (on ? -1 : 1));
          } else {
            setSaved(!on);
            setSaveCount((n) => n + (on ? -1 : 1));
          }
          banner.error(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const share = () => {
    const url = `${window.location.origin}/stories/${story.id}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator.share({ title: story.headline, url }).catch(() => {
        /* Cancelling a share sheet is not a failure and gets no message. */
      });
      return;
    }
    void navigator.clipboard?.writeText(url);
    banner.success(POST_COPY.copied);
  };

  const onPerson = (action: "mute" | "block") => {
    setMenuOpen(false);
    if (requireSignIn()) return;
    const target = story.author.id;
    if (!target) {
      banner.error("There is nobody to do that to on this story.");
      return;
    }
    startTransition(async () => {
      try {
        const result =
          action === "block"
            ? await blockUser({ userId: target })
            : await muteTarget({ targetKind: "USER", targetId: target });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        if (action === "block") {
          /* A block hides this author's work in both directions the instant it
             lands, so this page stops existing for the person who wrote the
             block. Leaving them here would answer the next refresh with a 404 and
             no explanation, so it leaves for a real destination itself. */
          router.replace("/around");
          return;
        }
        banner.success(POST_COPY.mutedDone);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* Taking a story down is confirmed by the slide (`DeleteSheet`), never by
     the browser's `confirm()`. */
  const [takingDown, setTakingDown] = useState(false);
  const takeDown = () => {
    setMenuOpen(false);
    setTakingDown(true);
  };
  const takeDownConfirmed = async (): Promise<boolean> => {
    const result = await removeStory({ storyId: story.id });
    if (!result.ok) {
      banner.error(result.error);
      return false;
    }
    router.replace("/around");
    return true;
  };

  /* The sheet knows nothing about stories or posts. It is handed rows and two
     functions, so the same component serves both sources. */
  /* Memoised on the server's list, because the sheet resets its own rows
     whenever this reference changes. A fresh array on every render of this
     page (a toast, a like on the story) wiped the sheet's optimistic comment
     likes and put back the comments of somebody just blocked. */
  const commentRows: CommentRow[] = useMemo(() => comments.map((comment) => ({
    id: comment.id,
    parentId: comment.parentId,
    body: comment.body,
    createdLabel: comment.createdLabel,
    authorId: comment.authorId,
    authorLabel: comment.authorLabel,
    authorHandle: comment.authorHandle,
    avatarUrl: comment.avatarUrl,
    likeCount: comment.likeCount,
    liked: comment.liked,
    isMine: comment.isMine,
    removed: comment.removed,
  })), [comments]);

  return (
    <div className="nf-story nf-story--seq">
      <article className="nf-story__stage">
        {story.imageUrl ? (
          /* The picture IS the page, so it is the one image here that is
             worth a full-width fetch and a priority hint. */
          <RemoteImage
            src={story.imageUrl}
            alt=""
            width={1200}
            height={1600}
            sizes="100vw"
            priority
            quality={90}
            className="nf-story__image"
          />
        ) : (
          <div className="nf-story__image nf-story__image--none" aria-hidden="true" />
        )}
        <div className="nf-story__wash" aria-hidden="true" />
        {/* B16: progress, tap zones, hold to pause, the next one ready. */}
        <StorySequence current={current} more={more} hold={menuOpen || commenting || reporting} />

        {/* --------------------------------------------- who is telling me */}
        <header className="nf-story__top">
          <BackChevron fallback="/around" />

          <Link
            href={story.author.handle ? `/u/${story.author.handle}` : "#"}
            className="nf-story__author nf-tap"
            aria-label={`Open ${who}`}
          >
            <span className="nf-story__face">
              {story.author.avatarUrl ? (
                <RemoteImage
                  src={story.author.avatarUrl}
                  alt=""
                  width={76}
                  height={76}
                  sizes="38px"
                />
              ) : (
                <span aria-hidden="true">{initial(who)}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="nf-story__who">{who}</span>
              <span className="nf-story__when">
                {story.createdLabel}
                {story.edited ? " · edited" : ""}
              </span>
            </span>
          </Link>

          {story.author.handle && !story.isMine ? (
            <FollowButton
              handle={story.author.handle}
              initialFollowing={viewerFollows}
              signedIn={signedIn}
              compact
            />
          ) : null}

          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              leadingIcon="more"
              className="nf-social-round"
              aria-label="More actions for this story"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            />
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div role="menu" aria-label="Story actions" className="nf-post__menu nf-story__menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="nf-post__menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      share();
                    }}
                  >
                    Share this story
                  </button>
                  {story.isMine ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="nf-post__menu-item nf-post__menu-item--danger"
                      onClick={takeDown}
                    >
                      Take this story down
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="nf-post__menu-item"
                        onClick={() => onPerson("mute")}
                      >
                        Mute {who}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="nf-post__menu-item nf-post__menu-item--danger"
                        onClick={() => {
                          setMenuOpen(false);
                          if (requireSignIn()) return;
                          setReporting(true);
                        }}
                      >
                        {reportWords.reportStory}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="nf-post__menu-item nf-post__menu-item--danger"
                        onClick={() => onPerson("block")}
                      >
                        Block {who}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </header>

        {/* -------------------------------------------------- what happened */}
        <div className="nf-story__foot">
          {/* THE WORDS, ON SMOKED GLASS (D74: smoked glass for anything that
              floats over media). One headline, one line under it, the place as
              a small pill. The brand chip and the corner share button that sat
              on this card are gone: the share is in the bar below, once. */}
          <div className="nf-story__card">
            <h1 className="nf-story__headline">{story.headline}</h1>
            {story.standfirst ? (
              <p className="nf-story__standfirst">{story.standfirst}</p>
            ) : null}
            {story.placeLabel ? (
              <p className="nf-story__place">
                <UiIcon name="location" size={12} />
                {story.placeLabel}
              </p>
            ) : null}
          </div>

          {story.heldReason ? (
            <p className="nf-story__held">{story.heldReason} Only you can see this until then.</p>
          ) : null}

          {/* --------------------------------------------- who else cared */}
          {faces.length > 0 ? (
            <div className="nf-story__pile">
              <span className="nf-story__faces">
                {faces.map((face) => (
                  <Link
                    key={face.userId}
                    href={face.handle ? `/u/${face.handle}` : "#"}
                    className="nf-story__pileface nf-tap"
                    aria-label={face.label}
                    title={face.label}
                  >
                    {face.avatarUrl ? (
                      <RemoteImage
                        src={face.avatarUrl}
                        alt=""
                        width={64}
                        height={64}
                        sizes="32px"
                      />
                    ) : (
                      <span aria-hidden="true">{initial(face.label)}</span>
                    )}
                  </Link>
                ))}
              </span>
              {overflow > 0 ? (
                <span className="nf-story__more nf-numeric">+{overflow}</span>
              ) : null}
              <span className="nf-story__pilelabel">liked this</span>
            </div>
          ) : null}

          {/* ------------------------------------- one bar: reply, like, keep, send
              THE WAY IN AND THE FEED'S CAPSULES, ON ONE LINE (D72, D74). The
              reply field is a smoked capsule that opens the conversation; the
              like, the save and the share are the same capsules as under a
              post, so the like you press here is the like you press there. A
              BOOKMARK, NOT THE REPOST ARROWS: saving puts the story on the
              reader's own shelf and nobody else sees it happen. */}
          <div className="nf-story__bar">
            <div className="nf-story__actions nf-story__actions--pills">
              <ActionPill
                icon="heart"
                tone="like"
                pressed={liked}
                payoff
                count={formatNumber(likeCount, locale)}
                label={liked ? `Liked, ${likeCount}. Undo` : `Likes ${likeCount}, like this story`}
                onClick={() => mark("LIKE")}
              />
              {/* The comment is a bare glyph and its count like the like (D78:
                  no wrapper around any action on the story). */}
              <ActionPill
                icon="chat-bubble"
                tone="reply"
                count={formatNumber(story.commentCount, locale)}
                label={story.commentCount > 0 ? countOf(story.commentCount, "comments", locale) : STORY_COPY.addComment}
                onClick={() => setCommenting(true)}
              />
              {/* Send, then save at the far edge: the same order as under a
                  post, so the save is always the last mark on the row. */}
              <ActionPill icon="send" tone="share" round label="Share this story" onClick={share} />
              <ActionPill
                icon="bookmark"
                tone="save"
                round
                pressed={saved}
                label={saved ? `Saved, ${saveCount}. Undo` : `Saves ${saveCount}, save this story`}
                onClick={() => mark("SAVE")}
              />
            </div>
          </div>
        </div>
      </article>

      <StoryRail stories={more} currentId={story.id} />

      {commenting ? (
        <CommentsSheet
          comments={commentRows}
          signedIn={signedIn}
          onClose={() => setCommenting(false)}
          onSend={({ parentId, body }) =>
            commentOnStory({ storyId: story.id, parentId, body })
          }
          onLike={(commentId) => toggleStoryCommentLike({ commentId })}
          /* B-7b: your own comment can be deleted (soft, like a post). */
          onDelete={(commentId) => deleteStoryComment({ commentId })}
          onReport={(input) => reportStoryComment(input)}
          reportWords={reportWords}
        />
      ) : null}

      <DeleteSheet
        open={takingDown}
        title={DELETE_WORDS.story.title}
        body={DELETE_WORDS.story.body}
        onClose={() => setTakingDown(false)}
        onConfirm={takeDownConfirmed}
      />

      {reporting && story.author.id ? (
        <ReportSheet
          title={reportWords.reportWho.replace("{who}", () => who)}
          subject={reportWords.storySubject.replace("{handle}", () => (story.author.handle ?? ""))}
          reasons={PROFILE_REPORT_REASONS}
          words={reportWords}
          submit={({ reason, detail }) =>
            reportProfile({ userId: story.author.id as string, reason, detail })
          }
          onClose={() => setReporting(false)}
        />
      ) : null}
    </div>
  );
}
