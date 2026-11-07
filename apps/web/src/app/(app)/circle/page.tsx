import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CIRCLE_SORTS, CIRCLE_TABS, PROFESSIONAL_LABEL, TAB_TYPE, countWords, readSort, readTab, type CircleTab, type ProfessionalKind } from "@/lib/features/circle/model";
import { readCircleHome, readCirclePosts, readNeighbourhoods, readProfessionals } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";

import { CircleEmpty, CirclePostCard, CommunityCard } from "./_parts/CircleCards";
import { CircleHero } from "./_parts/CircleHero";

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
      actions={
        <ButtonLink href="/around" variant="secondary" size="sm" leadingIcon="feed" data-testid="circle-to-feed">
          {C.toFeed}
        </ButtonLink>
      }
    >
      <div className="nf-circle" data-testid="circle-home">
        <CircleHero stats={home.stats} signedIn={home.signedIn} />
        <UnderlineTabs items={tabs} active={tab} label={C.tabsLabel} itemTestIdPrefix="circle-tab-" />
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
    return (
      <div className="nf-circle nf-circle--split">
        <div className="nf-circle">
          <Section title={C.sections.trending} more="/circle?tab=discussions">
            {home.trending.length ? <PostList posts={home.trending} now={now} /> : <CircleEmpty>{C.empty.posts}</CircleEmpty>}
          </Section>
          <Section title={C.sections.questions} more="/circle?tab=ask">
            {home.questions.length ? <PostList posts={home.questions} now={now} /> : <CircleEmpty>{C.empty.questions}</CircleEmpty>}
          </Section>
        </div>
        <div className="nf-circle">
          {home.mine.length ? (
            <Section title={C.sections.mine}>
              <ul className="nf-circle-list">{home.mine.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}</ul>
            </Section>
          ) : null}
          <Section title={C.sections.communities}>
            {home.communities.length ? (
              <ul className="nf-circle-list">{home.communities.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}</ul>
            ) : (
              <CircleEmpty>{C.empty.communities}</CircleEmpty>
            )}
          </Section>
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
