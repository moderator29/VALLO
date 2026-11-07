import { ButtonLink } from "@/components/ui/Button";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { compactCount, countWords } from "@/lib/features/circle/model";
import type { HomeStats } from "@/lib/features/circle/queries";

/**
 * The Circle banner with its LIVE counts (from `circle_home_stats`, never a
 * sample). With no counts (the SQL not live) the numbers are not drawn at
 * all, rather than drawn as zero. Agent FE's banner (the house, the faces,
 * the motion) takes this one's place and keeps these props.
 */
export function CircleHero({ stats, signedIn }: { stats: HomeStats | null; signedIn: boolean }) {
  const s = CIRCLE_COPY.stats;
  const items = stats
    ? [
        { key: "members", n: stats.members, words: s.members },
        { key: "posts", n: stats.posts, words: s.posts },
        { key: "active", n: stats.active, words: s.active },
      ]
    : [];
  return (
    <section className="nf-circle-hero" aria-labelledby="circle-hero-title" data-testid="circle-hero">
      <h2 id="circle-hero-title" className="nf-circle-hero__title">
        {CIRCLE_COPY.title}
      </h2>
      <p className="nf-circle-hero__line">{CIRCLE_COPY.heroLine}</p>
      {items.length > 0 ? (
        <dl className="nf-circle-hero__stats" data-testid="circle-stats">
          {items.map((item) => (
            <div key={item.key} className="nf-circle-hero__stat" aria-label={countWords(item.n, item.words[0], item.words[1])}>
              <dd aria-hidden="true">{compactCount(item.n)}</dd>
              <dt aria-hidden="true">{item.words[1]}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="nf-circle-hero__actions">
        <ButtonLink href={signedIn ? "/circle/ask" : "/sign-in?next=/circle/ask"} variant="primary" size="md" leadingIcon="chat-bubble">
          {CIRCLE_COPY.ask}
        </ButtonLink>
        <ButtonLink href={signedIn ? "/circle/new" : "/sign-in?next=/circle/new"} variant="glass" size="md">
          {CIRCLE_COPY.start}
        </ButtonLink>
      </div>
    </section>
  );
}
