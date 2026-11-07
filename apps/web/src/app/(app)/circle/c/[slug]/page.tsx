import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CATEGORY_LABEL, CIRCLE_SORTS, countWords, readSort } from "@/lib/features/circle/model";
import { readCirclePosts, readCommunity } from "@/lib/features/circle/queries";
import { requestNow } from "@/lib/format/when";

import { CirclePostCard } from "@/components/social/circle/CircleVisuals";

import { CircleEmpty } from "../../_parts/CircleCards";
import { JoinControl } from "../../_parts/CircleActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await readCommunity((await params).slug);
  return { title: page ? page.community.name : CIRCLE_COPY.title };
}

/** A community: who it is for, the live counts, join or ask, its posts sorted three ways. */
export default async function CommunityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const page = await readCommunity(slug);
  if (!page) notFound();
  const { community, membership } = page;
  const sort = readSort(query.sort);
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  const isMember = membership?.status === "active";
  const canRead = community.visibility === "public" || isMember;
  const posts = canRead ? await readCirclePosts({ communityId: community.id, sort, cursor }) : { live: true, posts: [], next: null };
  const now = requestNow();
  const words = CIRCLE_COPY.community;
  const joinState = membership?.role === "owner" ? "owner" : membership ? membership.status : "none";
  const isRunner = membership?.status === "active" && (membership.role === "owner" || membership.role === "moderator");
  const base = `/circle/c/${community.slug}`;

  return (
    <PageFrame title={community.name} subtitle={CATEGORY_LABEL[community.category]} fallback="/circle" width="default"
      actions={<JoinControl communityId={community.id} slug={community.slug} name={community.name} visibility={community.visibility} initial={joinState} signedIn={page.signedIn} />}>
      <div className="nf-circle" data-testid="circle-community">
        <section className="nf-circle-card" aria-label={community.name}>
          {community.description ? <p className="nf-circle-reply__body">{community.description}</p> : null}
          <span className="nf-circle-card__meta" data-testid="community-counts">
            <span>{countWords(community.members, ...CIRCLE_COPY.card.members)}</span>
            <span>{countWords(community.posts, ...CIRCLE_COPY.card.posts)}</span>
            <span>{countWords(page.active, CIRCLE_COPY.stats.active[0], CIRCLE_COPY.stats.active[1])}</span>
            {community.byVallo ? <span>{CIRCLE_COPY.card.byVallo}</span> : null}
          </span>
          {community.rules.length ? (
            <details>
              <summary className="nf-circle-card__eyebrow">{words.rules}</summary>
              <ol className="nf-circle-rules">{community.rules.map((r) => <li key={r}>{r}</li>)}</ol>
            </details>
          ) : null}
          {isMember ? (
            <span className="nf-circle-reply__actions">
              <ButtonLink href={`/circle/ask?community=${community.id}`} variant="primary" size="md">{CIRCLE_COPY.ask}</ButtonLink>
              <ButtonLink href={`${base}/new`} variant="secondary" size="md">{words.newPost}</ButtonLink>
              {isRunner && community.visibility === "private" ? <ButtonLink href={`${base}/manage`} variant="quiet" size="md">{words.manage}</ButtonLink> : null}
            </span>
          ) : null}
        </section>

        {!canRead ? (
          <CircleEmpty>{words.privateDoor}</CircleEmpty>
        ) : (
          <div className="nf-circle-section">
            <nav className="nf-circle-sort" aria-label={CIRCLE_COPY.sortLabel}>
              {CIRCLE_SORTS.map((s) => (
                <ButtonLink key={s} href={`${base}?sort=${s}`} size="sm" variant={s === sort ? "primary" : "quiet"} aria-current={s === sort ? "page" : undefined}>
                  {CIRCLE_COPY.sorts[s]}
                </ButtonLink>
              ))}
            </nav>
            {posts.posts.length ? (
              <ul className="nf-circle-list">{posts.posts.map((p) => <li key={p.id}><CirclePostCard post={p} now={now} /></li>)}</ul>
            ) : (
              <CircleEmpty>{CIRCLE_COPY.empty.posts}</CircleEmpty>
            )}
            {posts.next ? <ButtonLink href={`${base}?sort=${sort}&cursor=${encodeURIComponent(posts.next)}`} variant="secondary" size="md">Older posts</ButtonLink> : null}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
