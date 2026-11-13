import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { CircleBanner, CircleComposeFab, CircleDestinations, CircleFeaturedCard, CirclePostCard, CircleSortRow, CircleTabs, type CircleFace } from "@/components/social/circle/CircleVisuals";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { ButtonLink } from "@/components/ui/Button";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { PromoBanner } from "@/components/app/PromoBanner";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CATEGORY_LABEL, CIRCLE_TABS, PROFESSIONAL_LABEL, TAB_TYPE, countWords, readSort, readTab, type CircleCategory, type CircleTab, type ProfessionalKind } from "@/lib/features/circle/model";
import { readCircleHome, readCirclePosts, readFollowingPosts, readMyInvites, readNeighbourhoods, readProfessionals } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";
import { getDictionary } from "@vallo/i18n";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { getLocale } from "@/lib/locale";

import { CircleEmpty, CommunityCard, StarterCommunities } from "./_parts/CircleCards";
import { InviteList } from "./_parts/InviteList";

export const metadata: Metadata = { title: CIRCLE_COPY.title, description: CIRCLE_COPY.tagline };
export const dynamic = "force-dynamic";

const C = CIRCLE_COPY;

/**
 * VALLO CIRCLE HOME (VALLO_CIRCLE.md v3 section 2): the banner with LIVE
 * counts, then the sections as tabs, each in the address (`?tab=`) so Back and
 * a shared link land on it. Every list is a real read; an empty one says so.
 */
export default async function CirclePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = readTab(params.tab);
  const sort = readSort(params.sort);
  const following = params.sort === "following";
  const cursor = typeof params.cursor === "string" ? params.cursor : null;
  const now = requestNow();
  const home = await readCircleHome();

  const tabs = CIRCLE_TABS.map((key) => ({ key, label: C.tabs[key], href: key === "for-you" ? "/circle" : `/circle?tab=${key}` }));

  return (
    <PageFrame
      title={C.title}
      subtitle={C.tagline}
      fallback="/home"
      width="wide"
      /* The door into the feed lives in the header (the founder: each has a
         button into the other), never inside the hero. */
      actions={
        <ButtonLink href="/around" variant="secondary" size="sm" leadingIcon="feed" data-testid="circle-feed-door">
          {C.home.feed}
        </ButtonLink>
      }
    >
      <PullToRefresh>
        <div className="nf-circle" data-testid="circle-home">
          <CircleBanner stats={home.stats} signedIn={home.signedIn} faces={facesOf(home)} hasCommunities={home.mine.length > 0} />
          {tab === "for-you" ? <CircleDestinations /> : null}
          <CircleTabs items={tabs} active={tab} />
          {!home.live ? <CircleEmpty>{C.empty.idle}</CircleEmpty> : await TabBody({ tab, sort, following, cursor, now, home })}
        </div>
      </PullToRefresh>
      <CircleComposeFab signedIn={home.signedIn} />
    </PageFrame>
  );
}

async function TabBody({
  tab,
  sort,
  following,
  cursor,
  now,
  home,
}: {
  tab: CircleTab;
  sort: ReturnType<typeof readSort>;
  following: boolean;
  cursor: string | null;
  now: number;
  home: Awaited<ReturnType<typeof readCircleHome>>;
}) {
  if (tab === "for-you") {
    /* The first run: no community exists yet, so the home is one clear
       invitation rather than three empty lists. */
    if (home.communities.length === 0 && home.mine.length === 0) {
      return (
        <Section title={C.starters.title}>
          <StarterCommunities signedIn={home.signedIn} />
        </Section>
      );
    }
    const { invites } = home.signedIn ? await readMyInvites() : { invites: [] };
    return (
      <div className="nf-circle nf-circle--split">
        <div className="nf-circle">
          {invites.length > 0 && <InviteList invites={invites} />}
          <PopularTopics communities={[...home.mine, ...home.communities]} />
          {/* A SHELF WITH NOTHING ON IT IS NOT DRAWN, and two empty shelves
              are one invitation, not two boxes (13 November 2026). With no
              discussion and no question yet, the page says so once and
              offers both ways to start; with one of the two, only the shelf
              that has something is drawn. */}
          {home.trending.length === 0 && home.questions.length === 0 ? (
            <CircleEmpty
              icon="chat-bubble"
              action={
                <span className="nf-circle-empty__actions">
                  <ButtonLink href={home.signedIn ? "/circle/new" : "/sign-up?next=%2Fcircle%2Fnew"} variant="primary" size="md" data-testid="circle-start">
                    {C.community.newPost}
                  </ButtonLink>
                  <ButtonLink href={home.signedIn ? "/circle/ask" : "/sign-up?next=%2Fcircle%2Fask"} variant="secondary" size="md" data-testid="circle-ask-first">
                    {C.home.dest.ask}
                  </ButtonLink>
                </span>
              }
            >
              {C.empty.posts}
            </CircleEmpty>
          ) : (
            <>
              {home.trending.length ? (
                <Section title={C.home.featured} more="/circle?tab=discussions">
                  <ul className="nf-circle-list" data-testid="circle-featured">
                    {home.trending.map((p) => (
                      <li key={p.id}>
                        <CircleFeaturedCard post={p} now={now} />
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
              {home.questions.length ? (
                <Section title={C.sections.questions} more="/circle?tab=ask">
                  <PostList posts={home.questions} now={now} />
                </Section>
              ) : null}
            </>
          )}
        </div>
        <div className="nf-circle">
          <RoommatesDoor />
          {home.mine.length ? (
            <Section title={C.sections.mine}>
              <ul className="nf-circle-list">{home.mine.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}</ul>
            </Section>
          ) : null}
          {home.communities.length ? (
            <Section title={C.sections.communities} id="circle-communities">
              <ul className="nf-circle-list">{home.communities.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}</ul>
            </Section>
          ) : null}
        </div>
      </div>
    );
  }

  if (tab === "neighbourhoods") {
    const areas = await readNeighbourhoods();
    if (!areas.length) return <CircleEmpty>{C.empty.neighbourhoods}</CircleEmpty>;
    return (
      <ul className="nf-circle-grid" data-testid="circle-neighbourhoods">
        {areas.map((a) => (
          <li key={a.id}>
            <Link href={`/around/${a.slug}`} className="nf-circle-card">
              <h3 className="nf-circle-card__title">{a.name}</h3>
              <span className="nf-circle-card__meta">
                <span>{countWords(a.members, ...C.card.members)}</span>
                <span>{countWords(a.posts, ...C.card.posts)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (tab === "professionals") {
    const pros = await readProfessionals();
    if (!pros.length) return <CircleEmpty>{C.empty.professionals}</CircleEmpty>;
    return (
      <ul className="nf-circle-grid" data-testid="circle-professionals">
        {pros.map((p) => (
          <li key={p.author.id}>
            <Link href={p.author.handle ? `/u/${p.author.handle}` : "/circle?tab=professionals"} className="nf-circle-card">
              <span className="nf-circle-card__eyebrow">
                {p.kinds.map((k) => <span key={k}>{PROFESSIONAL_LABEL[k as ProfessionalKind] ?? k}</span>)}
                {p.author.verified ? <span className="nf-circle-card__answered">{C.pro.verified}</span> : null}
              </span>
              <h3 className="nf-circle-card__title">{p.author.label}</h3>
              <p className="nf-circle-card__body">{p.headline}</p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const type = TAB_TYPE[tab] ?? null;
  /* Following: posts from the communities the reader joined, of this tab's kind. */
  const page = following
    ? await readFollowingPosts({ sort: "newest", cursor }).then((f) => ({ ...f, posts: type ? f.posts.filter((p) => p.type === type) : f.posts }))
    : await readCirclePosts({ type, sort, cursor });
  const base = `/circle?tab=${tab}`;
  const emptyWords = tab === "ask" ? C.empty.questions : tab === "guides" ? C.empty.guides : tab === "opportunities" ? C.empty.opportunities : C.empty.posts;
  return (
    <div className="nf-circle-section">
      <CircleSortRow active={following ? "following" : sort === "popular" ? "popular" : "newest"} base={base} following={home.signedIn} />
      {tab === "guides" ? (
        <ButtonLink href="/guides" variant="secondary" size="sm" arrow>
          {C.guides.open}
        </ButtonLink>
      ) : null}
      {page.posts.length ? <PostList posts={page.posts} now={now} /> : <CircleEmpty>{emptyWords}</CircleEmpty>}
      {page.next ? (
        <ButtonLink href={`${base}&sort=${following ? "following" : sort}&cursor=${encodeURIComponent(page.next)}`} variant="secondary" size="md">
          Older posts
        </ButtonLink>
      ) : null}
    </div>
  );
}

/** Up to three real members' faces, from the people writing on this page. Never invented. */
function facesOf(home: Awaited<ReturnType<typeof readCircleHome>>): CircleFace[] {
  const seen = new Set<string>();
  const out: CircleFace[] = [];
  for (const p of [...home.trending, ...home.questions]) {
    const a = p.author;
    if (!a?.avatar || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({ label: a.label, avatar: a.avatar });
    if (out.length === 3) break;
  }
  return out;
}

/**
 * THE DOOR TO VALLO ROOMMATES (8 November 2026). Circle is the community;
 * Roommates is where people match and share a home. One card, a link out,
 * and the three roommate communities Vallo started, by their real slugs.
 */
async function RoommatesDoor() {
  const E = getDictionary(await getLocale()).roommates.entryX;
  const rooms = [
    { slug: "student-accommodation", label: E.circleStudent },
    { slug: "nysc-accommodation", label: E.circleNysc },
    { slug: "finding-roommates", label: E.circleFinding },
  ];
  /* ONE DOOR TO ROOMMATES, DRAWN ONE WAY (13 November 2026). The feed's door
     is the platform's promo banner; this one was a plain card with a button
     and three bare links, so the same door looked like two products. It is
     the same banner now, and the three roommate communities under it are the
     platform's grouped list. Every link it had is still here. */
  return (
    <section className="nf-circle-door" data-testid="circle-roommates-door" aria-label={E.circleTitle}>
      <PromoBanner
        eyebrow={E.feedPromoEyebrow}
        title={E.circleTitle}
        body={E.circleLine}
        cta={E.circleOpen}
        href={ROOMMATES_ROUTES.home}
        art="home-small"
        testId="circle-roommates-promo"
      />
      <ListGroup label={E.circleCommunities} labelAs="h3">
        {rooms.map((r) => (
          <ListRow key={r.slug} href={`/circle/c/${r.slug}`} title={r.label} chevron />
        ))}
      </ListGroup>
    </section>
  );
}

function Section({ title, more, id, children }: { title: string; more?: string; id?: string; children: ReactNode }) {
  return (
    <section className="nf-circle-section" id={id}>
      <div className="nf-circle-section__head">
        <h2 className="nf-circle-section__title">{title}</h2>
        {more ? (
          /* The platform's one section action: the primary ink and a
             chevron, never an arrow and never the link blue (the founder,
             13 November 2026). */
          <Link href={more} className="nf-section-action nf-link-quiet nf-tap nf-body-sm nf-circle-section__more">
            See all
            <UiIcon name="chevron-right" size={16} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PostList({ posts, now }: { posts: Awaited<ReturnType<typeof readCirclePosts>>["posts"]; now: number }) {
  return (
    <ul className="nf-circle-list">
      {posts.map((p) => (
        <li key={p.id}>
          <CirclePostCard post={p} now={now} />
        </li>
      ))}
    </ul>
  );
}

/**
 * POPULAR TOPICS: the categories that real communities sit in, biggest first
 * by member count. Each chip goes to the largest community of that topic; a
 * topic with no community is not drawn.
 */
function PopularTopics({ communities }: { communities: { slug: string; category: CircleCategory; members: number }[] }) {
  const best = new Map<CircleCategory, { slug: string; members: number }>();
  const totals = new Map<CircleCategory, number>();
  for (const c of communities) {
    totals.set(c.category, (totals.get(c.category) ?? 0) + c.members);
    const cur = best.get(c.category);
    if (!cur || c.members > cur.members) best.set(c.category, { slug: c.slug, members: c.members });
  }
  const topics = [...best.entries()].sort((a, b) => (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0)).slice(0, 8);
  if (topics.length < 2) return null;
  return (
    <section className="nf-circle-section" data-testid="circle-topics" aria-label={C.home.topicsTitle}>
      <div className="nf-circle-section__head">
        <h2 className="nf-circle-section__title">{C.home.topicsTitle}</h2>
      </div>
      <ul className="nf-ctopics">
        {topics.map(([category, target]) => (
          <li key={category}>
            <Link href={`/circle/c/${target.slug}`} className="nf-ctopic" aria-label={`${CATEGORY_LABEL[category]}. ${C.home.topicsMore}`}>
              {CATEGORY_LABEL[category]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
