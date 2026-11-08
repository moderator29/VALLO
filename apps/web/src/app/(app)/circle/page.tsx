import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { CircleBanner, CirclePostCard, CircleTabs, type CircleFace } from "@/components/social/circle/CircleVisuals";
import { ButtonLink } from "@/components/ui/Button";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CIRCLE_SORTS, CIRCLE_TABS, PROFESSIONAL_LABEL, TAB_TYPE, countWords, readSort, readTab, type CircleTab, type ProfessionalKind } from "@/lib/features/circle/model";
import { readCircleHome, readCirclePosts, readMyInvites, readNeighbourhoods, readProfessionals } from "@/lib/features/circle/queries";
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
    >
      <div className="nf-circle" data-testid="circle-home">
        <CircleBanner stats={home.stats} signedIn={home.signedIn} faces={facesOf(home)} feedHref="/around" feedLabel={C.toFeed} />
        <CircleTabs items={tabs} active={tab} />
        {!home.live ? <CircleEmpty>{C.empty.idle}</CircleEmpty> : await TabBody({ tab, sort, cursor, now, home })}
      </div>
    </PageFrame>
  );
}

async function TabBody({
  tab,
  sort,
  cursor,
  now,
  home,
}: {
  tab: CircleTab;
  sort: ReturnType<typeof readSort>;
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
          <Section title={C.sections.trending} more="/circle?tab=discussions">
            {home.trending.length ? <PostList posts={home.trending} now={now} /> : <CircleEmpty>{C.empty.posts}</CircleEmpty>}
          </Section>
          <Section title={C.sections.questions} more="/circle?tab=ask">
            {home.questions.length ? <PostList posts={home.questions} now={now} /> : <CircleEmpty>{C.empty.questions}</CircleEmpty>}
          </Section>
        </div>
        <div className="nf-circle">
          <RoommatesDoor />
          {home.mine.length ? (
            <Section title={C.sections.mine}>
              <ul className="nf-circle-list">{home.mine.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}</ul>
            </Section>
          ) : null}
          {home.communities.length ? (
            <Section title={C.sections.communities}>
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
  const page = await readCirclePosts({ type, sort, cursor });
  const base = `/circle?tab=${tab}`;
  const emptyWords = tab === "ask" ? C.empty.questions : tab === "guides" ? C.empty.guides : tab === "opportunities" ? C.empty.opportunities : C.empty.posts;
  return (
    <div className="nf-circle-section">
      <nav className="nf-circle-sort" aria-label={C.sortLabel}>
        {CIRCLE_SORTS.map((s) => (
          <ButtonLink key={s} href={`${base}&sort=${s}`} size="sm" variant={s === sort ? "primary" : "quiet"} aria-current={s === sort ? "page" : undefined}>
            {C.sorts[s]}
          </ButtonLink>
        ))}
      </nav>
      {tab === "guides" ? (
        <ButtonLink href="/guides" variant="secondary" size="sm" arrow>
          {C.guides.open}
        </ButtonLink>
      ) : null}
      {page.posts.length ? <PostList posts={page.posts} now={now} /> : <CircleEmpty>{emptyWords}</CircleEmpty>}
      {page.next ? (
        <ButtonLink href={`${base}&sort=${sort}&cursor=${encodeURIComponent(page.next)}`} variant="secondary" size="md">
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
  return (
    <section className="nf-circle-card" data-testid="circle-roommates-door" aria-labelledby="circle-roommates-title">
      <h2 id="circle-roommates-title" className="nf-circle-card__title">
        {E.circleTitle}
      </h2>
      <p className="nf-circle-card__body">{E.circleLine}</p>
      <ButtonLink href={ROOMMATES_ROUTES.home} variant="primary" size="sm" arrow>
        {E.circleOpen}
      </ButtonLink>
      <span className="nf-circle-card__eyebrow">{E.circleCommunities}</span>
      <ul className="nf-circle-list">
        {rooms.map((r) => (
          <li key={r.slug}>
            <Link href={`/circle/c/${r.slug}`} className="nf-link">
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Section({ title, more, children }: { title: string; more?: string; children: ReactNode }) {
  return (
    <section className="nf-circle-section">
      <div className="nf-circle-section__head">
        <h2 className="nf-circle-section__title">{title}</h2>
        {more ? (
          <Link href={more} className="nf-link">
            See all
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
