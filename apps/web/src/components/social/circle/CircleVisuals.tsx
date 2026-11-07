import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { compactCount, countWords } from "@/lib/features/circle/model";
import type { CirclePostView, HomeStats } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";
import { initial } from "@/lib/text/initial";
import "./circle-visuals.css";

/**
 * VALLO CIRCLE'S SHARED VISUALS (Agent FE, 7 November 2026), for the Circle
 * pages Agent FEATURES builds. Each one takes the same props as the plain
 * part it replaces in `app/(app)/circle/_parts`, so the swap is one import.
 *
 *   CircleBanner         the hero: a real listing photograph from Vallo's
 *                        own sample set, the members' real faces when given,
 *                        soft depth, a one-time arrival in transform and
 *                        opacity, and the LIVE counts (never a sample)
 *   CircleTabs           the section row
 *   CirclePostCard       a discussion or a question, by `post.type`
 *   CircleDiscussionCard the discussion card
 *   CircleQuestionCard   the question card, visually its own kind
 *
 * The Circle reads as the professional twin of the feed: organised, calm,
 * trust first. Words come from `CIRCLE_COPY` (English, Agent FEATURES').
 */

const STAT_ICON: Record<"members" | "posts" | "active", UiIconName> = {
  members: "circle-people",
  posts: "chat-bubble",
  active: "trending-up",
};

export type CircleFace = { label: string; avatar: string | null };

export function CircleBanner({
  stats,
  signedIn,
  faces = [],
  photoUrl = "/brand/photos/villa-exterior-sunset.webp",
  feedHref = "/around",
  feedLabel = "Feed",
}: {
  /** From `circle_home_stats`. Null (the read is not live) draws no numbers. */
  stats: HomeStats | null;
  signedIn: boolean;
  /** Real members only, up to three, drawn around the photograph. None given,
      none drawn: a face is never invented. */
  faces?: readonly CircleFace[];
  /** One of Vallo's own sample listing photographs (`public/brand/photos`). */
  photoUrl?: string;
  /** The door back into the feed (the founder: each has a button into the other). */
  feedHref?: string;
  feedLabel?: string;
}) {
  const s = CIRCLE_COPY.stats;
  const tiles = stats
    ? ([
        { key: "members", n: stats.members, words: s.members },
        { key: "posts", n: stats.posts, words: s.posts },
        { key: "active", n: stats.active, words: s.active },
      ] as const)
    : [];
  const shown = faces.slice(0, 3);
  return (
    <section className="nf-cbn" data-theme="dark" aria-labelledby="circle-banner-title" data-testid="circle-hero">
      <Link href={feedHref} className="nf-tap nf-cbn__feed" data-testid="circle-feed-door">
        <UiIcon name="feed" size={16} />
        <span>{feedLabel}</span>
      </Link>

      <div className="nf-cbn__stage" aria-hidden="true">
        <span className="nf-cbn__bloom" />
        <span className="nf-cbn__orbit" />
        <span className="nf-cbn__photo">
          <Image src={photoUrl} alt="" fill sizes="(max-width: 640px) 70vw, 420px" priority={false} />
        </span>
        {shown.map((face, index) => (
          <span key={`${face.label}-${index}`} className="nf-cbn__face" data-at={index}>
            {face.avatar ? (
              <RemoteImage src={face.avatar} alt="" width={112} height={112} sizes="56px" loading="lazy" />
            ) : (
              <span className="nf-cbn__monogram">{initial(face.label)}</span>
            )}
          </span>
        ))}
        <span className="nf-cbn__mark">
          <UiIcon name="circle-people" size={28} filled weight="bold" />
        </span>
      </div>

      <h2 id="circle-banner-title" className="nf-cbn__title">
        {CIRCLE_COPY.title}
      </h2>
      <p className="nf-cbn__line">{CIRCLE_COPY.heroLine}</p>

      {tiles.length > 0 ? (
        <dl className="nf-cbn__stats" data-testid="circle-stats">
          {tiles.map((tile, index) => (
            <div
              key={tile.key}
              className="nf-cbn__stat"
              style={{ "--nf-cbn-i": index } as React.CSSProperties}
              aria-label={countWords(tile.n, tile.words[0], tile.words[1])}
            >
              <span className="nf-cbn__stat-glyph" aria-hidden="true">
                <UiIcon name={STAT_ICON[tile.key]} size={18} />
              </span>
              <dd className="nf-cbn__stat-n nf-numeric" aria-hidden="true">
                {compactCount(tile.n)}
              </dd>
              <dt className="nf-cbn__stat-word" aria-hidden="true">
                {tile.words[1]}
              </dt>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="nf-cbn__actions">
        <ButtonLink href={signedIn ? "/circle/ask" : "/sign-in?next=/circle/ask"} variant="primary" size="md" leadingIcon="chat-bubble">
          {CIRCLE_COPY.ask}
        </ButtonLink>
        <ButtonLink href={signedIn ? "/circle/new" : "/sign-in?next=/circle/new"} variant="glass" size="md">
          {CIRCLE_COPY.start}
        </ButtonLink>
      </div>
    </section>
  );
}

export type CircleTab = { key: string; label: string; href: string };

/** The section row: underline words, the live one in ink with the brand bar. */
export function CircleTabs({ items, active, searchHref }: { items: readonly CircleTab[]; active: string; searchHref?: string }) {
  return (
    <nav className="nf-ctabs" aria-label={CIRCLE_COPY.tabsLabel} data-testid="circle-tabs">
      <ul className="nf-ctabs__row">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="nf-tap nf-ctabs__tab"
              {...(item.key === active ? { "aria-current": "page" as const } : {})}
              data-testid={`circle-tab-${item.key}`}
              scroll={false}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {searchHref ? (
        <Link href={searchHref} className="nf-tap nf-ctabs__search" aria-label={CIRCLE_COPY.tabsLabel}>
          <UiIcon name="search" size={18} />
        </Link>
      ) : null}
    </nav>
  );
}

const C = CIRCLE_COPY.card;

function Byline({ post, now }: { post: CirclePostView; now: number }) {
  const author = post.author;
  return (
    <span className="nf-ccard__by">
      <span className="nf-ccard__face" aria-hidden="true">
        {author?.avatar ? (
          <RemoteImage src={author.avatar} alt="" width={80} height={80} sizes="40px" loading="lazy" />
        ) : (
          <span className="nf-ccard__monogram">{initial(author?.label ?? "M")}</span>
        )}
      </span>
      <span className="nf-ccard__who">
        <span className="nf-ccard__name">
          <span className="nf-ccard__name-text">{author?.label ?? "Member"}</span>
          {author?.verified ? (
            <span className="nf-ccard__tick">
              <UiIcon name="verified" size={14} filled />
            </span>
          ) : null}
        </span>
        <span className="nf-ccard__meta">
          <span>{agoShort(post.createdAt, { now })}</span>
          {post.community ? (
            <>
              <span className="nf-ccard__sep" aria-hidden="true" />
              <span className="nf-ccard__community">{post.community.name}</span>
            </>
          ) : null}
        </span>
      </span>
    </span>
  );
}

/** A discussion: the person, the title in display type, two lines, quiet counts. */
export function CircleDiscussionCard({ post, now }: { post: CirclePostView; now: number }) {
  return (
    <Link href={`/circle/p/${post.id}`} className="nf-ccard" data-testid="circle-post-card" data-kind="discussion">
      <Byline post={post} now={now} />
      <h3 className="nf-ccard__title">{post.title}</h3>
      {post.body && post.body !== post.title ? <p className="nf-ccard__body">{post.body}</p> : null}
      <span className="nf-ccard__counts">
        <span className="nf-ccard__count">
          <UiIcon name="chat-bubble" size={16} />
          <span>{countWords(post.answers, ...(C.replies as unknown as [string, string]))}</span>
        </span>
        {post.helpful > 0 ? (
          <span className="nf-ccard__count">
            <UiIcon name="heart" size={16} />
            <span>{countWords(post.helpful, ...(C.helpful as unknown as [string, string]))}</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * A question, visually its own kind (the brief: "visually distinct"): a
 * brand question mark in a soft tile, the question in display type, and a
 * clear answered state when an answer was accepted.
 */
export function CircleQuestionCard({ post, now }: { post: CirclePostView; now: number }) {
  return (
    <Link href={`/circle/p/${post.id}`} className="nf-ccard nf-ccard--question" data-testid="circle-post-card" data-kind="question">
      <span className="nf-ccard__q-head">
        <span className="nf-ccard__q-mark" aria-hidden="true">
          ?
        </span>
        <span className="nf-ccard__q-word">{C.question}</span>
        {post.answered ? (
          <span className="nf-ccard__answered">
            <UiIcon name="check" size={14} />
            {C.answered}
          </span>
        ) : null}
      </span>
      <h3 className="nf-ccard__title">{post.title}</h3>
      {post.body && post.body !== post.title ? <p className="nf-ccard__body">{post.body}</p> : null}
      <span className="nf-ccard__foot">
        <Byline post={post} now={now} />
        <span className="nf-ccard__answers nf-numeric">
          {countWords(post.answers, ...(C.answers as unknown as [string, string]))}
        </span>
      </span>
    </Link>
  );
}

/** The one card the Circle lists draw, by kind (a drop-in for the plain part). */
export function CirclePostCard({ post, now }: { post: CirclePostView; now: number }) {
  return post.type === "question" ? <CircleQuestionCard post={post} now={now} /> : <CircleDiscussionCard post={post} now={now} />;
}
