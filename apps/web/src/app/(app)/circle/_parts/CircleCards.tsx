import Link from "next/link";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CATEGORY_LABEL, countWords } from "@/lib/features/circle/model";
import type { CirclePostView, CommunityView } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";

/**
 * The Circle's plain cards: title first, a topic line, quiet counts. Agent FE
 * builds the shared, polished versions; these keep the same data and links.
 */
const C = CIRCLE_COPY.card;

export function CirclePostCard({ post, now }: { post: CirclePostView; now: number }) {
  const isQuestion = post.type === "question";
  return (
    <Link href={`/circle/p/${post.id}`} className="nf-circle-card" data-testid="circle-post-card">
      <span className={`nf-circle-card__eyebrow${isQuestion ? " nf-circle-card__eyebrow--question" : ""}`}>
        {isQuestion ? C.question : null}
        {post.community ? <span>{post.community.name}</span> : null}
        {isQuestion && post.answered ? <span className="nf-circle-card__answered">{C.answered}</span> : null}
      </span>
      <h3 className="nf-circle-card__title">{post.title}</h3>
      {post.body && post.body !== post.title ? <p className="nf-circle-card__body">{post.body}</p> : null}
      <span className="nf-circle-card__meta">
        <span>{post.author?.label ?? "Member"}</span>
        <span>{agoShort(post.createdAt, { now })}</span>
        <span>{countWords(post.answers, ...(isQuestion ? C.answers : C.replies) as [string, string])}</span>
        {post.helpful > 0 ? <span>{countWords(post.helpful, ...C.helpful)}</span> : null}
      </span>
    </Link>
  );
}

export function CommunityCard({ community }: { community: CommunityView }) {
  return (
    <Link href={`/circle/c/${community.slug}`} className="nf-circle-card" data-testid="circle-community-card">
      <span className="nf-circle-card__eyebrow">
        <span>{CATEGORY_LABEL[community.category]}</span>
        {community.visibility === "private" ? <span>{C.private}</span> : null}
        {community.byVallo ? <span>{C.byVallo}</span> : null}
      </span>
      <h3 className="nf-circle-card__title">{community.name}</h3>
      {community.description ? <p className="nf-circle-card__body">{community.description}</p> : null}
      <span className="nf-circle-card__meta">
        <span>{countWords(community.members, ...C.members)}</span>
        <span>{countWords(community.posts, ...C.posts)}</span>
      </span>
    </Link>
  );
}

export function CircleEmpty({ children }: { children: string }) {
  return (
    <p className="nf-circle-empty" data-testid="circle-empty">
      {children}
    </p>
  );
}
