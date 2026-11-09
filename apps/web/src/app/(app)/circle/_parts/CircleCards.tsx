import Link from "next/link";
import type { ReactNode } from "react";

import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CATEGORY_LABEL, STARTER_COMMUNITIES, countWords } from "@/lib/features/circle/model";
import type { CommunityView } from "@/lib/features/circle/queries";

import { CommunityGlyph } from "./CircleFace";

/**
 * The Circle's plain cards: title first, a topic line, quiet counts. Agent FE
 * builds the shared, polished versions; these keep the same data and links.
 */
const C = CIRCLE_COPY.card;

export function CommunityCard({ community }: { community: CommunityView }) {
  return (
    <Link href={`/circle/c/${community.slug}`} className="nf-circle-card nf-circle-card--community" data-testid="circle-community-card">
      <CommunityGlyph category={community.category} />
      <span className="nf-circle-card__main">
        <span className="nf-circle-card__eyebrow">
          <span>{CATEGORY_LABEL[community.category]}</span>
          {community.visibility === "private" ? (
            <span className="nf-circle-chip">
              <UiIcon name="lock" size={12} />
              {C.private}
            </span>
          ) : null}
          {community.byVallo ? <span className="nf-circle-chip nf-circle-chip--brand">{C.byVallo}</span> : null}
        </span>
        <h3 className="nf-circle-card__title">{community.name}</h3>
        {community.description ? <p className="nf-circle-card__body">{community.description}</p> : null}
        <span className="nf-circle-card__meta">
          <span>{countWords(community.members, ...C.members)}</span>
          <span aria-hidden="true">·</span>
          <span>{countWords(community.posts, ...C.posts)}</span>
        </span>
      </span>
    </Link>
  );
}

/** An empty list, in words, with a quiet glyph and, where it helps, the one next step. */
export function CircleEmpty({ children, icon, action }: { children: string; icon?: UiIconName; action?: ReactNode }) {
  return (
    <div className="nf-circle-empty" data-testid="circle-empty">
      {icon ? (
        <span className="nf-circle-empty__glyph" aria-hidden="true">
          <UiIcon name={icon} size={22} />
        </span>
      ) : null}
      <p className="nf-circle-empty__words">{children}</p>
      {action ? <div className="nf-circle-empty__action">{action}</div> : null}
    </div>
  );
}

/**
 * The empty Circle's first run: suggested communities as real actions. Each
 * opens Create a community prefilled; nothing exists until someone creates it.
 */
export function StarterCommunities({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="nf-circle-section" data-testid="circle-starters">
      <p className="nf-circle-card__body">{CIRCLE_COPY.starters.lede}</p>
      <ul className="nf-circle-grid">
        {STARTER_COMMUNITIES.map((s) => {
          const target = `/circle/new?name=${encodeURIComponent(s.name)}&category=${s.category}`;
          return (
            <li key={s.name}>
              <Link href={signedIn ? target : `/sign-in?next=${encodeURIComponent(target)}`} className="nf-circle-card nf-circle-card--starter">
                <span className="nf-circle-card__eyebrow">
                  <span>{CATEGORY_LABEL[s.category]}</span>
                </span>
                <h3 className="nf-circle-card__title">{s.name}</h3>
                <p className="nf-circle-card__body">{s.line}</p>
                <span className="nf-circle-card__cta">{CIRCLE_COPY.starters.cta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
