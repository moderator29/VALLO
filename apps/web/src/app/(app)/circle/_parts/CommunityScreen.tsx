import { PageFrame } from "@/components/app/PageFrame";
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
      actions={
        <JoinControl
          communityId={community.id}
          slug={community.slug}
          name={community.name}
          visibility={community.visibility}
          initial={joinState}
          signedIn={page.signedIn}
        />
      }
    >
      <div className="nf-circle" data-testid="circle-community">
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
