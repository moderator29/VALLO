import { plural } from "@vallo/i18n/core";
import { CountUp } from "@/components/motion/CountUp";
import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { compactCount, countWords } from "@/lib/features/circle/model";
import type { CirclePostView, HomeStats } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";
import { initial } from "@/lib/text/initial";
import { CircleHeroArt } from "./CircleHeroArt";
import { CircleComposeFab as ComposeFab, TabIntoView } from "./CircleClient";
import { RoommateCircleCard } from "./RoommateCircleCard";
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

export type CircleFace = { label: string; avatar: string | null };

/** A steady tone per name, so the same member always wears the same colour. */
function toneOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 5;
}

/** A member with no photograph: their initial on one of five Vallo tones, never a flat blue disc. */
export function CircleInitial({ name }: { name: string }) {
  return (
    <span className="nf-cinit" data-tone={toneOf(name)} aria-hidden="true">
      {initial(name || "M")}
    </span>
  );
}

/** A featured card's picture: an object chosen by what the post is about. */
function topicIcon(post: CirclePostView): Icon3DName {
  const text = `${post.title} ${post.community?.name ?? ""}`.toLowerCase();
  if (/(borehole|repair|plumb|leak|fix|generator|power|electric)/.test(text)) return "toolbox";
  if (/(flood|area|estate|street|neighbour|road|island|mainland)/.test(text)) return "map";
  if (/(caution|rent|fee|price|cost|pay|naira|budget|deposit|money)/.test(text)) return "coin";
  if (/(bedroom|flat|house|home|apartment|landlord|tenant|room)/.test(text)) return "home-small";
  return post.type === "question" ? "assistant" : "local-talks";
}

/**
 * THE HERO (rebuilt 8 November 2026, the founder's reference sheets in Vallo
 * blue): one big picture from the art slots with a scrim, the headline, the
 * line, ONE strong action, and the real members' faces with the LIVE member
 * count. The picture drifts once, slowly; the words arrive on a short
 * stagger; the count counts up once. Reduced motion shows the resting state.
 * Only members with a photograph are drawn in the stack: an initial floating
 * on a photograph read as broken, and a face is never invented.
 */
export function CircleBanner({
  stats,
  signedIn,
  faces = [],
  hasCommunities = false,
}: {
  /** From `circle_home_stats`. Null (the read is not live) draws no number. */
  stats: HomeStats | null;
  signedIn: boolean;
  faces?: readonly CircleFace[];
  /** Signed in and already in a community: the button asks a question instead of pointing at the list. */
  hasCommunities?: boolean;
}) {
  const H = CIRCLE_COPY.home;
  const S = CIRCLE_COPY.stats;
  /* Real counts only: a zero or an unreadable count is not drawn. */
  const figures = [
    { key: "posts", n: stats?.posts ?? 0, words: S.posts },
    { key: "active", n: stats?.active ?? 0, words: S.activeShort },
    { key: "communities", n: stats?.communities ?? 0, words: S.communities },
  ].filter((f) => Number.isFinite(f.n) && f.n > 0);
  const withPhoto = faces.filter((f) => f.avatar);
  /* Real photographs first; members without one wear their tinted initial. */
  const shown = (withPhoto.length ? withPhoto : faces).slice(0, 4);
  const members = stats?.members ?? 0;
  const more = Math.max(0, members - shown.length);
  return (
    <section className="nf-cbn" data-theme="dark" aria-labelledby="circle-banner-title" data-testid="circle-hero">
      <span className="nf-cbn__art" aria-hidden="true">
        <CircleHeroArt />
      </span>
      <span className="nf-cbn__scrim" aria-hidden="true" />
      <div className="nf-cbn__body">
        <h2 id="circle-banner-title" className="nf-cbn__title">
          {H.heroTitle}
        </h2>
        <p className="nf-cbn__line">{H.heroLine}</p>
        {stats && members > 0 ? (
          <p className="nf-cbn__people" data-testid="circle-stats">
            {shown.length ? (
              <span className="nf-cbn__faces" aria-hidden="true">
                {shown.map((face, index) => (
                  <span key={`${face.label}-${index}`} className="nf-cbn__face">
                    {face.avatar ? (
                      <RemoteImage src={face.avatar} alt="" width={72} height={72} sizes="36px" loading="lazy" />
                    ) : (
                      <CircleInitial name={face.label} />
                    )}
                  </span>
                ))}
                {more > 0 ? <span className="nf-cbn__more nf-numeric">{`+${compactCount(more)}`}</span> : null}
              </span>
            ) : null}
            <span className="nf-cbn__count">
              <span className="sr-only">{plural(members, H.members, "en")}</span>
              <span aria-hidden="true">
                <CountUp value={members} className="nf-numeric nf-cbn__count-n" /> {plural(members, H.members, "en").replace(/^[\d,.]+\s*/, "")}
              </span>
            </span>
          </p>
        ) : null}
        {figures.length > 0 ? (
          <ul className="nf-cbn__figures" data-testid="circle-figures" aria-label={H.glance}>
            {figures.map((f) => (
              <li key={f.key} className="nf-cbn__figure">
                <span className="nf-numeric nf-cbn__figure-n">{compactCount(f.n)}</span>
                <span className="nf-cbn__figure-w">{f.n === 1 ? f.words[0] : f.words[1]}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="nf-cbn__actions">
          <ButtonLink
            href={!signedIn ? "/sign-up?next=%2Fcircle" : hasCommunities ? "/circle/ask" : "#circle-communities"}
            variant="primary"
            size="lg"
            leadingIcon={signedIn && hasCommunities ? "chat-bubble" : "circle-people"}
            data-testid="circle-hero-cta"
          >
            {!signedIn ? H.join : hasCommunities ? H.joined : H.explore}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

const DESTINATIONS: { key: keyof typeof CIRCLE_COPY.home.dest; href: string; icon: Icon3DName }[] = [
  { key: "discussions", href: "/circle?tab=discussions", icon: "local-talks" },
  { key: "ask", href: "/circle/ask", icon: "assistant" },
  { key: "neighbourhoods", href: "/circle?tab=neighbourhoods", icon: "map" },
  { key: "insights", href: "/price", icon: "analytics" },
  { key: "professionals", href: "/circle?tab=professionals", icon: "team" },
  { key: "opportunities", href: "/circle?tab=opportunities", icon: "megaphone" },
  { key: "guides", href: "/circle?tab=guides", icon: "checklist" },
  { key: "roommates", href: "/roommates", icon: "home-small" },
];

/**
 * THE DESTINATIONS: a grid of coloured tiles, each with the founder's clay
 * object. Every tile opens a real place (Market insights is Price Check; there
 * is no Events tile because Circle has no events yet).
 */
export function CircleDestinations() {
  const H = CIRCLE_COPY.home;
  return (
    <nav className="nf-cdest" aria-label={H.exploreTitle} data-testid="circle-destinations">
      <h2 className="nf-cdest__title">{H.exploreTitle}</h2>
      <ul className="nf-cdest__grid">
        {DESTINATIONS.map((d, i) => (
          <li key={d.key} style={{ "--nf-cdest-i": i } as React.CSSProperties}>
            <Link href={d.href} className="nf-cdest__tile" data-tone={i % 4} data-testid={`circle-dest-${d.key}`}>
              <span className="nf-cdest__art">
                <Icon3D name={d.icon} size={44} />
              </span>
              <span className="nf-cdest__label">{H.dest[d.key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Popular, Latest and (signed in) Following, as one clean underline row in the address. */
export function CircleSortRow({ active, base, following = false }: { active: "popular" | "newest" | "following"; base: string; following?: boolean }) {
  const H = CIRCLE_COPY.home;
  const join = base.includes("?") ? "&" : "?";
  const items = [
    { key: "popular" as const, label: H.popular },
    { key: "newest" as const, label: H.latest },
    ...(following ? [{ key: "following" as const, label: H.following }] : []),
  ];
  return (
    <nav className="nf-csort" aria-label={H.sortsLabel}>
      {items.map((it) => (
        <Link key={it.key} href={`${base}${join}sort=${it.key}`} className="nf-csort__item" aria-current={it.key === active ? "page" : undefined} scroll={false}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * A FEATURED DISCUSSION: a picture tile (the community's object, or the
 * listing the post is about), the title, the line, and the true counts.
 */
export function CircleFeaturedCard({ post, now }: { post: CirclePostView; now: number }) {
  const H = CIRCLE_COPY.home;
  return (
    <Link href={`/circle/p/${post.id}`} className="nf-cfeat" data-testid="circle-featured-card">
      <span className="nf-cfeat__thumb" aria-hidden="true">
        <Icon3D name={topicIcon(post)} size={56} />
      </span>
      <span className="nf-cfeat__body">
        <span className="nf-cfeat__kicker">{post.community?.name ?? (post.type === "question" ? C.question : CIRCLE_COPY.tabs.discussions)}</span>
        <span className="nf-cfeat__title">{post.title}</span>
        <span className="nf-cfeat__foot">
          <span className="nf-cfeat__by">
            <span className="nf-ccard__face nf-cfeat__face" aria-hidden="true">
              {post.author?.avatar ? (
                <RemoteImage src={post.author.avatar} alt="" width={56} height={56} sizes="28px" loading="lazy" />
              ) : (
                <CircleInitial name={post.author?.label ?? "Member"} />
              )}
            </span>
            <span className="nf-cfeat__name">{post.author?.label ?? "Member"}</span>
          </span>
          <span className="nf-cfeat__counts nf-numeric">
            <span className="nf-ccard__count">
              <UiIcon name="chat-bubble" size={14} />
              {plural(post.answers, H.replies, "en")}
            </span>
            {post.helpful > 0 ? (
              <span className="nf-ccard__count">
                <UiIcon name="heart" size={14} />
                {plural(post.helpful, H.helpful, "en")}
              </span>
            ) : null}
            <span className="nf-cfeat__ago">{agoShort(post.createdAt, { now })}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

/** The floating compose button (client: it hides while the hero action shows). */
export function CircleComposeFab({ signedIn }: { signedIn: boolean }) {
  return <ComposeFab href={signedIn ? "/circle/ask?pick=1" : "/sign-in?next=%2Fcircle%2Fask%3Fpick%3D1"} label={CIRCLE_COPY.home.compose} />;
}

export type CircleTab = { key: string; label: string; href: string };

/** The section row: underline words, the live one in ink with the brand bar. */
export function CircleTabs({ items, active, searchHref }: { items: readonly CircleTab[]; active: string; searchHref?: string }) {
  return (
    <nav className="nf-ctabs" aria-label={CIRCLE_COPY.tabsLabel} data-testid="circle-tabs">
      <TabIntoView />
      <ul className="nf-ctabs__row">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="nf-ctabs__tab"
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
          <CircleInitial name={author?.label ?? "Member"} />
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
      {post.roommate ? <RoommateCircleCard card={post.roommate} link={false} /> : null}
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
