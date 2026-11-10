import Image from "next/image";

import { PageFrame } from "@/components/app/PageFrame";
import type { CSSProperties } from "react";

import "@/components/ui/art-stack.css";
import { FEATURE_ART } from "@/lib/features/art";
import { CirclePostCard } from "@/components/social/circle/CircleVisuals";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CATEGORY_LABEL, CIRCLE_SORTS, compactCount, countWords, type CircleSort } from "@/lib/features/circle/model";
import type { CommunityPage, PostPage } from "@/lib/features/circle/queries";

import { CircleEmpty } from "./CircleCards";
import { JoinControl } from "./CircleActions";
import { CommunityGlyph } from "./CircleFace";

/**
 * A COMMUNITY, DRAWN (the page reads, this draws; the harness deck passes
 * sample props to the same component). The head card says who it is for,
 * its LIVE counts and its rules; the posts follow, sorted three ways.
 */
export function CommunityScreen({
  page,
  posts,
  sort,
  now,
  fallback = "/circle",
}: {
  page: CommunityPage;
  posts: PostPage;
  sort: CircleSort;
  now: number;
  fallback?: string;
}) {
  const { community, membership } = page;
  const words = CIRCLE_COPY.community;
  const isMember = membership?.status === "active";
  const canRead = community.visibility === "public" || isMember;
  const joinState = membership?.role === "owner" ? "owner" : membership ? membership.status : "none";
  const isRunner = isMember && (membership?.role === "owner" || membership?.role === "moderator");
  const base = `/circle/c/${community.slug}`;
  const stats = [
    { key: "members", n: community.members, w: CIRCLE_COPY.card.members, say: CIRCLE_COPY.card.members },
    { key: "posts", n: community.posts, w: CIRCLE_COPY.card.posts, say: CIRCLE_COPY.card.posts },
    { key: "active", n: page.active, w: CIRCLE_COPY.stats.activeShort, say: CIRCLE_COPY.stats.active },
  ] as const;

  return (
    <PageFrame
      title={community.name}
      subtitle={CATEGORY_LABEL[community.category]}
      fallback={fallback}
      width="default"
    >
      <div className="nf-circle" data-testid="circle-community">
        {/* THE COVER (8 November 2026): the community's art under a scrim,
            its object, its name, the live member count and Join or Joined,
            in the new Circle hero's register. */}
        <section className="nf-ccover" data-art-stack="" style={{ "--nf-art-ratio": Math.max(FEATURE_ART.circlePromo.ratio, 1.4) } as CSSProperties} data-theme="dark" aria-label={community.name} data-testid="community-cover">
          <span className="nf-ccover__art" data-art-stack-art="" aria-hidden="true">
            <Image src={FEATURE_ART.circlePromo.src} alt="" fill sizes="(max-width: 768px) 100vw, 720px" style={{ objectFit: "contain", objectPosition: "var(--nf-art-pos, 50% 100%)" }} />
          </span>
          <span className="nf-ccover__scrim" data-art-stack-scrim="" aria-hidden="true" />
          <div className="nf-ccover__body" data-art-stack-body="">
            <CommunityGlyph category={community.category} size="lg" />
            <h2 className="nf-ccover__name">{community.name}</h2>
            <p className="nf-ccover__meta nf-numeric">
              {[CATEGORY_LABEL[community.category], countWords(community.members, CIRCLE_COPY.card.members[0], CIRCLE_COPY.card.members[1])].join(" · ")}
            </p>
            <div className="nf-ccover__join">
              <JoinControl
                communityId={community.id}
                slug={community.slug}
                name={community.name}
                visibility={community.visibility}
                initial={joinState}
                signedIn={page.signedIn}
              />
            </div>
          </div>
        </section>
        <section className="nf-ccom" aria-label={community.name}>
          <div className="nf-ccom__top">
            <CommunityGlyph category={community.category} size="lg" />
            <span className="nf-ccom__chips">
              <span className="nf-circle-chip">
                <UiIcon name={community.visibility === "private" ? "lock" : "globe"} size={12} />
                {community.visibility === "private" ? words.privateWord : words.publicWord}
              </span>
              {community.byVallo ? <span className="nf-circle-chip nf-circle-chip--brand">{CIRCLE_COPY.card.byVallo}</span> : null}
              {isMember ? (
                <span className="nf-circle-chip nf-circle-chip--ok">
                  <UiIcon name="check" size={12} />
                  {membership?.role === "owner" ? words.youRun : membership?.role === "moderator" ? words.youModerate : words.joined}
                </span>
              ) : null}
            </span>
          </div>
          {community.description ? <p className="nf-ccom__about">{community.description}</p> : null}
          <dl className="nf-ccom__stats" data-testid="community-counts">
            {stats.map((s) => (
              <div key={s.key} className="nf-ccom__stat" aria-label={countWords(s.n, s.say[0], s.say[1])}>
                <dd className="nf-ccom__stat-n nf-numeric" aria-hidden="true">
                  {compactCount(s.n)}
                </dd>
                <dt className="nf-ccom__stat-w" aria-hidden="true">
                  {s.w[1]}
                </dt>
              </div>
            ))}
          </dl>
          {community.rules.length ? (
            <details className="nf-ccom__rules">
              <summary>
                <UiIcon name="shield-check" size={16} />
                <span>{words.rules}</span>
                <span className="nf-ccom__rules-n nf-numeric">{community.rules.length}</span>
                <UiIcon name="chevron-down" size={16} />
              </summary>
              <ol className="nf-circle-rules">
                {community.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </details>
          ) : null}
          {isMember ? (
            <span className="nf-ccom__actions">
              <ButtonLink href={`/circle/ask?community=${community.id}`} variant="primary" size="md" leadingIcon="chat-bubble">
                {CIRCLE_COPY.ask}
              </ButtonLink>
              <ButtonLink href={`${base}/new`} variant="secondary" size="md" leadingIcon="pencil">
                {words.newPost}
              </ButtonLink>
              {isRunner && community.visibility === "private" ? (
                <ButtonLink href={`${base}/manage`} variant="quiet" size="md" leadingIcon="users">
                  {words.manage}
                </ButtonLink>
              ) : null}
            </span>
          ) : null}
        </section>

        {!canRead ? (
          <CircleEmpty icon="lock">{words.privateDoor}</CircleEmpty>
        ) : (
          <div className="nf-circle-section">
            <div className="nf-circle-section__head">
              <h2 className="nf-circle-section__title">{words.postsTitle}</h2>
            </div>
            <nav className="nf-circle-sort" aria-label={CIRCLE_COPY.sortLabel}>
              {CIRCLE_SORTS.map((s) => (
                <ButtonLink
                  key={s}
                  href={`${base}?sort=${s}`}
                  size="sm"
                  variant={s === sort ? "primary" : "quiet"}
                  aria-current={s === sort ? "page" : undefined}
                >
                  {CIRCLE_COPY.sorts[s]}
                </ButtonLink>
              ))}
            </nav>
            {posts.posts.length ? (
              <ul className="nf-circle-list">
                {posts.posts.map((p) => (
                  <li key={p.id}>
                    <CirclePostCard post={p} now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <CircleEmpty icon="chat-bubble">{sort === "unanswered" ? CIRCLE_COPY.empty.unanswered : CIRCLE_COPY.empty.posts}</CircleEmpty>
            )}
            {posts.next ? (
              <ButtonLink href={`${base}?sort=${sort}&cursor=${encodeURIComponent(posts.next)}`} variant="secondary" size="md">
                {CIRCLE_COPY.older}
              </ButtonLink>
            ) : null}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
