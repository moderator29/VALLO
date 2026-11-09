"use client";

import { banner } from "@/lib/ui/toast";
import { initial } from "@/lib/text/initial";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReportSheet } from "@/components/social/ReportSheet";
import { DELETE_WORDS, DeleteSheet } from "@/components/social/DeleteSheet";
import type { ReportWords } from "@/components/social/sheet-words";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { blockUser, muteTarget } from "@/lib/social/posts-actions";
import {
  POST_COPY,
  POST_MAX,
  POST_REPORT_REASONS,
  type ReportReason,
} from "@/lib/social/posts-model";
import type { ActionResult } from "@/lib/actions/envelope";
import { PostBody } from "@/components/social/feed/PostBody";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { pruneDeleted } from "@/lib/social/deleted-posts";
import { countOf, formatNumber } from "@vallo/i18n/core";
import { Expand } from "@/components/social/Expand";
import { ActionPill } from "@/components/social/feed/ActionPill";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Comments, as a sheet.
 *
 * A sheet rather than a list under the post, because reading a story and
 * reading what people said about it are two different activities and putting
 * them on one scroll makes both worse. The sheet has a header that names it, an
 * add control on the left, a close on the right, the comments themselves, and a
 * composer pinned to the bottom where a thumb already is.
 *
 * **The connector is the one thread line in this product, and it is here on
 * purpose.** The owner cut the connecting line from the feed and it stays cut
 * there: it made the feed read as an information-design exercise. Inside this
 * sheet a nested reply at this density is genuinely unreadable without it, so
 * one very faint brand-tinted curve runs from a parent down into its child. It
 * is drawn inside the child's own row and stops at the avatar, so it can never
 * cross a card boundary or thread two unrelated comments together.
 *
 * **The sheet knows nothing about where its rows came from.** It is handed
 * rows, a way to send one and a way to like one, so the same component serves a
 * story's `story_comments` and a post's replies. Those are two different tables
 * with two different sets of policies, and a component that knew which was
 * which would be a third place for them to drift apart.
 */

type Draft = { parentId: string; label: string } | null;

/** One comment, from whichever table it came out of. */
export type CommentRow = {
  id: string;
  parentId: string | null;
  body: string | null;
  createdLabel: string;
  authorId: string | null;
  authorLabel: string;
  authorHandle: string | null;
  avatarUrl: string;
  likeCount: number;
  liked: boolean;
  isMine: boolean;
  removed: boolean;
};

export function CommentsSheet({
  comments,
  signedIn,
  onClose,
  onSend,
  onLike,
  onDelete,
  onReport,
  reportWords,
}: {
  comments: CommentRow[];
  signedIn: boolean;
  onClose: () => void;
  /** Writes a comment, or a reply to one. */
  onSend: (input: {
    parentId: string | null;
    body: string;
  }) => Promise<ActionResult<{ held: boolean }>>;
  /** Toggles a like on one comment. */
  onLike: (commentId: string) => Promise<ActionResult<unknown>>;
  /** Removes your own comment. Absent when the source has no such path yet. */
  onDelete?: (commentId: string) => Promise<ActionResult<unknown>>;
  /**
   * Files a report against one comment, in the source's own terms. Passed in
   * rather than chosen here for the same reason as `onSend`: this sheet used
   * to call `reportPost` itself, and every story comment reported from it
   * reached the queue as a POST whose id no post carries.
   */
  onReport: (input: {
    commentId: string;
    reason: ReportReason;
    detail: string;
  }) => Promise<ActionResult<unknown>>;
  /** The report sheet's reasons and words, from the server (`reportWordsOf`). */
  reportWords: ReportWords;
}) {
  const signInHref = useSignInHref();
  const locale = useClientLocale();
  const router = useRouter();
  const [rows, setRows] = useState(comments);
  /* The comments there when the sheet opened; only later ones open in. */
  const [firstRows] = useState(() => new Set(comments.map((comment) => comment.id)));
  const [draft, setDraft] = useState<Draft>(null);
  const [body, setBody] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /* Whether the open menu rises above its button. See `.nf-comment__menu--up`. */
  const [menuUp, setMenuUp] = useState(false);
  const [reporting, setReporting] = useState<CommentRow | null>(null);
  /* The comment the delete slide is open for. */
  const [deleting, setDeleting] = useState<CommentRow | null>(null);
  const [pending, startTransition] = useSafeTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headRef = useRef<HTMLButtonElement>(null);

  /* The server is the truth, derived during render rather than in an effect.
     Same conversion and same reasoning as `Feed`: an effect committed the old
     comment list first and the new one a render later, so a sheet reopened
     after somebody commented flashed the list without their comment in it. The
     reference compare is what the dependency array already was. */
  const [lastComments, setLastComments] = useState(comments);
  if (comments !== lastComments) {
    setLastComments(comments);
    setRows(comments);
  }

  /* This sheet is the one that stacks hardest: it opens an action sheet and a
     report sheet of its own, so the counted scroll lock is the point. The
     hand-rolled version set `document.body.style.overflow` from a captured
     string, so closing the inner report sheet handed the page its scroll back
     while the comments were still open over it.

     It also never moved focus in. A modal that leaves focus on the page
     behind is one where the first Tab walks into content the reader cannot
     see, so first focus lands on the header control - not the composer,
     which would throw the keyboard up on every open.

     All of that, plus drag and flick to close and Back, is the platform's
     `Sheet` now; this component only says where first focus goes. */

  /*
   * Which rows need a connector drawn into them.
   *
   * A comment gets one when its parent is also in this sheet, which is exactly
   * the case where indentation alone stops being enough to say who is answering
   * whom. A top-level comment never gets one, so the line can never appear to
   * come from the story itself.
   */
  const hasParent = useMemo(() => {
    const present = new Set(rows.map((row) => row.id));
    return new Set(
      rows.filter((row) => row.parentId && present.has(row.parentId)).map((row) => row.id),
    );
  }, [rows]);

  const patch = (id: string, next: Partial<CommentRow>) =>
    setRows((all) => all.map((row) => (row.id === id ? { ...row, ...next } : row)));

  const requireSignIn = () => {
    if (signedIn) return false;
    router.push(signInHref);
    return true;
  };

  const like = (comment: CommentRow) => {
    if (requireSignIn()) return;
    const liked = !comment.liked;
    patch(comment.id, { liked, likeCount: comment.likeCount + (liked ? 1 : -1) });
    startTransition(async () => {
      try {
        const result = await onLike(comment.id);
        if (!result.ok) {
          patch(comment.id, { liked: comment.liked, likeCount: comment.likeCount });
          banner.error(result.error);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const send = () => {
    if (requireSignIn()) return;
    const text = body.trim();
    if (text.length === 0) return;
    startTransition(async () => {
      try {
        const result = await onSend({ parentId: draft?.parentId ?? null, body: text });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        setBody("");
        setDraft(null);
        /* Said by the one banner at the top of the screen (Grade 1). */
        if (result.data.held) banner.info(POST_COPY.held);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const onMenu = (comment: CommentRow, action: "delete" | "mute" | "block" | "report") => {
    setMenuFor(null);
    if (action === "report") {
      if (requireSignIn()) return;
      setReporting(comment);
      return;
    }
    if (requireSignIn()) return;
    /* The slide asks (`DeleteSheet`), never the browser's `confirm()`. */
    if (action === "delete") {
      if (onDelete) setDeleting(comment);
      return;
    }

    startTransition(async () => {
      try {
        const target = comment.authorId;
        if (!target) {
          banner.error("There is nobody to do that to on this comment.");
          return;
        }
        const result =
          action === "block"
            ? await blockUser({ userId: target })
            : await muteTarget({ targetKind: "USER", targetId: target });
        if (result.ok) banner.success(action === "block" ? POST_COPY.blockedDone : POST_COPY.mutedDone);
        else banner.error(result.error);
        /* Their comments leave this sheet now. The rows are held here, and the
           refresh below re-reads the page behind the sheet, so without this the
           person just blocked kept talking in the open sheet until it closed.
           A reply to one of theirs keeps its place and loses its connector. */
        if (result.ok) setRows((all) => all.filter((row) => row.authorId !== target));
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* The deletion, once the slide has been drawn across. False when the
     server refused, so the track never says "Deleted" for a comment that is
     still there. */
  const removeConfirmed = async (): Promise<boolean> => {
    const comment = deleting;
    if (!comment || !onDelete) return false;
    const result = await onDelete(comment.id);
    if (!result.ok) {
      banner.error(result.error);
      return false;
    }
    /* Gone, unless somebody's comment still answers it: then, and only
       then, it keeps its place as the one-line tombstone (founder, item
       4). The same rule the server read applies. */
    setRows((all) =>
      pruneDeleted(
        all.map((row) => (row.id === comment.id ? { ...row, body: null, removed: true } : row)),
        (row) => ({ id: row.id, parentId: row.parentId, deleted: row.removed }),
      ),
    );
    banner.success("Comment deleted");
    router.refresh();
    return true;
  };

  const left = POST_MAX - body.length;

  const title = rows.length > 0 ? countOf(rows.length, "comments", locale) : "Comments";

  return (
    <>
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      hideTitle
      /* A full page, never a small box (the feed set): the conversation and
         its field take the whole screen, with the sheet's own drag, Back
         and focus return. */
      fullPage
      initialFocus={headRef}
      footer={
        <form
          className="nf-comments__composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          {draft ? (
            <p className="nf-comments__replying">
              Replying to <strong>{draft.label}</strong>
              <Button variant="quiet" size="sm" className="ms-auto" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </p>
          ) : null}
          <div className="nf-comments__row">
            <textarea
              ref={inputRef}
              className="nf-field nf-comments__field"
              rows={1}
              value={body}
              maxLength={POST_MAX}
              placeholder={signedIn ? "Write a comment..." : "Sign in to comment"}
              aria-label="Write a comment"
              onChange={(event) => setBody(event.target.value)}
            />
            <Button
              type="submit"
              variant="spark"
              size="sm"
              className="nf-composer__send nf-composer__send--label shrink-0"
              loading={pending}
              disabled={pending || body.trim().length === 0}
            >
              {draft ? "Reply" : "Send"}
            </Button>
          </div>
          {left < 240 ? (
            <span className="nf-comments__count nf-numeric">{left}</span>
          ) : null}
        </form>
      }
    >
        <header className="nf-comments__head">
          <Button
            ref={headRef}
            variant="icon"
            round
            leadingIcon="plus"
            aria-label="Write a comment"
            onClick={() => {
              setDraft(null);
              inputRef.current?.focus();
            }}
          />
          <p className="nf-comments__title" aria-hidden="true">
            {title}
          </p>
          <Button variant="icon" round leadingIcon="close" aria-label="Close" onClick={onClose} />
        </header>

        <div className="nf-comments__scroll">
          {rows.length === 0 ? (
            <p className="nf-comments__empty">
              Nothing said yet. What you write will be the first thing anybody
              arriving reads.
            </p>
          ) : null}

          {/* A comment that arrives while the sheet is open (yours, after the
              send) opens into the list (`Expand`, D72 motion); the ones that
              were there when the sheet opened are simply there. */}
          <ul>
            {rows.map((comment) => (
              <Expand
                as="li"
                key={comment.id}
                appear={!firstRows.has(comment.id)}
                className={`nf-comment${hasParent.has(comment.id) ? " nf-comment--nested" : ""}`}
                style={{ marginInlineStart: comment.parentId ? "22px" : undefined }}
              >
                {/* The one thread line in the product. Faint, brand tinted, and
                    it starts inside this row so it can never cross a boundary. */}
                {hasParent.has(comment.id) ? (
                  <span className="nf-comment__link" aria-hidden="true" />
                ) : null}

                <Link
                  href={comment.authorHandle ? `/u/${comment.authorHandle}` : "#"}
                  className="nf-comment__face"
                  aria-label={comment.authorLabel}
                >
                  {comment.avatarUrl ? (
                    <RemoteImage
                      src={comment.avatarUrl}
                      alt=""
                      width={64}
                      height={64}
                      sizes="32px"
                    />
                  ) : (
                    <span aria-hidden="true">{initial(comment.authorLabel)}</span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="nf-comment__head">
                    <span className="nf-comment__who">{comment.authorLabel}</span>
                    <span className="nf-comment__when">{comment.createdLabel}</span>
                    {/* Your own comment offers Delete when the source has a
                        path for it, and nothing once it is already deleted. */}
                    {comment.isMine && (!onDelete || comment.removed) ? null : (
                    <div className="relative ms-auto">
                      <button
                        type="button"
                        className="nf-post__act"
                        aria-label={`More actions for this comment`}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === comment.id}
                        onClick={(event) => {
                          const box = event.currentTarget.getBoundingClientRect();
                          const viewport = window.visualViewport?.height ?? window.innerHeight;
                          setMenuUp(box.top > viewport / 2);
                          setMenuFor(menuFor === comment.id ? null : comment.id);
                        }}
                      >
                        <UiIcon name="more" size={17} />
                      </button>
                      {menuFor === comment.id ? (
                        <>
                          <button
                            type="button"
                            aria-label="Close menu"
                            className="fixed inset-0 z-20 cursor-default"
                            onClick={() => setMenuFor(null)}
                          />
                          <div
                            role="menu"
                            className={`nf-post__menu nf-comment__menu${menuUp ? " nf-comment__menu--up" : ""}`}
                          >
                            {comment.isMine ? (
                              onDelete ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="nf-post__menu-item nf-post__menu-item--danger"
                                  onClick={() => onMenu(comment, "delete")}
                                >
                                  Delete this comment
                                </button>
                              ) : null
                            ) : (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="nf-post__menu-item"
                                  onClick={() => onMenu(comment, "mute")}
                                >
                                  Mute {comment.authorLabel}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="nf-post__menu-item nf-post__menu-item--danger"
                                  onClick={() => onMenu(comment, "report")}
                                >
                                  {reportWords.reportComment}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="nf-post__menu-item nf-post__menu-item--danger"
                                  onClick={() => onMenu(comment, "block")}
                                >
                                  Block {comment.authorLabel}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                    )}
                  </div>

                  {/* A comment names people as often as a post does, so the
                      same body renderer serves both. A removed comment keeps
                      its tombstone sentence and is never parsed. */}
                  {comment.removed ? (
                    <p className="nf-comment__body nf-comment__body--gone">
                      {POST_COPY.removed}
                    </p>
                  ) : (
                    <PostBody text={comment.body ?? ""} className="nf-comment__body" />
                  )}

                  {comment.removed ? null : (
                    <div className="nf-comment__foot">
                      <button
                        type="button"
                        className="nf-comment__reply"
                        onClick={() => {
                          setDraft({ parentId: comment.id, label: comment.authorLabel });
                          inputRef.current?.focus();
                        }}
                      >
                        Reply
                      </button>
                      {/* The feed's like capsule, the same control as under a
                          post and on a story (D72). */}
                      <ActionPill
                        icon="heart"
                        tone="like"
                        className="nf-comment__heart"
                        pressed={comment.liked}
                        payoff
                        count={formatNumber(comment.likeCount, locale)}
                        label={
                          comment.liked
                            ? `Liked, ${comment.likeCount}. Undo`
                            : `Likes ${comment.likeCount}, like this comment`
                        }
                        onClick={() => like(comment)}
                      />
                    </div>
                  )}
                </div>
              </Expand>
            ))}
          </ul>
        </div>

    </Sheet>

      <DeleteSheet
        open={deleting !== null}
        title={DELETE_WORDS.comment.title}
        body={DELETE_WORDS.comment.body}
        onClose={() => setDeleting(null)}
        onConfirm={removeConfirmed}
      />

      {reporting ? (
        <ReportSheet
          title={reportWords.reportComment}
          subject={reportWords.commentSubject.replace("{who}", () => reporting.authorLabel)}
          reasons={POST_REPORT_REASONS}
          words={reportWords}
          submit={({ reason, detail }) =>
            onReport({ commentId: reporting.id, reason, detail })
          }
          onClose={() => setReporting(null)}
        />
      ) : null}
    </>
  );
}
