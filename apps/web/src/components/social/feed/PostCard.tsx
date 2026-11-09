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
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
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

/** A roommate post a feed post shares (Vallo Roommates, 8 November 2026). Words come with it from the read. */
export type PostRoommateListing = {
  id: string;
  href: string;
  title: string;
  kindLabel: string;
  place: string;
  priceLabel: string | null;
  periodLabel: string;
  photoUrl: string | null;
  verified: boolean;
  words: { kicker: string; view: string; verified: string };
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
  /** What the listing is, when the read says (Agent FEATURES' post model).
      Absent, the feed's categories fall back to the price period. */
  kind?: "property" | "stay" | "restaurant";
  /** Facts for the embedded card, drawn only when the read supplies them:
      never filled in or guessed. */
  beds?: number | null;
  baths?: number | null;
  /** Up to three short amenity words, from the listing itself. */
  amenities?: readonly string[];
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
  /** A Vallo Roommates post shared to the feed, when there is one (optional: older reads leave it out). */
  roommateListing?: PostRoommateListing | null;
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
 * THE WORDS OF A POST, IN THE SHAPE THEIR LENGTH ASKS FOR.
 *
 *   frame    a post with no picture: the words ARE the post, at reading size,
 *            as tall as they are, the way X sets one (29 October 2026; it used
 *            to sit in a rounded box with a short line set large). A long one
 *            folds to eight lines with "Read more".
 *   caption  a post with pictures: the words sit ABOVE the picture, folded to
 *            a few lines the same way.
 *
 * The fold is a CSS line clamp and the control is a button inside the card, so
 * it keeps its own tap and does not open the post. On the post's own page
 * (`detail`) nothing is folded: that page is where the whole post is read.
 */
const FOLD = { frame: { chars: 320, lines: 8 }, caption: { chars: 200, lines: 5 } } as const;

export function shapeOfText(text: string, mode: "frame" | "caption", detail: boolean) {
  const plain = text.trim();
  const lines = plain.split("\n").length;
  /* A text post reads at reading size, the way X sets one (29 October 2026,
     the founder: "Hey" sat alone in a big box). Nothing is blown up. */
  const big = false;
  const fold = FOLD[mode];
  const long = !detail && (plain.length > fold.chars || lines > fold.lines);
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
  const { long } = shapeOfText(text, mode, detail);
  const clamped = long && !open;
  return (
    <>
      <PostBody
        text={text}
        className={[
          "nf-post__body nf-pc__text",
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
 * pill with a comment icon and a heart on the right"; re-set 7 November 2026
 * for the new feed).
 *
 *   row one   what you do TO a post, as bare glyphs with their counts: the
 *             heart, the repost and send-to-somebody at the left, and save to
 *             your own shelf at the far edge. The counts roll when a tap
 *             changes them (`ActionPill`), so the number feels touched.
 *   row two   "Drop a comment": one calm sunken line, the reply count at its
 *             far end, that opens the post's own page with the reply box
 *             focused (the existing reply flow). It reads as the place you
 *             write, which is what it is, and it is a soft rectangle like
 *             every control that carries words.
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
  const replies = compact(post.replyCount, locale);
  /*
   * ONE QUIET ROW (founder, 7 November 2026: "comment, repost and bookmark
   * icons smaller and refined", "cleaner, less stuff"). Like, comment and
   * repost with their counts, share, and the bookmark alone at the far end.
   * The comment used to be a wide "Drop a comment" pill on a second row; it
   * is the same reply door now, a glyph and its count in the row, still 44px
   * to the touch.
   */
  return (
    <div className="nf-pc__actions">
      <div className="nf-pc__more-row">
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

        <AuthGate action="post">
          <ActionPill
            icon="chat-bubble"
            tone="reply"
            className="nf-pc__comment nf-post__act--reply"
            count={post.replyCount > 0 ? replies : undefined}
            label={`${words.comment}, ${countOf(post.replyCount, "replies", locale)}`}
            onClick={onReply}
            data-testid="post-comment-pill"
          />
        </AuthGate>

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
   * THE PLACE, ON THE AUTHOR'S QUIET LINE. This is a network about homes,
   * stays and neighbourhoods, so where a post was written is part of what it
   * says: it sits between the handle and the time, a pin and the place's
   * name, and takes you to the place. It used to be a chip laid over the
   * photograph, which put a label on somebody's picture and made a text post
   * grow a second line for it. The link's name is the whole sentence
   * ("Around Lekki Phase 1"), which starts with nothing the eye does not read
   * and contains everything it does (WCAG 2.5.3).
   */
  const place =
    post.areaName && post.areaSlug && !isSystem ? (
      <Link
        href={`/around/${post.areaSlug}`}
        className="nf-pc__place"
        aria-label={aroundLine.replace("{area}", post.areaName)}
      >
        <UiIcon name="location" size={12} filled />
        <span className="nf-pc__place-name">{post.areaName}</span>
      </Link>
    ) : null;

  const roleWord =
    post.author?.isAgent && !isSystem && !isBot
      ? post.author.supplyRole === "owner"
        ? words.roleLandlord
        : words.roleAgent
      : null;

  /*
   * THE FEATURED LISTING, FULL BLEED (founder, 7 November 2026, the feed
   * reference). A post that features a real listing and carries no pictures
   * of its own is drawn as an editorial card: the listing's own photograph to
   * the card's edges, a soft scrim at its foot, and on it the author, the
   * listing's title and its line, the counts and View property. The tag says
   * what is true: Vallo's own note of a newly published listing is "New
   * listing"; a member who chose to feature one is "Featured listing". The
   * listing is the one `posts-queries` read through `listings_select_published`,
   * so a taken-down flat never reaches this card.
   */
  const featured = post.listing && post.listing.photoUrl && !hasMedia && !isBot && !editor ? post.listing : null;
  if (featured) {
    const tag = isSystem || post.kind === "SHOWCASE" ? words.newListing : words.featuredListing;
    return (
      <article
        className="nf-post nf-post--pressable nf-pc nf-pc--feature"
        aria-label={describe(post, words)}
        onClick={openPost}
        onAuxClick={openPost}
        data-testid="post-card"
        data-variant="feature"
      >
        <div
          ref={mediaRef}
          className="nf-pcf__media"
          style={arriving ? { viewTransitionName: `post-photo-${post.id}` } : undefined}
        >
          <PostPicture src={featured.photoUrl as string} alt={featured.title} width={1200} height={1500} sizes="(max-width: 640px) 100vw, 600px" />
          <span className="nf-pcf__scrim" aria-hidden="true" />
        </div>

        <div className="nf-pcf__top" data-theme="dark">
          <span className="nf-pcf__tag">{tag}</span>
          <span className="nf-pcf__top-actions">
            {onSave ? (
              <AuthGate action="react">
                <ActionPill
                  icon="bookmark"
                  tone="save"
                  round
                  className="nf-post__act--save nf-pcf__glass"
                  pressed={post.saved}
                  label={post.saved ? words.savedRemove : words.save}
                  onClick={onSave}
                />
              </AuthGate>
            ) : null}
            <button
              type="button"
              className="nf-post__act nf-post__kebab nf-pc__kebab nf-pcf__glass"
              aria-label={words.moreActions}
              aria-haspopup="dialog"
              onClick={onMenu}
            >
              <UiIcon name="more" size={20} />
            </button>
          </span>
        </div>

        <div className="nf-pcf__foot" data-theme="dark">
          <div className="nf-pcf__by">
            {isSystem ? (
              <span className="nf-pc__avatar" aria-hidden="true">
                <span className="nf-pc__monogram">V</span>
              </span>
            ) : (
              <Avatar author={post.author} />
            )}
            <span className="nf-pcf__who">
              <span className="nf-pc__nameline">
                {isSystem ? (
                  <span className="nf-pc__name">Vallo</span>
                ) : (
                  <Link
                    href={post.author?.handle ? `/u/${post.author.handle}` : "#"}
                    className="nf-pc__name"
                    data-testid="post-author"
                  >
                    <span className="nf-pc__name-text">
                      {post.author?.displayLabel ?? `@${post.author?.handle ?? words.someone}`}
                    </span>
                  </Link>
                )}
                {!isSystem && post.author?.tier && post.author.tier !== "none" ? (
                  <span className="nf-pc__tick">
                    <TierBadge tier={post.author.tier} size={14} />
                  </span>
                ) : null}
              </span>
              <span className="nf-pc__meta">{when}</span>
            </span>
          </div>

          <h3 className="nf-pcf__title">{featured.title}</h3>
          <p className="nf-pcf__line">
            <span>{[featured.area, featured.city].filter(Boolean).join(", ")}</span>
            <span className="nf-pcf__price nf-numeric">
              {featured.priceLabel} <span className="nf-pcf__period">{featured.periodLabel}</span>
            </span>
          </p>
          {hasWords ? <p className="nf-pcf__caption">{post.body}</p> : null}

          <div className="nf-pcf__row">
            <ActionRows
              post={post}
              locale={locale}
              words={words}
              onLike={onLike}
              onReply={onReply}
              onRepost={onRepost}
              onShare={onShare}
            />
            <Link href={`/listing/${featured.id}`} className="nf-btn nf-btn--primary nf-btn--sm nf-pcf__view" data-testid="post-view-property">
              <span>{words.viewProperty}</span>
              <UiIcon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </article>
    );
  }

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
          <span className="nf-pc__nameline">
            {isSystem ? (
              /* Vallo's own notes carry the platinum mark, the administrator's
                 tier, a size up from a member's tick so it reads as the house. */
              <>
                <span className="nf-pc__name">Vallo</span>
                <span className="nf-pc__tick nf-pc__tick--house">
                  <TierBadge tier="platinum" size={18} />
                </span>
              </>
            ) : isBot ? (
              <span className="nf-pc__name">Vallo AI</span>
            ) : (
              <>
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
              </>
            )}
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
          </span>

          {/* THE QUIET LINE: where (the place) and when (the time), one line
              in the muted ink. A post written in no place shows the author's
              @handle where the place would be, so the line is never just a
              time; with a place, the name above already says who, and a third
              part only truncated all three on a phone. The time never gives
              way, because it is the post's own link. */}
          <span className="nf-pc__meta">
            {place ? (
              place
            ) : isBot ? (
              <span className="nf-pc__handle">{words.assistant}</span>
            ) : !isSystem && post.author?.handle ? (
              <span className="nf-pc__handle">@{post.author.handle}</span>
            ) : null}
            {place || isBot || (!isSystem && post.author?.handle) ? <span className="nf-pc__sep" aria-hidden="true" /> : null}
            {when}
          </span>
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
            className={`nf-pc__frame nf-pc__media ${post.media.length > 1 ? (detail ? "nf-pc__media--rail" : "nf-pc__media--mosaic") : "nf-pc__media--one"}`}
            style={{
              ...(post.media.length === 1 ? { aspectRatio: frameRatio(post.media[0]!) } : {}),
              ...(arriving ? { viewTransitionName: `post-photo-${post.id}` } : {}),
            }}
          >
            {post.media.length > 1 && !detail ? (
              <MediaMosaic media={post.media} alt={words.pictureAlt} moreLabel={words.moreMedia} />
            ) : post.media.length > 1 ? (
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
          </div>
        </>
      ) : textFrame ? (
        /* WORDS ALONE ARE WORDS (29 October 2026, the founder: "Hey" sat in
           a big gradient box). A text post is the text, at reading size, as
           tall as it is, the way X sets one: no frame around it. */
        <div className="nf-pc__plaintext" ref={mediaRef}>
          {editor ? (
            editor
          ) : (
            <PostText text={post.body as string} mode="frame" detail={detail} words={words} system={isSystem} />
          )}
        </div>
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

      {post.roommateListing ? <EmbeddedRoommateListing room={post.roommateListing} /> : null}

      {post.listing ? (
        <EmbeddedListing
          listing={post.listing}
          words={{
            verified: copy.common.verified,
            view: words.viewProperty,
            beds: words.bedsShort,
            baths: words.bathsShort,
          }}
        />
      ) : null}

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
export function EmbeddedListing({
  listing,
  words,
}: {
  listing: PostListing;
  words: { verified: string; view: string; beds: string; baths: string };
}) {
  /* Only what the listing itself says: beds, baths and amenities are drawn
     when the read carried them and never filled in; "verified" only where
     the listing truly is (a published, reviewed row). */
  const facts = [
    typeof listing.beds === "number" && listing.beds > 0 ? words.beds.replace("{count}", String(listing.beds)) : null,
    typeof listing.baths === "number" && listing.baths > 0 ? words.baths.replace("{count}", String(listing.baths)) : null,
    ...(listing.amenities ?? []).slice(0, 3),
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <div className="nf-plc" data-testid="post-listing">
      <Link href={`/listing/${listing.id}`} className="nf-plc__link" aria-label={`${listing.title}, ${words.view}`}>
        <span className="nf-plc__photo" aria-hidden="true">
          {listing.photoUrl ? (
            <PostPicture src={listing.photoUrl} alt="" width={640} height={480} sizes="(max-width: 640px) 40vw, 240px" />
          ) : (
            <UiIcon name="home" size={24} />
          )}
        </span>
        <span className="nf-plc__body">
          <span className="nf-plc__title">{listing.title}</span>
          <span className="nf-plc__place">
            <UiIcon name="location" size={12} filled />
            <span>{[listing.area, listing.city].filter(Boolean).join(", ")}</span>
            {listing.verified ? <span className="nf-plc__verified">{words.verified}</span> : null}
          </span>
          {facts.length > 0 ? (
            <span className="nf-plc__facts">
              {facts.map((fact) => (
                <span key={fact} className="nf-plc__fact">
                  {fact}
                </span>
              ))}
            </span>
          ) : null}
          <span className="nf-plc__foot">
            <span className="nf-plc__price nf-numeric">
              {listing.priceLabel} <span className="nf-plc__period">{listing.periodLabel}</span>
            </span>
            <span className="nf-plc__view">
              {words.view}
              <UiIcon name="arrow-right" size={14} />
            </span>
          </span>
        </span>
      </Link>
      <EmbeddedListingSave listingId={listing.id} title={listing.title} />
    </div>
  );
}

/**
 * A ROOMMATE POST ON THE FEED (Vallo Roommates, 8 November 2026). The same
 * plate as a featured flat, so the feed keeps one card grammar: the room's
 * photograph, what kind of post it is, the title, the place, the person's
 * share or the rent with its period, and "View details" into the room. Only
 * what the post itself says; "Checked by Vallo" only where staff checked it.
 */
export function EmbeddedRoommateListing({ room }: { room: PostRoommateListing }) {
  return (
    <div className="nf-plc" data-testid="post-roommate-listing">
      <Link href={room.href} className="nf-plc__link" aria-label={`${room.title}, ${room.words.view}`}>
        <span className="nf-plc__photo" aria-hidden="true">
          {room.photoUrl ? (
            <PostPicture src={room.photoUrl} alt="" width={640} height={480} sizes="(max-width: 640px) 40vw, 240px" />
          ) : (
            <UiIcon name="house-duplex" size={24} />
          )}
        </span>
        <span className="nf-plc__body">
          <span className="nf-plc__facts">
            <span className="nf-plc__fact">{room.words.kicker}</span>
            <span className="nf-plc__fact">{room.kindLabel}</span>
          </span>
          <span className="nf-plc__title">{room.title}</span>
          {room.place || room.verified ? (
            <span className="nf-plc__place">
              {room.place ? <UiIcon name="location" size={12} filled /> : null}
              {room.place ? <span>{room.place}</span> : null}
              {room.verified ? <span className="nf-plc__verified">{room.words.verified}</span> : null}
            </span>
          ) : null}
          <span className="nf-plc__foot">
            {room.priceLabel ? (
              <span className="nf-plc__price nf-numeric">
                {room.priceLabel} <span className="nf-plc__period">{room.periodLabel}</span>
              </span>
            ) : (
              <span />
            )}
            <span className="nf-plc__view">
              {room.words.view}
              <UiIcon name="arrow-right" size={14} />
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}

/**
 * SAVE, ON THE LISTING A POST FEATURES (the brief, part 2.2). The same heart
 * every listing card carries, through the one `useSaveControl` loop (the
 * optimistic flip, the device fallback when signed out, the outbox when the
 * signal drops, the one banner). It sits beside the row's link, never inside
 * it, so a tap on the heart saves and never opens the listing; the card's
 * own open-the-post handler skips it because it is a button.
 */
function EmbeddedListingSave({ listingId, title }: { listingId: string; title: string }) {
  const save = useSaveControl(listingId);
  return (
    <SaveButton
      saved={save.saved}
      pending={save.pending}
      onToggle={save.toggle}
      title={title}
      className="nf-plc__save"
    />
  );
}

/**
 * THE PHOTO MOSAIC (the feed reference): two pictures side by side, three or
 * more as one tall picture and two stacked beside it, with "+N" on the last
 * when there are more. Every frame holds its shape before a byte arrives. A
 * tap opens the post, where the full rail and the viewer are.
 */
function MediaMosaic({ media, alt, moreLabel }: { media: PostMedia[]; alt: string; moreLabel: string }) {
  const shown = media.slice(0, 3);
  const more = media.length - shown.length;
  return (
    <div className="nf-mosaic" data-count={shown.length}>
      {shown.map((item, index) => (
        <span key={item.url} className="nf-mosaic__cell">
          <PostPicture src={item.url} alt={index === 0 ? alt : ""} width={item.width || 900} height={item.height || 900} sizes="(max-width: 640px) 60vw, 360px" />
          {index === shown.length - 1 && more > 0 ? (
            <span className="nf-mosaic__more" aria-label={moreLabel.replace("{count}", String(more))}>
              +{more}
            </span>
          ) : null}
        </span>
      ))}
    </div>
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
