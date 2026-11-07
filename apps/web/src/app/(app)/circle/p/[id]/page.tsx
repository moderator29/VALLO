import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { countWords } from "@/lib/features/circle/model";
import { readThread } from "@/lib/features/circle/queries";
import { agoShort, requestNow } from "@/lib/format/when";

import { CircleEmpty } from "../../_parts/CircleCards";
import { AcceptToggle, FollowToggle, HelpfulToggle, ReplyBox } from "../../_parts/CircleActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const thread = await readThread((await params).id);
  return { title: thread?.post.title || CIRCLE_COPY.title };
}

/**
 * A Circle post or question with its answers. The accepted answer first, then
 * the most helpful. Every answer carries `id="a-<id>"`, the anchor the
 * notifications open (`/circle/p/<id>#a-<answer>`).
 */
export default async function CircleThreadPage({ params }: Props) {
  const { id } = await params;
  const thread = await readThread(id);
  if (!thread) notFound();
  const { post } = thread;
  const now = requestNow();
  const question = post.type === "question";
  const T = CIRCLE_COPY.thread;

  return (
    <PageFrame title={question ? CIRCLE_COPY.card.question : CIRCLE_COPY.tabs.discussions} fallback={post.community ? `/circle/c/${post.community.slug}` : "/circle"} width="default">
      <div className="nf-circle-thread" data-testid="circle-thread">
        <article className="nf-circle-card">
          <span className={`nf-circle-card__eyebrow${question ? " nf-circle-card__eyebrow--question" : ""}`}>
            {question ? CIRCLE_COPY.card.question : null}
            {post.community ? <Link href={`/circle/c/${post.community.slug}`} className="nf-link">{post.community.name}</Link> : null}
            {question && thread.acceptedId ? <span className="nf-circle-card__answered">{CIRCLE_COPY.card.answered}</span> : null}
          </span>
          <h2 className="nf-circle-card__title nf-circle-card__title--full">{post.title}</h2>
          {post.body && post.body !== post.title ? <p className="nf-circle-reply__body">{post.body}</p> : null}
          {post.listingId ? (
            <Link href={`/listing/${post.listingId}`} className="nf-link" data-testid="circle-thread-listing">View the property</Link>
          ) : null}
          <span className="nf-circle-card__meta">
            <span>{post.author?.label ?? "Member"}</span>
            <span>{agoShort(post.createdAt, { now })}</span>
            <span>{countWords(post.answers, ...(question ? CIRCLE_COPY.card.answers : CIRCLE_COPY.card.replies) as [string, string])}</span>
          </span>
          {question && thread.signedIn && !thread.isAsker ? <span><FollowToggle questionId={post.id} initial={thread.following} /></span> : null}
        </article>

        <section className="nf-circle-section" aria-labelledby="circle-answers">
          <h2 id="circle-answers" className="nf-circle-section__title">{question ? T.answers : T.replies}</h2>
          {thread.replies.length === 0 ? <CircleEmpty>{CIRCLE_COPY.empty.replies}</CircleEmpty> : (
            <ul className="nf-circle-list">
              {thread.replies.map((r) => {
                const accepted = r.id === thread.acceptedId;
                return (
                  <li key={r.id} id={`a-${r.id}`} className={`nf-circle-reply${accepted ? " nf-circle-reply--accepted" : ""}${r.depth > 1 ? " nf-circle-reply--nested" : ""}`} data-testid="circle-reply">
                    <span className="nf-circle-card__eyebrow">
                      <span>{r.author?.label ?? "Member"}</span>
                      {r.author?.verified ? <span className="nf-circle-card__answered">{CIRCLE_COPY.pro.verified}</span> : null}
                      <span>{agoShort(r.createdAt, { now })}</span>
                      {accepted ? <span className="nf-circle-card__answered">{T.accepted}</span> : null}
                    </span>
                    <p className="nf-circle-reply__body">{r.body}</p>
                    <span className="nf-circle-reply__actions">
                      <HelpfulToggle postId={r.id} rootId={post.id} count={r.helpful} initial={r.markedHelpful} disabled={!thread.signedIn || r.isMine} />
                      {question && thread.isAsker && r.depth === 1 && !r.isMine ? <AcceptToggle questionId={post.id} answerId={r.id} accepted={accepted} /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {thread.canReply ? (
          <ReplyBox rootId={post.id} parentId={post.id} question={question} />
        ) : thread.signedIn ? (
          <CircleEmpty>{T.locked}</CircleEmpty>
        ) : (
          <CircleEmpty>{CIRCLE_COPY.signIn}</CircleEmpty>
        )}
      </div>
    </PageFrame>
  );
}
