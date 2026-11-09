/**
 * The wait, on the feed.
 *
 * `/around` is force-dynamic and resolves the session, the places somebody is
 * in and a page of posts before it can render a word. On a slow Nigerian
 * connection Next holds the previous screen for that whole time, so a tap on
 * Around looks like a tap that did nothing.
 *
 * A SKELETON IS THE SHAPE IT STANDS IN FOR (7 November 2026, the feed's own
 * shape). It is drawn inside the feed's real page classes (`nf-fv2-page`,
 * `nf-fv2-bar`, `nf-fv2-filter`, the card's `nf-pc`), so every gap, gutter
 * and corner is the one the posts land in: the masthead row, the rounded
 * square story tiles, the one-line way to post, the For you row with the
 * place, then two cards with a face, a quiet line, words, a picture on the
 * card's concentric corner, the glyph row and the comment line. Nothing jumps
 * when the posts arrive. Every slab is a soft rectangle or a circle, because
 * every control it stands in for is one.
 */
import { Skeleton } from "@/components/ui/Skeleton";
import { State } from "@/components/ui/State";
/* The feed's own sheet, so the bones sit in the real gutters and corners. */
import "@/components/social/feed/feed-v2.css";

function CardBones({ picture }: { picture: boolean }) {
  return (
    <div className="nf-post nf-pc">
      <div className="nf-pc__head">
        <Skeleton circle width="2.5rem" />
        <div className="min-w-0 flex-1 space-y-xs">
          <Skeleton width="9rem" height="0.875rem" radius="xs" />
          <Skeleton width="12rem" height="0.75rem" radius="xs" />
        </div>
      </div>
      <div className="nf-pc__caption space-y-xs">
        <Skeleton height="0.875rem" radius="xs" />
        <Skeleton width="72%" height="0.875rem" radius="xs" />
      </div>
      {picture ? (
        <div className="nf-pc__frame" style={{ aspectRatio: "5 / 4" }}>
          <Skeleton height="100%" radius="lg" />
        </div>
      ) : null}
      <div className="nf-pc__actions">
        <div className="flex items-center gap-lg py-sm">
          <Skeleton width="2.75rem" height="1.25rem" radius="xs" />
          <Skeleton width="2.5rem" height="1.25rem" radius="xs" />
          <Skeleton width="1.25rem" height="1.25rem" radius="xs" />
          <Skeleton width="1.25rem" height="1.25rem" radius="xs" className="ms-auto" />
        </div>
        <Skeleton height="2.75rem" radius="md" />
      </div>
    </div>
  );
}

export default function LoadingAround() {
  return (
    <State
      kind="loading"
      title="Loading your feed"
      /* Clear of the tab bar, as the real feed is. */
      className="nf-fv2-page pb-[var(--nf-tabbar-clearance)]"
    >
      <div aria-hidden="true">
        <div className="nf-fv2-bar">
          <Skeleton circle width="2.75rem" />
          <Skeleton width="5.5rem" height="1.5rem" radius="xs" />
          <Skeleton width="4rem" height="1.25rem" radius="xs" />
          <Skeleton circle width="2.75rem" className="ms-auto" />
        </div>

        <div className="my-sm flex gap-sm overflow-hidden py-2xs">
          {[0, 1, 2, 3, 4].map((tile) => (
            <div key={tile} className="flex flex-none flex-col items-center gap-xs">
              <Skeleton width="4rem" height="4rem" radius="xl" />
              <Skeleton width="2.75rem" height="0.625rem" radius="xs" />
            </div>
          ))}
        </div>

        <Skeleton height="3.25rem" radius="md" />

        <div className="nf-fv2-filter">
          <div className="flex items-center gap-lg py-sm">
            <Skeleton width="4rem" height="1rem" radius="xs" />
            <Skeleton width="4rem" height="1rem" radius="xs" />
          </div>
          <Skeleton width="8rem" height="2.125rem" radius="sm" className="ms-auto" />
        </div>

        <div className="flex flex-col gap-[var(--nf-feed-gap)]">
          <CardBones picture />
          <CardBones picture={false} />
        </div>
      </div>
    </State>
  );
}
