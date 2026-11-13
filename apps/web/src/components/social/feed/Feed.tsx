"use client";

import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { sayNowSettleLater } from "@/lib/ui/optimistic";
import type { SheetWords } from "@/components/social/sheet-words";
import { Button } from "@/components/ui/Button";
import { DEFAULT_LOCALE, type Locale } from "@vallo/i18n/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCard, type PostView } from "./PostCard";
import { ReportSheet } from "../ReportSheet";
import { DELETE_WORDS, DeleteSheet } from "../DeleteSheet";
import { ActionSheet, actionsForPost } from "../ActionSheet";
import {
  DistrictChips,
  DistrictHeader,
  districtPanelId,
  districtTabId,
  type DistrictChip,
} from "./DistrictHeader";
import { StoryGrid } from "../story/StoryGrid";
import { ReviewList } from "../profile/ReviewList";
import { EmptyPanel } from "../profile/EmptyPanel";
import type { StoryCard } from "@/lib/social/stories-queries";
import type { ReviewCard } from "@/lib/social/profile-tabs-queries";
import { PostEditor } from "./PostEditor";
import { LEAD_SETTLE_MS, leadIndexes, leadPropsFor } from "./lead";
import { feedback } from "@/lib/ui/feedback";
import { useCopy } from "@/lib/ui/use-copy";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";
import { removeListingShare, shareListingToFeed } from "@/lib/features/listing-share/actions";
import { ViewportPost } from "./ViewportPost";
import { inCategory, type FeedCategory } from "./categories";
import { FreshArrival } from "./FreshArrival";
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
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import type { FeedPage } from "@/lib/social/posts-queries";
import type { ActionResult } from "@/lib/actions/envelope";
import { POST_COPY, POST_REPORT_REASONS } from "@/lib/social/posts-model";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { setOrKeep } from "@/lib/offline/send-or-keep";

/** The phone could not keep a tap for later (storage refused): the change goes back. */
const OUTBOX_KEEP_FAILED = "You are offline, and this phone could not keep that for later.";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The heading when a caller has not given one.
 *
 * True of every branch that reaches it: the message under it says WHY the
 * timeline is empty, and this says what is empty. Never "nothing found", which
 * is a shrug rather than a sentence.
 */
const DEFAULT_EMPTY_TITLE = "Nothing here yet";

/** The words on the paging control. Client-side copy, beside the control. */
const MORE_COPY = {
  more: "Show more",
  loading: "Loading more",
} as const;

/**
 * The feed.
 *
 * Cards float independently, with no line threading them together. That line
 * was built and cut: it made the surface read as an information-design exercise
 * rather than as somewhere people talk.
 *
 * Marks are optimistic and reverted the moment the server disagrees. The rule
 * is that the UI may be ahead of the database for a second and may never be
 * wrong about it after a reload, which is what `router.refresh()` guarantees.
 *
 * Replies unfold in place rather than opening a page. Somebody wanting to say
 * one line should not lose their scroll position to say it.
 */
export function Feed({
  initial,
  locale = DEFAULT_LOCALE,
  sheet,
  signedIn,
  signedOutHref,
  areaName,
  emptyMessage,
  emptyTitle,
  emptyAction,
  emptyIcon = "chat-duo",
  district,
  pageCursor = null,
  loadMore,
  aside,
  category = null,
  categoryEmpty,
}: {
  /** A category chip (`categories.ts`): only the posts that feature that
      kind of listing are drawn, from this page and every later one. */
  category?: FeedCategory | null;
  /** The empty state when a category holds nothing on the pages read. */
  categoryEmpty?: { title: string; body: string; action: { href: string; label: string } };
  /**
   * Something the surface sets between posts, once: the feed's "worth
   * following" block, after the third post (or after the last, on a shorter
   * feed), so the first thing read is always somebody's post.
   */
  aside?: React.ReactNode;
  initial: PostView[];
  /**
   * The cursor after the first page, or null when the timeline ended there.
   * With `loadMore`, the feed reads the next page when the sentinel at its
   * foot scrolls into view, and a Show more control does the same for anybody
   * whose browser has no observer or who would rather tap.
   */
  pageCursor?: string | null;
  loadMore?: (cursor: string) => Promise<ActionResult<FeedPage>>;
  /* Only the counts need it, but they are on every card, so it rides down from
     the server component that resolved it rather than each card guessing. */
  locale?: Locale;
  /** The action sheet's two lines, from the server (`sheetWordsOf`), so the browser never loads a dictionary for them. */
  sheet: SheetWords;
  signedIn: boolean;
  /**
   * The auth door a SIGNED-OUT visitor is sent to when they tap an action on a
   * PUBLIC, anon-viewable page (a profile opened to strangers). The founder's
   * rule there is sign UP carrying this page, so the page passes
   * `/sign-up?next=<page>`. Absent everywhere else, where the signed-in app
   * keeps its shared `useSignInHref` (`/sign-in?next=`) convention untouched.
   */
  signedOutHref?: string;
  /**
   * Whether this timeline is one somebody can write into.
   *
   * This replaces `isMember`, which asked the wrong question. The composer used
   * to be gated on `areaId && isMember`, so it appeared only inside a place the
   * viewer had joined, and the main feed, which is where most people are when
   * they think of something to say, had no way to write at all. A post no
   * longer needs a place, so the real question is whether this list is a
   * timeline or a record: the feed on `/around` and inside an area is one, a
   * profile's own posts and an activity list are not.
   */
  /* Accepted and ignored since the permanent composer left the top of the
     feed. Both are still passed by every caller and both still matter to
     POSTING, which now happens through `AroundFab`; the page hands the same
     values to it. Removing them from this type would mean editing four call
     sites to delete a prop that is about to be needed again the moment
     anything else on this screen wants to know which place it is in. */
  canCompose?: boolean;
  areaId?: string;
  areaName?: string;
  emptyMessage: string;
  /**
   * The heading over `emptyMessage`, and the way onward under it.
   *
   * -------------------------------------------------------------------------
   * ONE EMPTY-STATE ANATOMY, AND IT TOOK TWO PASSES TO GET THERE.
   *
   * This was a bordered paragraph in muted ink: no mark, no heading, and
   * nothing at all to do next, one tap from `/u`, which drew the same kind of
   * message as a mark, a heading and an action. The shape with no action is
   * the one that leaves somebody at a dead end, so this took the other.
   *
   * The two shapes are now ONE. `EmptyPanel` is the single adapter over the
   * platform's `EmptyState`, and every screen of this feature reaches it: the
   * feed, the profile tabs, the follow lists, the paused state, the story
   * composer and `/u`. The second anatomy, `ProfileNotice`, is deleted rather
   * than left unused, because an unused component is a second anatomy waiting
   * for its next call site.
   *
   * `emptyTitle` stays optional so the profile call sites keep a heading that
   * suits a profile rather than inheriting a feed's.
   */
  emptyTitle?: string;
  emptyAction?: { href: string; label: string };
  /** The mark. Defaults to the one that means "a conversation", which is what
      an empty timeline is short of. A profile tab passes its own. */
  emptyIcon?: BrandIconName;
  /** Present only on a district feed. Absent on a profile, where the header
      and the chip row would be answering a question nobody asked. */
  district?: {
    city: string;
    slug: string;
    places: { slug: string; name: string; city: string }[];
    stories: StoryCard[];
    /** What guests said about the stays filed under this place. */
    reviews: ReviewCard[];
    join?: React.ReactNode;
  };
}) {
  const signInHref = useSignInHref();
  /* On a public anon-viewable page the guest goes to sign up (the page passes
     it); everywhere else this is the app's usual sign-in door. */
  const guestHref = signedOutHref ?? signInHref;
  const router = useRouter();
  const [posts, setPosts] = useState(initial);
  /* The post a report sheet is open for. A report used to fire on the first tap
     with reason OTHER and no way back, which is both an untriageable queue and
     a control people learn not to touch. */
  const [reporting, setReporting] = useState<PostView | null>(null);
  /* The post currently being changed. One at a time: two open editors on one
     screen is two drafts somebody can lose. */
  const [editing, setEditing] = useState<string | null>(null);
  /* One sheet per screen, holding the post it was opened for. One per card
     would be one modal per row in the document. */
  const [sheetFor, setSheetFor] = useState<PostView | null>(null);
  /* The post the delete slide is open for. */
  const [deleting, setDeleting] = useState<PostView | null>(null);
  const [chip, setChip] = useState<DistrictChip>("all");
  /* The lead stagger belongs to the posts the feed mounted with, once. See
     `lead.ts`: keyed by id so a hidden card cannot pull the seventh in, and
     switched off after it has played so a chip change does not replay it. */
  const [leadIds] = useState(() => leadIndexes(initial.map((post) => post.id)));
  const [leadSettled, setLeadSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLeadSettled(true), LEAD_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const [, startTransition] = useSafeTransition();
  const copy = useCopy();

  /*
   * The server is the truth. When a refresh brings new props, take them.
   *
   * DERIVED DURING RENDER RATHER THAN IN AN EFFECT, which is what React 19's
   * `set-state-in-effect` is pointing at. `useEffect(() => setPosts(initial),
   * [initial])` commits the stale list first and the new one one render later,
   * so a refresh paints the old posts for a frame and then replaces them. The
   * comparison is by reference, exactly as the dependency array was, so nothing
   * about WHEN this resets has changed - only that it now happens before paint
   * instead of after one.
   *
   * This is React's own "adjusting state when a prop changes" recipe and it
   * converges: the branch only runs when the reference differs, and setting
   * `lastInitial` in the same pass makes the next render fall straight through.
   */
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    /* A refresh re-reads the FIRST page. The pages read after it are still
       what the person scrolled through, so they are kept, minus anything the
       fresh first page now carries, rather than thrown away by a like.

       A post the old first page held and the fresh one does not has either
       gone (deleted, blocked, muted) or been PUSHED DOWN by something new at
       the top. Dropping both lost the pushed one: the next page was already
       read past it, so it vanished from the scroll for good. The two are told
       apart by position: the fresh page is newest first, so an old post that
       sat below the fresh page's last row was pushed out and is kept, and
       one above it that is missing really has gone. */
    const fresh = new Set(initial.map((post) => post.id));
    const firstPage = new Set(lastInitial.map((post) => post.id));
    const tail = initial.length > 0 ? posts.findIndex((post) => post.id === initial[initial.length - 1]!.id) : -1;
    setPosts([
      ...initial,
      ...posts.filter(
        (post, index) =>
          /* `tail === -1`: the fresh page's last row is not in what we hold,
             so the whole old first page sits below the fresh one and was
             pushed down rather than removed. */
          !fresh.has(post.id) && (!firstPage.has(post.id) || tail === -1 || index > tail),
      ),
    ]);
  }

  /*
   * Paging. The cursor is the last row's `created_at`; null means the end.
   * One read in flight at a time, and a failed read leaves the control in
   * place with the reason under it rather than pretending the feed ended.
   */
  const [cursor, setCursor] = useState<string | null>(pageCursor);
  const [lastPageCursor, setLastPageCursor] = useState(pageCursor);
  if (pageCursor !== lastPageCursor) {
    setLastPageCursor(pageCursor);
    /* Only reset when the first page is fresh AND nothing was loaded after
       it: a refresh mid-scroll keeps the deeper cursor. */
    if (posts.length <= initial.length) setCursor(pageCursor);
  }
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  const readMore = useCallback(async () => {
    if (!loadMore || !cursor || inFlight.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const result = await loadMore(cursor);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const seen = new Set(posts.map((post) => post.id));
      setPosts((all) => [...all, ...result.data.posts.filter((post) => !seen.has(post.id))]);
      setCursor(result.data.ended ? null : result.data.cursor);
    } catch {
      setLoadError("More posts did not load. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [loadMore, cursor, posts]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !loadMore || !cursor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void readMore();
      },
      /* Start the read a screen early, so the next page is usually there
         before the thumb reaches the bottom. */
      { rootMargin: "0px 0px 640px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, cursor, readMore]);

  const patch = (id: string, next: Partial<PostView>) =>
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, ...next } : p)));

  /*
   * Repost, wired at last.
   *
   * `toggleRepost` has been a real, RLS-bound server action since the social
   * layer landed and nothing ever called it: the card took an `onRepost` prop
   * that was never passed, so the count sat on every post with no way to move
   * it. Same optimistic shape as a like, reverted the moment the server
   * disagrees.
   */
  const onRepost = (post: PostView) => {
    if (!signedIn) {
      router.push(guestHref);
      return;
    }
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

  const onLike = (post: PostView) => {
    if (!signedIn) {
      router.push(guestHref);
      return;
    }
    const liked = !post.liked;
    /* One light tap in the hand when a like lands. Un-liking is quiet: a
       haptic on every toggle would buzz at a person taking something back. */
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

  const onMenuAction = (
    post: PostView,
    action: string,
  ) => {
    if (action === "share") {
      const url = `${window.location.origin}/post/${post.id}`;
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        void navigator.share({ url }).catch(() => {
          /* Cancelling a share sheet is not a failure and gets no message. */
        });
        return;
      }
      void copy(url, "link");
      return;
    }
    if (action === "copy") {
      void copy(`${window.location.origin}/post/${post.id}`, "link");
      return;
    }
    /*
     * Contact agent. The sheet has offered this row since it was written and
     * nothing here answered it, so the highest intent tap in the whole layer,
     * message the person selling the flat, quietly did nothing at all.
     *
     * `/messages/new?listing=` is the bridge the listing page already uses: it
     * resolves the agent from the listing server side and opens the thread, so
     * the social layer needs no second way to start a conversation.
     */
    if (action === "contact") {
      if (!post.listing) {
        banner.error("There is no flat on this post to ask about.");
        return;
      }
      router.push(`/messages/new?listing=${post.listing.id}`);
      return;
    }
    if (!signedIn) {
      router.push(guestHref);
      return;
    }
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
    /* Remove share: no slide to confirm, because the banner offers Undo, which
       puts it back only if a share is still free. */
    if (action === "remove-share") {
      startTransition(async () => {
        try {
          const result = await removeListingShare({ postId: post.id });
          if (!result.ok) {
            banner.error(result.error);
            return;
          }
          setPosts((all) => all.filter((p) => p.id !== post.id));
          const listingId = post.listingShare?.listingId ?? null;
          const note = post.body;
          if (!listingId) {
            banner.success(SHARE_WORDS.removed);
          } else {
            bannerWithUndo(SHARE_WORDS.removed, {
              undo: async () => {
                const again = await shareListingToFeed({ listingId, ...(note ? { note } : {}) });
                return again.ok ? { ok: true } : { ok: false, error: again.error };
              },
              undone: SHARE_WORDS.restored,
              onUndone: () => router.refresh(),
            });
          }
          router.refresh();
        } catch (error) {
          if (!tapFailedOffline(error)) throw error;
        }
      });
      return;
    }
    if (action === "edit") {
      setEditing(post.id);
      return;
    }
    /* Taking a post down is confirmed by the slide (`DeleteSheet`), never by
       the browser's `confirm()` (ONE-PRODUCT-DECISIONS, destructive confirm). */
    if (action === "delete") {
      setDeleting(post);
      return;
    }
    /* Save is optimistic now that it is a disc in the row: the mark shows on
       the tap and goes back the moment the server disagrees, like a like. */
    if (action === "save") {
      const saved = !post.saved;
      if (saved) feedback("select");
      patch(post.id, { saved });
      /* Said on the tap, with Undo (lib/ui/optimistic.ts); the server answer
         only corrects. A tap kept for later keeps its mark. */
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
        // Both of these act on a PERSON, so they need the author's user id and
        // not the post's. Passing the post id would have blocked a uuid that is
        // nobody, silently succeeded, and shown "Blocked" for an action that did
        // nothing at all.
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
          /* Their posts leave the list now. The refresh re-reads only the first
             page, so anything of theirs on a page read further down stayed on
             screen after the block said it was done. */
          if (result.ok) setPosts((all) => all.filter((p) => p.author?.id !== target));
          router.refresh();
          return;
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /*
   * Filtered in the browser over what the page already holds, so moving
   * between chips costs nothing. Apartments are posts carrying a listing;
   * Updates are everything a person wrote that is not one; Stories and Reviews
   * are their own objects and arrive from their own reads on the server, which
   * is why neither of them is filtered out of `posts` here.
   */
  const shown = (
    chip === "apartments"
      ? posts.filter((post) => Boolean(post.listing))
      : chip === "updates"
        ? posts.filter((post) => !post.listing && post.authorKind === "USER")
        : posts
  ).filter((post) => inCategory(post, category));

  const counts: Partial<Record<DistrictChip, number>> = district
    ? {
        apartments: posts.filter((post) => Boolean(post.listing)).length,
        stories: district.stories.length,
        reviews: district.reviews.length,
        updates: posts.filter((post) => !post.listing && post.authorKind === "USER").length,
      }
    : {};

  return (
    <div className="flex flex-col gap-[var(--nf-feed-gap)]">
      {district && areaName ? (
        <>
          <DistrictHeader
            name={areaName}
            city={district.city}
            places={district.places}
            currentSlug={district.slug}
            trailing={district.join}
          />
          <DistrictChips active={chip} counts={counts} onPick={setChip} />
        </>
      ) : null}

      {/*
        * The region the chips filter, named so they can point at it.
        *
        * `DistrictChips` declared `role="tablist"` over five `role="tab"`
        * buttons and there was no `role="tabpanel"` anywhere on the page, so
        * the tab set promised a relationship that did not exist: a screen
        * reader heard "tab 3 of 5" and had nothing to move to. One panel,
        * because one region changes; the live chip is the only one that names
        * it, exactly as `ProfileTabs` does.
        *
        * The tab attributes are conditional because the chips are: no chips
        * outside a district feed, so no panel to be a panel of. The flex
        * classes are the parent's own, so the gap between these children is
        * the value it always was.
        */}
      <div
        {...(district && areaName
          ? {
              id: districtPanelId(chip),
              role: "tabpanel",
              "aria-labelledby": districtTabId(chip),
              tabIndex: -1,
            }
          : {})}
        className="flex flex-col gap-[var(--nf-feed-gap)]"
      >
        {district && chip === "stories" ? (
        <StoryGrid stories={district.stories} handle={areaName ?? "this place"} isOwner={false} />
      ) : null}

      {/* Reviews of the stays filed under this place, written by guests who
          actually stayed. `reviews_insert_own` is what makes that true, and it
          is the reason this chip can be a read rather than an apology. */}
      {district && chip === "reviews" ? (
        district.reviews.length > 0 ? (
          <ReviewList reviews={district.reviews} />
        ) : (
          <EmptyPanel
            icon="reviews"
            title={`Nobody has reviewed a stay around ${areaName ?? "here"} yet`}
            body="A guest can write one once their stay is finished, and it lands here and on the flat itself. Until then there is nothing to read, and Vallo will not invent any."
            action={{ href: "/search", label: "See the stays here" }}
          />
        )
      ) : null}

      {/*
        THE PERMANENT COMPOSER IS GONE FROM THE TOP OF THE FEED.

        It sat above the first post as an open panel: two mode chips, a
        four-line text area, an audience line, a hint sentence, an image button
        and a Post button. That is roughly a third of a phone screen, on every
        visit, offered to somebody who came to READ. A person who arrives
        wanting to post is one tap from the same composer through the plus
        control that floats over this list; a person who arrives wanting to read
        was scrolling past a form.

        Nothing was removed from the product. `AroundFab` opens the composer,
        and it is the control this platform already uses for "make something"
        on every other screen, so posting now works the way listing and messaging
        already do rather than being the one thing with a permanent form.
      */}

      {chip !== "stories" && chip !== "reviews" && shown.length === 0 ? (
        /* One empty-state anatomy across `/around` and `/u`. See `emptyTitle`
           above: this was a bordered paragraph with no mark, no heading and
           nothing to do, one tap from a screen that had all three. */
        category && categoryEmpty && posts.length > 0 ? (
          <EmptyPanel icon="home-search" title={categoryEmpty.title} body={categoryEmpty.body} action={categoryEmpty.action} />
        ) : (
          <EmptyPanel
            icon={emptyIcon}
            title={emptyTitle ?? DEFAULT_EMPTY_TITLE}
            body={emptyMessage}
            {...(emptyAction ? { action: emptyAction } : {})}
          />
        )
      ) : null}

      {(chip === "stories" || chip === "reviews" ? [] : shown).map((post, index, list) => {
        const lead = leadPropsFor(leadIds, post.id, leadSettled);
        return (
        <div
          key={post.id}
          className={["flex flex-col gap-[var(--nf-feed-gap)]", lead.className ?? ""].filter(Boolean).join(" ")}
          style={lead.style}
        >
          <FreshArrival postId={post.id}>
          <ViewportPost postId={post.id}>
            <PostCard
              post={post}
              locale={locale}
              onLike={() => onLike(post)}
              onRepost={() => onRepost(post)}
              onReply={() => router.push(signedIn ? `/post/${post.id}?reply=1` : guestHref)}
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
          </FreshArrival>

          {/*
            THE CARD NO LONGER UNFOLDS A COMPOSER, AND IT USED TO.

            Tapping the reply glyph opened a text box under the card, in the
            feed, with the conversation you were joining still collapsed to a
            single reply count above it. So the one moment a person most needs
            to see what has already been said is the one moment this hid it,
            and the reply they wrote was written blind.

            It goes to the thread now, with `?reply=1`, which opens the post
            with every answer under it and the composer focused and already
            addressed. That is one tap, the same as before, and it lands
            somewhere with a URL: the back button returns to the feed, the
            address can be sent to somebody, and a reload does not lose a
            half-written reply's context.

            The old comment defended this as "no new page, no lost scroll
            position". Scroll position is worth less than knowing what you are
            replying to.
          */}
          {aside && index === Math.min(2, list.length - 1) ? aside : null}
        </div>
        );
      })}

        {loadMore && shown.length > 0 && chip !== "stories" && chip !== "reviews" ? (
          <div className="nf-feed-more" data-testid="feed-more">
            <div ref={sentinelRef} aria-hidden="true" className="nf-feed-more__sentinel" />
            {cursor ? (
              <Button
                variant="secondary"
                className="nf-feed-more__button"
                onClick={() => void readMore()}
                disabled={loadingMore}
                aria-busy={loadingMore}
                leadingIcon="arrow-down"
                data-testid="feed-load-more"
              >
                {loadingMore ? MORE_COPY.loading : MORE_COPY.more}
              </Button>
            ) : null}
            <p role="status" aria-live="polite" className="nf-feed-more__status">
              {loadError
                ? loadError
                : loadingMore
                  ? MORE_COPY.loading
                  : cursor
                    ? ""
                    : POST_COPY.endOfSession}
            </p>
          </div>
        ) : null}
      </div>

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
            isListingShare: Boolean(sheetFor.listingShare),
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
        onConfirm={async () => {
          const target = deleting;
          if (!target) return false;
          const result = await removePost({ postId: target.id });
          if (!result.ok) {
            banner.error(result.error);
            return false;
          }
          setPosts((all) => all.filter((p) => p.id !== target.id));
          banner.success("Post deleted");
          router.refresh();
          return true;
        }}
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
