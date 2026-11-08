import { PageFrame } from "@/components/app/PageFrame";
import { CircleBanner, CircleComposeFab, CircleDestinations, CircleFeaturedCard, CirclePostCard, CircleTabs } from "@/components/social/circle/CircleVisuals";
import { ButtonLink } from "@/components/ui/Button";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { CIRCLE_TABS } from "@/lib/features/circle/model";
import type { CirclePostView, CommunityView } from "@/lib/features/circle/queries";

import "@/app/(app)/circle/circle.css";
import { CommunityCard, StarterCommunities } from "@/app/(app)/circle/_parts/CircleCards";

/** /circle with sample rows (`?first=1`: the first run with no communities). Fictional people only. */
export const dynamic = "force-dynamic";

const NOW = Date.parse("2026-11-07T18:00:00Z");
const community = (id: string, name: string, category: CommunityView["category"], members: number, posts: number, extra: Partial<CommunityView> = {}): CommunityView => ({
  id, slug: name.toLowerCase().replace(/ /g, "-"), name, description: "Rents, caution fees and landlords, from people who live here.", category, visibility: "public", rules: [], byVallo: false, members, posts, areaId: null, lastActivityAt: null, ...extra,
});
const post = (id: string, title: string, type: CirclePostView["type"], answers: number, helpful: number, hoursAgo: number, answered = false): CirclePostView => ({
  id, title, body: "We were asked for a year of caution on top of the rent. Is that normal around here, and can it be negotiated?", type, createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(), editedAt: null, answers, likes: 4, helpful,
  author: { id: "a", handle: "kemi", label: "Kemi A.", avatar: null, isAgent: false, verified: false }, community: { slug: "lekki-renters", name: "Lekki renters" }, listingId: null, answered,
});

export default async function PreviewCircle({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const first = (await searchParams).first === "1";
  const tabs = CIRCLE_TABS.map((key) => ({ key, label: CIRCLE_COPY.tabs[key], href: "#" }));
  return (
    /* The app shell's 16px gutter, which the harness layout does not draw. */
    <div className="px-md">
    <PageFrame title={CIRCLE_COPY.title} subtitle={CIRCLE_COPY.tagline} fallback="/preview/features" width="wide" actions={<ButtonLink href="#" variant="secondary" size="sm" leadingIcon="feed">{CIRCLE_COPY.home.feed}</ButtonLink>}>
      <div className="nf-circle">
        <CircleBanner faces={[]} stats={first ? { members: 0, posts: 0, active: 0, communities: 0 } : { members: 1204, posts: 386, active: 97, communities: 14 }} signedIn />
        <CircleDestinations />
        <CircleTabs items={tabs} active="for-you" />
        {first ? (
          <section className="nf-circle-section">
            <h2 className="nf-circle-section__title">{CIRCLE_COPY.starters.title}</h2>
            <StarterCommunities signedIn />
          </section>
        ) : (
          <div className="nf-circle nf-circle--split">
            <div className="nf-circle">
              <section className="nf-circle-section">
                <h2 className="nf-circle-section__title">{CIRCLE_COPY.home.featured}</h2>
                <ul className="nf-circle-list">
                  <li><CircleFeaturedCard post={post("1", "Landlords: how do you handle a tenant who pays late every month?", "discussion", 12, 8, 3)} now={NOW} /></li>
                  <li><CircleFeaturedCard post={post("2", "Is a borehole worth it in Ajah, or is the estate water enough?", "discussion", 5, 2, 20)} now={NOW} /></li>
                </ul>
              </section>
              <section className="nf-circle-section">
                <h2 className="nf-circle-section__title">{CIRCLE_COPY.sections.questions}</h2>
                <ul className="nf-circle-list">
                  <li><CirclePostCard post={post("3", "How much is caution fee for a 2 bedroom in Yaba?", "question", 9, 14, 6, true)} now={NOW} /></li>
                  <li><CirclePostCard post={post("4", "Which areas in Abuja flood least in the rainy season?", "question", 0, 0, 1)} now={NOW} /></li>
                </ul>
              </section>
            </div>
            <section className="nf-circle-section">
              <h2 className="nf-circle-section__title">{CIRCLE_COPY.sections.communities}</h2>
              <ul className="nf-circle-list">
                <li><CommunityCard community={community("c1", "Lekki renters", "renting", 412, 96)} /></li>
                <li><CommunityCard community={community("c2", "Abuja landlords", "landlords", 188, 40, { visibility: "private" })} /></li>
                <li><CommunityCard community={community("c3", "Short let hosts", "short_lets", 97, 22)} /></li>
              </ul>
            </section>
          </div>
        )}
      </div>
      <CircleComposeFab signedIn />
    </PageFrame>
    </div>
  );
}
