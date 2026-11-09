import Link from "next/link";

import { getDictionary } from "@vallo/i18n";

import { PageFrame } from "@/components/app/PageFrame";
import { PromoBanner } from "@/components/app/PromoBanner";
import { CircleShareButton } from "@/components/social/circle/CircleShare";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { withNext } from "@/lib/auth/next-link";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { countWords } from "@/lib/features/circle/model";
import type { CircleAuthor, Thread } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";

import { CircleEmpty } from "./CircleCards";
import { AcceptToggle, FollowToggle, HelpfulToggle, ReplyBox } from "./CircleActions";
import { CircleFace } from "./CircleFace";

/**
 * A CIRCLE THREAD, DRAWN (the page reads, this draws; the harness deck
 * passes sample props). The question or discussion first, in display type
 * with its person; then the answers, the accepted one first on its own
 * green edge, nested replies on a quiet rule. Every answer carries
 * `id="a-<id>"`, the anchor the notifications open.
 */
export function ThreadScreen({ thread, now, fallback }: { thread: Thread; now: number; fallback?: string }) {
  const { post } = thread;
  const question = post.type === "question";
  const T = CIRCLE_COPY.thread;
  const back = fallback ?? (post.community ? `/circle/c/${post.community.slug}` : "/circle");
  const share = getDictionary("en").shareCard;

  return (
    <PageFrame
      title={question ? CIRCLE_COPY.card.question : CIRCLE_COPY.tabs.discussions}
      fallback={back}
      width="default"
      actions={
        <CircleShareButton
          label={share.share}
          copy={{ title: share.title, share: share.share, background: share.background, stats: share.stats, name: share.name, copied: share.copied }}
          subject={{
            ...(post.author?.avatar ? { avatar: post.author.avatar } : { initial: post.author?.label ?? post.title }),
            ...(post.community ? { handle: post.community.name } : {}),
            headline: post.title,
            url: `/circle/p/${post.id}`,
          }}
        />
      }
    >
      <div className="nf-circle-thread" data-testid="circle-thread">
        <article className={`nf-cthread${question ? " nf-cthread--question" : ""}`}>
          <span className="nf-cthread__eyebrow">
            {question ? (
              <>
                <span className="nf-cthread__qmark" aria-hidden="true">
                  ?
                </span>
                <span className="nf-cthread__qword">{CIRCLE_COPY.card.question}</span>
              </>
            ) : null}
            {post.community ? (
              <Link href={`/circle/c/${post.community.slug}`} className="nf-cthread__community">
                <UiIcon name="circle-people" size={14} />
                {post.community.name}
              </Link>
            ) : null}
            {question && thread.acceptedId ? (
              <span className="nf-cthread__answered">
                <UiIcon name="check" size={14} />
                {CIRCLE_COPY.card.answered}
              </span>
            ) : null}
          </span>
          <h2 className="nf-cthread__title">{post.title}</h2>
          {post.body && post.body !== post.title ? <p className="nf-cthread__body">{post.body}</p> : null}
          {post.listingId ? (
            <Link href={`/listing/${post.listingId}`} className="nf-cthread__listing" data-testid="circle-thread-listing">
              <span className="nf-cthread__listing-glyph" aria-hidden="true">
                <UiIcon name="house" size={20} />
              </span>
              <span className="nf-cthread__listing-words">
                <span className="nf-cthread__listing-line">{T.listingLine}</span>
                <span className="nf-cthread__listing-cta">{T.viewListing}</span>
              </span>
              <UiIcon name="chevron-right" size={18} />
            </Link>
          ) : null}
          <span className="nf-cthread__foot">
            <Person author={post.author} at={post.createdAt} now={now} lead={question ? T.askedBy : T.startedBy} />
            {question && thread.signedIn && !thread.isAsker ? <FollowToggle questionId={post.id} initial={thread.following} /> : null}
          </span>
        </article>

        <section className="nf-circle-section" aria-labelledby="circle-answers">
          <div className="nf-circle-section__head">
            <h2 id="circle-answers" className="nf-circle-section__title">
              {question ? T.answers : T.replies}
            </h2>
            <span className="nf-circle-section__count nf-numeric">
              {countWords(thread.replies.length, ...((question ? CIRCLE_COPY.card.answers : CIRCLE_COPY.card.replies) as unknown as [string, string]))}
            </span>
          </div>
          {thread.replies.length === 0 ? (
            <CircleEmpty icon="chat-bubble">{CIRCLE_COPY.empty.replies}</CircleEmpty>
          ) : (
            <ul className="nf-circle-list">
              {thread.replies.map((r) => {
                const accepted = r.id === thread.acceptedId;
                const nested = r.depth > 1;
                return (
                  <li
                    key={r.id}
                    id={`a-${r.id}`}
                    className={`nf-creply${accepted ? " nf-creply--accepted" : ""}${nested ? " nf-creply--nested" : ""}`}
                    data-testid="circle-reply"
                  >
                    {accepted ? (
                      <span className="nf-creply__ribbon">
                        <UiIcon name="circle-check" size={16} />
                        {T.accepted}
                      </span>
                    ) : null}
                    <Person author={r.author} at={r.createdAt} now={now} />
                    <p className="nf-creply__body">{r.body}</p>
                    <span className="nf-circle-reply__actions">
                      <HelpfulToggle postId={r.id} rootId={post.id} count={r.helpful} initial={r.markedHelpful} disabled={!thread.signedIn || r.isMine} />
                      {question && thread.isAsker && r.depth === 1 && !r.isMine ? (
                        <AcceptToggle questionId={post.id} answerId={r.id} accepted={accepted} />
                      ) : null}
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
          <CircleEmpty
            icon="lock"
            action={
              post.community ? (
                <ButtonLink href={`/circle/c/${post.community.slug}`} variant="secondary" size="md">
                  {post.community.name}
                </ButtonLink>
              ) : undefined
            }
          >
            {T.locked}
          </CircleEmpty>
        ) : (
          /* VIEW-ONLY SIGNED OUT (founder, 9 November 2026). A visitor with no
             account reads the post and its answers but takes no action: the
             reply box is not drawn, the helpful toggle is inert, and this Join
             prompt is their one way on, to sign up carrying this page. */
          <PromoBanner
            eyebrow={share.joinPrompt.title}
            title={share.joinPrompt.title}
            body={share.joinPrompt.circle}
            href={withNext("/sign-up", `/circle/p/${post.id}`)}
            cta={share.joinPrompt.action}
            art="local-talks"
            testId="join-vallo-circle"
          />
        )}
      </div>
    </PageFrame>
  );
}

function Person({ author, at, now, lead }: { author: CircleAuthor | null; at: string; now: number; lead?: string }) {
  const name = author?.label ?? "Member";
  const inner = (
    <>
      <CircleFace author={author} />
      <span className="nf-cperson__who">
        <span className="nf-cperson__name">
          {lead ? <span className="nf-cperson__lead">{lead}</span> : null}
          <span className="nf-cperson__label">{name}</span>
          {author?.isAgent ? <span className="nf-cperson__role">{CIRCLE_COPY.home.roleAgent}</span> : null}
          {author?.verified ? (
            <span className="nf-cperson__tick" title={CIRCLE_COPY.pro.verified}>
              <UiIcon name="verified" size={14} filled />
              <span className="sr-only">{CIRCLE_COPY.pro.verified}</span>
            </span>
          ) : null}
        </span>
        <span className="nf-cperson__when">{agoShort(at, { now })}</span>
      </span>
    </>
  );
  return author?.handle ? (
    <Link href={`/u/${author.handle}`} className="nf-cperson">
      {inner}
    </Link>
  ) : (
    <span className="nf-cperson">{inner}</span>
  );
}
