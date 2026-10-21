"use client";

import { initial as initialOf } from "@/lib/text/initial";
import { DEFAULT_LOCALE, formatNumber, type Locale } from "@vallo/i18n/core";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motionQuiet } from "@/lib/motion/gate";
import { isPhotoMorphFor, startPhotoMorph } from "@/lib/motion/photo-morph";
import { AuthGate } from "@/components/auth/AuthGate";
import { PostBody } from "./PostBody";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ActionPill } from "./ActionPill";
import { PostPicture } from "./PostPicture";
import { MediaRail } from "./MediaRail";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { TierBadge } from "@/components/trust/TierBadge";
import type { BadgeTier } from "@/lib/trust/badge-tier";
import { countOf } from "@vallo/i18n/core";
import type { ClientCopy } from "@/lib/i18n/client-copy-of";
import "./feed-v2.css";

/** The words a post card draws, from `feedV2.card` in the dictionary. */
type CardWords = ClientCopy["feedV2"]["card"];

/**
 * A post, as the founder's 13 October reference draws it.
 *
 * A round face with the name in bold over the @handle, the time and the menu
 * at the right; then the caption, then the picture in one large rounded
 * container with the place laid over it; then a rounded "Drop a comment" pill
 * with the heart beside it, and the quieter repost, send and save under that.
 * A post with words and no picture puts the words inside the same rounded
 * container, a short line set large and a long one folded with "Read more".
 *
 * Every capability the feed had is kept: reactions, reposts, replies (the
 * pill opens the post's own page with the reply box focused), the area
 * moderator mark, a listing attached, the assistant's cited listings, report,
 * mute and block (the menu), the picture rail, and the account's side as a
 * role word. The card's look lives in `feed-v2.css`; the older rules in
 * `social-feed.css` still serve the thread's replies and the profile's lists.
 */

export type PostAuthor = {
  /** The real user id. Block and mute need a person, not a post. */
  id: string;
  handle: string | null;
  displayLabel: string | null;
  avatarPath: string | null;
  isAgent: boolean;
  /** The side of that supply account: owner is a landlord, agent an agent. */
  supplyRole?: "owner" | "agent" | null;
  /** Set when this person looks after the place the post is in. */
  moderatorOf: string | null;
  /**
   * The published badge, `public.person_badge.tier`, read by the surface that
   * loaded the page (`lib/social/author-badges.ts`). Absent means nobody read
   * it, and absent draws no mark: the badge is never inferred on a card.
   */
  tier?: BadgeTier;
};

export type PostListing = {
  id: string;
  title: string;
  area: string;
  city: string;
  priceLabel: string;
  periodLabel: string;
  photoUrl: string | null;
  verified: boolean;
};

export type PostMedia = {
  /** A signed URL. `social-media` is private, so these expire. */
  url: string;
  width: number | null;
  height: number | null;
};

export type PostView = {
  id: string;
  kind: "GIST" | "ASK" | "REPLY" | "SHOWCASE" | "SYSTEM";
  authorKind: "USER" | "BOT" | "SYSTEM";
  author: PostAuthor | null;
  body: string | null;
  createdLabel: string;
  edited: boolean;
  areaName: string | null;
  areaSlug: string | null;
  listing: PostListing | null;
  /** The bot's own note about where its answer came from. */
  sourceNote: string | null;
  /** The listings the assistant cited, resolved through the same policy as any
      other listing on a card, so one taken down since simply is not here. */
  cited: PostListing[];
  replyingTo: string | null;
  repostedBy: string | null;
  replyCount: number;
  likeCount: number;
  repostCount: number;
  viewCount: number;
  liked: boolean;
  reposted: boolean;
  saved: boolean;
  /** Held by the scanner. Only ever sent to its own author. */
  heldReason: string | null;
  /**
   * Taken down, by its author or by a moderator.
   *
   * The row survives because `posts.parent_id` cascades and deleting it would
   * delete the replies underneath. `body` is already null for one of these, but
   * a null body is not the same fact: a card read this as "no words" and drew
   * an empty rectangle with the pictures still on it. This is the fact itself,
   * so every surface that renders a card can say what happened instead.
   */
  removed: boolean;
  isMine: boolean;
  /** Own post, still LIVE, still inside the fifteen minute window. */
  editable: boolean;
  /** The unrendered body, for the editor. Only ever sent to its own author. */
  rawBody: string | null;
  media: PostMedia[];
};

/**
 * A count, in the reader's language.
 *
 * This was hand-rolled: `String(n)` under a thousand, then a suffix glued on
 * with `toFixed`. Three faults in nine lines. It hardcoded ASCII digits and a
 * full stop as the decimal separator, which is the exact fault the platform
 * already fixed for money and for ratings by routing them through `Intl`. It
 * skipped grouping entirely, so eight thousand views rendered as `8140` with
 * nothing to break the digits up. And it went compact at a THOUSAND, so a post
 * with 5,902 views said `5.9k` - a number nobody can compare against the post
 * under it, on a card where the whole point of the figure is comparison.
 *
 * Grouped up to a hundred thousand, compact above it, and the suffix lowered
 * the way `formatMoney` already lowers it, because that is how these are
 * written in Nigeria: 45k, never 45K.
 */
const COMPACT_FROM = 100_000;

function compact(n: number, locale: Locale): string {
  if (Math.abs(n) < COMPACT_FROM) return formatNumber(n, locale);
  return formatNumber(n, locale, { notation: "compact", maximumFractionDigits: 1 }).replace(
    /[A-Za-z]+$/,
    (suffix) => suffix.toLowerCase(),
  );
}

function Avatar({ author }: { author: PostAuthor | null }) {
  const initial = initialOf(author?.displayLabel ?? author?.handle);
  const face = (
    <span className="nf-pc__avatar" aria-hidden="true">
      {author?.avatarPath ? (
        /*
         * A plain img, like every one of its siblings. `next/image` THROWS on
         * a host that is not in `remotePatterns`, and a throw here is a 500 on
         * the whole feed rather than a missing picture; Google alone serves
         * avatars from four shards. 44px on screen.
         */
        <RemoteImage src={author.avatarPath} alt="" width={88} height={88} sizes="44px" loading="lazy" />
      ) : (
        <span className="nf-pc__monogram">{initial}</span>
      )}
    </span>
  );
  /*
   * THE FACE OPENS THE PERSON (founder, 7 October: "I can't click a profile").
   * It is the same door as the name beside it: the name is the one a screen
   * reader and the keyboard use, so the face is taken out of the tab order
   * rather than announced twice.
   */
  if (!author?.handle) return face;
  return (
    <Link
      href={`/u/${author.handle}`}
      className="nf-pc__face"
      tabIndex={-1}
      aria-hidden="true"
      data-testid="post-avatar"
    >
      {face}
    </Link>
  );
}

/**
 * THE WORDS OF A POST, IN THE SHAPE THEIR LENGTH ASKS FOR (founder, 13 October:
 * "text posts must look as neat as photo posts").
 *
 *   frame    a post with no picture: the words sit INSIDE the rounded
 *            container the pictures use. A short line is set large; a long
 *            one at body size, folded to a few lines with "Read more".
 *   caption  a post with pictures: the words sit ABOVE the picture, folded to
 *            a few lines the same way.
 *
 * The fold is a CSS line clamp and the control is a button inside the card, so
 * it keeps its own tap and does not open the post. On the post's own page
 * (`detail`) nothing is folded: that page is where the whole post is read.
 */
const SHORT_MAX = 90;
const FOLD = { frame: { chars: 320, lines: 8 }, caption: { chars: 200, lines: 5 } } as const;

export function shapeOfText(text: string, mode: "frame" | "caption", detail: boolean) {
  const plain = text.trim();
  const lines = plain.split("\n").length;
  const big = mode === "frame" && plain.length <= SHORT_MAX && lines <= 2;
  const fold = FOLD[mode];
  const long = !detail && !big && (plain.length > fold.chars || lines > fold.lines);
  return { big, long };
}

function PostText({
  text,
  mode,
  detail,
  words,
  system,
}: {
  text: string;
  mode: "frame" | "caption";
  detail: boolean;
  words: CardWords;
  system: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { big, long } = shapeOfText(text, mode, detail);
  const clamped = long && !open;
  return (
    <>
      <PostBody
        text={text}
        className={[
          "nf-post__body nf-pc__text",
          big ? "nf-pc__text--big" : "",
          clamped ? "nf-pc__text--clamped" : "",
          system ? "nf-post__body--system" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {long ? (
        <button type="button" className="nf-pc__more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? words.readLess : words.readMore}
        </button>
      ) : null}
    </>
  );
}

/**
 * THE ACTION ROWS (founder, 13 October reference: "a rounded Drop a comment
 * pill with a comment icon and a heart on the right").
 *
 *   row one   the comment pill, which opens the post's own page with the reply
 *             box focused (the existing reply flow), and the heart.
 *   row two   the quieter things you do with a post: repost, send it to
 *             somebody, and save it to your own shelf at the far edge.
 *
 * Reply, repost, like and save all write a row against an account, so a guest
 * tapping one is sent to sign up carrying this screen and the verb. Share
 * writes nothing and is left alone. Every control is a 44px target. Views stay
 * off the card: a count of how many saw something is a fact about it, not
 * something anybody can do to it. Saves are private, so the save carries no
 * count.
 */
function ActionRows({
  post,
  locale,
  words,
  onLike,
  onReply,
  onRepost,
  onSave,
  onShare,
}: {
  post: PostView;
  locale: Locale;
  words: CardWords;
  onLike: () => void;
  onReply: () => void;
  onRepost: () => void;
  onSave?: () => void;
  onShare: () => void;
}) {
  const likes = compact(post.likeCount, locale);
  const reposts = compact(post.repostCount, locale);
  return (
    <div className="nf-pc__actions">
      <div className="nf-pc__reply-row">
        <AuthGate action="post">
          <button
            type="button"
            className="nf-pc__comment nf-post__act--reply"
            aria-label={`${words.commentPill}, ${countOf(post.replyCount, "replies", locale)}`}
            onClick={onReply}
            data-testid="post-comment-pill"
          >
            <UiIcon name="chat-bubble" size={18} />
            <span className="nf-pc__comment-text">{words.commentPill}</span>
            {/* A word break the flex row does not draw, so the visible words
                read "Drop a comment 56" and sit inside the name. */}
            {" "}
            {post.replyCount > 0 ? (
              <span className="nf-pc__comment-count nf-numeric" aria-hidden="true">
                {compact(post.replyCount, locale)}
              </span>
            ) : null}
          </button>
        </AuthGate>

        <AuthGate action="react">
          <ActionPill
            icon="heart"
            tone="like"
            className="nf-post__act--like"
            pressed={post.liked}
            payoff
            count={post.likeCount > 0 ? likes : undefined}
            label={(post.liked ? words.likedUndo : words.like).replace("{count}", likes)}
            onClick={onLike}
          />
        </AuthGate>
      </div>

      <div className="nf-pc__more-row">
        <AuthGate action="react">
          <ActionPill
            icon="repost-loop"
            tone="repost"
            className="nf-post__act--repost"
            pressed={post.reposted}
            payoff
            count={post.repostCount > 0 ? reposts : undefined}
            label={(post.reposted ? words.repostedUndo : words.repost).replace("{count}", reposts)}
            onClick={onRepost}
          />
        </AuthGate>

        <ActionPill
          icon="send"
          tone="share"
          round
          className="nf-post__act--share"
          label={words.share}
          onClick={onShare}
        />

        {onSave ? (
          <AuthGate action="react">
            <ActionPill
              icon="bookmark"
              tone="save"
              round
              className="nf-post__act--save"
              pressed={post.saved}
              label={post.saved ? words.savedRemove : words.save}
              onClick={onSave}
            />
          </AuthGate>
        ) : null}
      </div>
    </div>
  );
}

/** What keeps its own tap inside a card. Anything else opens the post. */
const CONTROL =
  "a, button, input, textarea, select, label, summary, video, [role='button'], [role='menuitem'], [role='dialog'], [contenteditable='true']";

/** A single picture's frame shape: its own proportion, held between a tall
    portrait and a wide landscape so no card is a sliver or a skyscraper. */
function frameRatio(media: PostMedia): string {
  const w = media.width ?? 0;
  const h = media.height ?? 0;
  if (!w || !h) return "5 / 4";
  const ratio = Math.min(1.6, Math.max(0.8, w / h));
  return `${ratio.toFixed(3)} / 1`;
}

export function PostCard({
  post,
  locale = DEFAULT_LOCALE,
  onLike,
  onReply,
  onRepost,
  onShare,
  onSave,
  onMenu,
  editor,
  detail = false,
}: {
  post: PostView;
  /* Optional so a caller that has not been threaded yet still compiles and
     still renders correct English, rather than the whole platform having to
     change in one commit. */
  locale?: Locale;
  onLike: () => void;
  onReply: () => void;
  onRepost: () => void;
  onShare: () => void;
  /** The save disc in the action row. A surface that cannot save (a preview,
      a record) leaves it out and the row draws no disc. */
  onSave?: () => void;
  /** Opens the action sheet. The sheet itself belongs to the surface, so one
      sheet exists per screen rather than one per card. */
  onMenu: () => void;
  /** Rendered in place of the body while this post is being changed. */
  editor?: React.ReactNode;
  /** The post's own page: adds the time and view line above the actions. */
  detail?: boolean;
}) {
  /* Read before the early return below: a hook runs on every render. */
  const copy = useClientCopy();
  const aroundLine = copy.uiCommon.around;
  const words = copy.feedV2.card;
  /*
   * THE PHOTOGRAPH TRAVELS (motion 18, photo open).
   *
   * Tapping a card names its picture block for the View Transitions API and
   * the thread's own card claims the same name when it mounts, so the browser
   * carries the picture from the feed into the thread instead of cutting. The
   * name is lent on the tap and given back (`ListingCard` is the precedent and
   * explains why a permanent name would abort every transition on a page that
   * shows one post twice). `arriving` is true only inside the 1.5s window
   * `startPhotoMorph` opens, so a hard load names nothing.
   */
  const mediaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  /*
   * TAPPING THE POST OPENS THE POST; TAPPING A CONTROL DOES THAT CONTROL.
   *
   * There is no overlay anchor: the card listens for the click itself and
   * opens the post only when the tap did not land on (or inside) something
   * that is its own control, so nothing can be painted over a control
   * whatever any animation does to the stacking order (the dead feed of 7
   * October, `docs/BACK_NAVIGATION.md`). A tap that ends a text selection is a
   * selection, not a navigation. The time is a real link to the post, so a
   * keyboard and a screen reader have the same door in.
   */
  const openPost = (event: React.MouseEvent<HTMLElement>) => {
    if (editor) return;
    const target = event.target as HTMLElement;
    const control = target.closest(CONTROL);
    if (control !== null && control !== event.currentTarget) return;
    const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (selection && !selection.isCollapsed && selection.toString().trim() !== "") return;
    const href = `/post/${post.id}`;
    /* A cmd or ctrl click, or the middle button, means "in a new tab" (audit
       A7), opened from inside the person's own gesture. Shift and alt are the
       browser's to answer and are left alone rather than guessed at. */
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(new URL(href, window.location.href).toString(), "_blank", "noopener");
      return;
    }
    if (event.shiftKey || event.altKey || event.button !== 0) return;
    const media = mediaRef.current;
    if (media && !motionQuiet()) {
      media.style.viewTransitionName = `post-photo-${post.id}`;
      startPhotoMorph(`post-${post.id}`);
      window.setTimeout(() => {
        media.style.viewTransitionName = "";
      }, 1500);
    }
    router.push(href);
  };
  const [arriving] = useState(() => isPhotoMorphFor(`post-${post.id}`));
  /*
   * A post that was taken down draws NOTHING here (founder, item 4: "a deleted
   * post is deleted"). Every listing read excludes removed rows at the query,
   * so a card should never be handed one; this is the second lock. The one
   * tombstone in the product is drawn by the thread view, inside a
   * conversation somebody replied into, and never by a card.
   */
  if (post.removed) return null;

  const isSystem = post.authorKind === "SYSTEM";
  const isBot = post.authorKind === "BOT";
  const hasMedia = post.media.length > 0;
  const hasWords = Boolean(post.body);
  /* Words with nothing under them but the post's own tools: the words get
     the rounded frame a picture would have had. */
  const textFrame = !hasMedia && (hasWords || Boolean(editor));

  /* The time is the post's own link: the keyboard's and the screen reader's
     way into the thread, as on every feed people know. Its name starts with
     the time the eye reads (WCAG 2.5.3, label in name). */
  const when = (
    <Link
      href={`/post/${post.id}`}
      className="nf-pc__when"
      aria-label={`${post.createdLabel}${post.edited ? ` · ${words.edited}` : ""}. ${words.openPost}`}
    >
      {post.createdLabel}
      {post.edited ? ` · ${words.edited}` : ""}
    </Link>
  );

  /*
   * THE PLACE, AS A LABEL ON THE FRAME. This is a network about homes, stays
   * and neighbourhoods, so where a post was written is part of what it says.
   * It sits in the frame's lower right on a dark scrim, as the reference sets
   * its label, and takes you to the place. The link is the 44px target; the
   * chip is drawn inside it.
   */
  const place =
    post.areaName && post.areaSlug && !isSystem ? (
      <Link href={`/around/${post.areaSlug}`} className="nf-post__place nf-pc__place">
        <span className="nf-post__place-chip">
          <UiIcon name="location" size={12} filled />
          <span className="truncate">{aroundLine.replace("{area}", post.areaName)}</span>
        </span>
      </Link>
    ) : null;

  const roleWord =
    post.author?.isAgent && !isSystem && !isBot
      ? post.author.supplyRole === "owner"
        ? words.roleLandlord
        : words.roleAgent
      : null;

  const body = (
    <>
      {post.repostedBy ? (
        <p className="nf-pc__reposted">
          <UiIcon name="repost-loop" size={14} />
          {words.repostedBy.replace("{name}", post.repostedBy)}
        </p>
      ) : null}

      {/*
        THE HEAD, AS THE REFERENCE DRAWS IT: a round face, the name in bold
        with the @handle under it, the time at the right and the menu beside
        it. The mark beside the name is `TierBadge`, the one badge on the
        platform, drawn from `public.person_badge` and nothing else (a tick
        for `isAgent` is a role marker and not a check of anybody,
        `lib/trust/badge-tier.ts`). The role word is the account's own side
        (`social_profiles.supply_role`), and the moderator mark is real.
      */}
      <header className="nf-pc__head">
        {isSystem || isBot ? (
          <span className="nf-pc__avatar" aria-hidden="true">
            <span className="nf-pc__monogram">V</span>
          </span>
        ) : (
          <Avatar author={post.author} />
        )}

        <div className="nf-pc__who">
          {isSystem ? (
            <span className="nf-pc__name">Vallo</span>
          ) : isBot ? (
            <>
              <span className="nf-pc__name">Vallo AI</span>
              <span className="nf-pc__handle">{words.assistant}</span>
            </>
          ) : (
            <>
              <span className="nf-pc__nameline">
                <Link
                  href={post.author?.handle ? `/u/${post.author.handle}` : "#"}
                  className="nf-pc__name"
                  data-testid="post-author"
                >
                  <span className="nf-pc__name-text">
                    {post.author?.displayLabel ?? `@${post.author?.handle ?? words.someone}`}
                  </span>
                </Link>
                {post.author?.tier && post.author.tier !== "none" ? (
                  <span className="nf-pc__tick">
                    <TierBadge tier={post.author.tier} size={14} />
                  </span>
                ) : null}
              </span>
              {post.author?.handle ? <span className="nf-pc__handle">@{post.author.handle}</span> : null}
            </>
          )}
        </div>

        <div className="nf-pc__side">
          {roleWord || post.author?.moderatorOf ? (
            <span className="nf-pc__marks">
              {roleWord ? <span className="nf-pc__mark">{roleWord}</span> : null}
              {post.author?.moderatorOf ? (
                <span
                  className="nf-pc__mark nf-pc__mark--mod"
                  aria-label={words.looksAfter.replace("{place}", post.author.moderatorOf)}
                >
                  <span aria-hidden="true">{words.mod}</span>
                </span>
              ) : null}
            </span>
          ) : null}
          {when}
        </div>

        {/* The header carries the name, the time and this. Nothing else: the
            bookmark lives in the sheet this opens. */}
        <button
          type="button"
          className="nf-post__act nf-post__kebab nf-pc__kebab"
          aria-label={words.moreActions}
          aria-haspopup="dialog"
          onClick={onMenu}
        >
          <UiIcon name="more" size={20} />
        </button>
      </header>

      {post.replyingTo ? (
        <p className="nf-pc__replying">
          {words.replyingTo} <span>{post.replyingTo}</span>
        </p>
      ) : null}

      {post.heldReason ? (
        <p className="nf-pc__held">
          {post.heldReason} {words.onlyYou}
        </p>
      ) : null}

      {/*
        CAPTION FIRST, THEN THE PICTURE (founder, 13 October). With pictures,
        the words read above them, exactly as the reference sets it. Signed
        URLs against a private bucket, which is why they are read and signed
        for a whole page at once and why this is a plain `img`: a signed URL
        carries a token and an expiry, and running it through the image
        optimiser would cache somebody's private photograph behind a URL that
        outlives the signature. Every frame is its shape before a byte
        arrives, so the card does not jump when the pictures do.
      */}
      {hasMedia ? (
        <>
          {editor ? (
            <div className="nf-pc__editor">{editor}</div>
          ) : hasWords ? (
            <div className="nf-pc__caption">
              <PostText text={post.body as string} mode="caption" detail={detail} words={words} system={isSystem} />
            </div>
          ) : null}

          <div
            ref={mediaRef}
            className={`nf-pc__frame nf-pc__media ${post.media.length > 1 ? "nf-pc__media--rail" : "nf-pc__media--one"}`}
            style={{
              ...(post.media.length === 1 ? { aspectRatio: frameRatio(post.media[0]!) } : {}),
              ...(arriving ? { viewTransitionName: `post-photo-${post.id}` } : {}),
            }}
          >
            {post.media.length > 1 ? (
              <MediaRail media={post.media.slice(0, 4)} />
            ) : (
              <PostPicture
                src={post.media[0]!.url}
                alt={words.pictureAlt}
                width={post.media[0]!.width || 1200}
                height={post.media[0]!.height || 900}
                sizes="(max-width: 640px) 100vw, 600px"
              />
            )}
            {place ? <div className="nf-pc__chips">{place}</div> : null}
          </div>
        </>
      ) : textFrame ? (
        <div className="nf-pc__frame nf-pc__textframe" ref={mediaRef}>
          {editor ? (
            editor
          ) : (
            <PostText text={post.body as string} mode="frame" detail={detail} words={words} system={isSystem} />
          )}
          {place ? <div className="nf-pc__chips nf-pc__chips--text">{place}</div> : null}
        </div>
      ) : place ? (
        <div className="nf-pc__plainplace">{place}</div>
      ) : null}

      {post.cited.length > 0 ? (
        <div className="nf-post__cited">
          {post.cited.map((item) => (
            <Link key={item.id} href={`/listing/${item.id}`}>
              <span className="nf-post__cited-title truncate-none">{item.title}</span>
              <span className="nf-post__cited-price nf-numeric">
                {item.priceLabel} <span className="font-normal">{item.periodLabel}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {post.sourceNote ? <p className="nf-pc__note">{post.sourceNote}</p> : null}

      {post.listing ? <ListingAttachment listing={post.listing} verifiedLabel={copy.common.verified} /> : null}

      {detail ? (
        /* On the post's own page: when it was written and how many have
           seen it, the facts the feed card leaves out. A glyph and a figure,
           no noun to inflect. */
        <p className="nf-post__meta">
          <span>{post.createdLabel}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="nf-post__meta-views">
            <UiIcon name="views" size={12} />
            <span className="nf-numeric">{compact(post.viewCount, locale)}</span>
            <span className="sr-only">{words.seen}</span>
          </span>
        </p>
      ) : null}

      <ActionRows
        post={post}
        locale={locale}
        words={words}
        onLike={onLike}
        onReply={onReply}
        onRepost={onRepost}
        onSave={onSave}
        onShare={onShare}
      />
    </>
  );

  return (
    <article
      className={[
        "nf-post nf-post--pressable nf-pc",
        isSystem ? "nf-post--system nf-pc--system" : "",
        isBot ? "nf-post--ai nf-pc--ai" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={describe(post, words)}
      onClick={openPost}
      onAuxClick={openPost}
      data-testid="post-card"
    >
      {body}
    </article>
  );
}

/**
 * THE FLAT ON A POST, AND WHY IT IS NOT F3's `ListingCard`.
 *
 * The rule is that a listing card on any surface comes from the one shared
 * component and is never forked. This is not that card and cannot be: it
 * takes `PostListing`, which is the eight-field projection
 * `lib/social/posts-queries.ts` returns for a listing attached to a post,
 * and `ListingCard` takes a whole `Listing` (photos, facts, market, price
 * model, save state). `lib/` is read-only from here, so adopting the shared
 * card needs that query widened first; it is filed as a finding rather than
 * worked around by copying the catalogue card's anatomy into this file.
 *
 * SO IT IS A COMPACT ATTACHMENT, ONE TAP, NO SECOND PRIMARY. The plate used to
 * be a wide photograph, a title, a place, a large figure and a lit "See the
 * place" button: a second primary on a card whose primary is the post, and
 * the clutter A.5 names. It is now one row inside a quiet inset: a square
 * thumbnail (reserved, blur-up), the title and the place, the figure set
 * tabular on the right, and a chevron. The whole row is the link, so the way
 * in is the attachment itself, as on every product people already know.
 */
function ListingAttachment({ listing, verifiedLabel }: { listing: PostListing; verifiedLabel: string }) {
  return (
    <Link href={`/listing/${listing.id}`} className="nf-post__attach">
      <span className="nf-post__attach-thumb" aria-hidden="true">
        {listing.photoUrl ? (
          <PostPicture src={listing.photoUrl} alt="" width={160} height={160} sizes="64px" />
        ) : (
          <UiIcon name="home" size={20} />
        )}
      </span>
      <span className="nf-post__attach-text">
        <span className="nf-post__attach-title">{listing.title}</span>
        <span className="nf-post__attach-place">
          {listing.area}, {listing.city}
          {listing.verified ? <span className="nf-post__attach-verified"> &middot; {verifiedLabel}</span> : null}
        </span>
      </span>
      <span className="nf-post__attach-price nf-numeric">
        {listing.priceLabel}
        <span className="nf-post__attach-period">{listing.periodLabel}</span>
      </span>
      <UiIcon name="chevron-right" size={16} className="nf-post__attach-chevron" />
    </Link>
  );
}

/** What a screen reader hears before the card's contents. */
function describe(post: PostView, words: CardWords): string {
  if (post.authorKind === "SYSTEM") return words.describeVallo;
  if (post.authorKind === "BOT") return words.describeBot;
  const who = post.author?.displayLabel ?? post.author?.handle ?? words.someone;
  if (!post.author?.isAgent) return words.describePlain.replace("{name}", who);
  return (post.author.supplyRole === "owner" ? words.describeLandlord : words.describeAgent).replace("{name}", who);
}
