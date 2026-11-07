import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/site/BackButton";
import { CreateBloom } from "@/components/social/bloom/CreateBloom";
import { ComposeButton } from "@/components/social/feed/ComposeButton";
import { Feed } from "@/components/social/feed/Feed";
import { FeedLenses, FeedTabs, isFeedTab, liveTab } from "@/components/social/feed/FeedMasthead";
import LoadingAround from "@/app/(app)/around/loading";
import { LocationChip } from "@/components/social/feed/LocationChip";
import { StoryRing } from "@/components/social/feed/StoryRing";
import { PeopleRail, WhoToFollow } from "@/components/social/follow/WhoToFollow";
import { PeopleFinder } from "@/components/social/find/PeopleFinder";
import { PeopleSections } from "@/components/social/find/PeopleSections";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { StoryComposer } from "@/components/social/story/StoryComposer";
import { PageHeader } from "@/components/app/PageHeader";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { directoryRow, mostFollowedRow, visibleRows } from "@/lib/social/people-discovery-model";
import { FEED_PLACES, FEED_STORIES, FOLLOW_SAMPLE, YOU } from "../f4/fixtures";
import {
  DIRECTORY_PROPERTY,
  DIRECTORY_STAYS,
  FACTS,
  HITS,
  POPULAR,
  POSTS,
} from "./fixtures";

/**
 * `/preview/feed-v2`: the feed, a post, the composers and the people page on
 * the REAL components with FIXTURE PROPS (rule R-G), inside the real shell.
 *
 *   ?view=feed           For you (default); add &tab=friends for Friends
 *   ?view=friends-empty  Friends with nobody followed
 *   ?view=composer       the post composer, open
 *   ?view=story          the story composer
 *   ?view=people         the people page, sections and list
 *   ?view=search         the people page with a search typed
 *   ?view=people-empty   the people page with no data (every row hidden)
 *   ?view=loading        the feed's skeleton, in the feed's own shape
 *
 * The live routes are the Around page, its people page and the new-story page
 * under `app/(app)`. Nothing here ships and every proof taken from it is
 * labelled fixture-backed.
 */
export default async function FeedV2Harness({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tab?: string }>;
}) {
  const { view = "feed", tab: rawTab } = await searchParams;
  const t = getDictionary("en");
  const words = t.feedV2.feed;
  const w = t.feedV2.people;
  const tab = isFeedTab(rawTab) ? rawTab : view === "friends-empty" ? "friends" : "for-you";
  const friends = liveTab(tab) === "friends";

  const rows = visibleRows([
    directoryRow("top-landlords", DIRECTORY_PROPERTY, FACTS),
    directoryRow("top-agents", DIRECTORY_PROPERTY, FACTS),
    directoryRow("top-hotels", DIRECTORY_STAYS, FACTS),
    mostFollowedRow(POPULAR),
  ]);

  const finderWords = {
    searchLabel: w.searchLabel,
    searchPlaceholder: w.searchPlaceholder,
    clear: w.clear,
    searching: w.searching,
    resultsFor: w.resultsFor,
    noResultsTitle: w.noResultsTitle,
    noResultsBody: w.noResultsBody,
    unavailable: w.unavailableTitle,
    roleLandlord: w.roleLandlord,
    roleAgent: w.roleAgent,
    openProfile: w.openProfile,
    you: w.you,
  };

  return (
    <AppShell
      t={t}
      side="property"
      userName="Seyi Omojuni"
      userHandle="seyifunmi"
      signedIn
      unreadNotifications={0}
      preview={{ route: view === "people" || view === "search" || view === "people-empty" ? "/around/people" : "/around" }}
    >
      {view === "people" || view === "search" || view === "people-empty" ? (
        <div className="nf-ppl" data-testid="people-page">
          <PageHeader title={w.title} fallback="/around" />
          <PeopleFinder
            words={finderWords}
            initialQuery={view === "search" ? "ada" : ""}
            initialHits={view === "search" ? HITS : null}
            signedIn
          >
            <PeopleSections
              rows={view === "people-empty" ? [] : rows}
              suggestions={view === "people-empty" ? [] : FOLLOW_SAMPLE}
              signedIn
              words={w}
              locale="en"
            />
          </PeopleFinder>
        </div>
      ) : view === "loading" ? (
        <LoadingAround />
      ) : view === "story" ? (
        <div className="mx-auto w-full max-w-2xl pb-4xl pt-md">
          <PageHeader title={t.experienceSocial.newStory.title} subtitle={t.experienceSocial.newStory.lede} fallback="/around" />
          <StoryComposer
            areas={[{ id: "00000000-0000-4000-8000-0000000fa001", name: "Lekki Phase 1", city: "Lagos" }]}
            userId="00000000-0000-4000-8000-0000000fd0ff"
            signedIn
            you={YOU}
          />
        </div>
      ) : (
        <div className="nf-fv2-page" style={{ paddingBottom: "var(--nf-tabbar-clearance)" }} data-testid="around-feed">
          <h1 className="sr-only">{t.nav.around}</h1>
          <div className="nf-fv2-grid">
            <div className="nf-fv2-main">
              <div className="nf-fv2-bar">
                <BackButton fallback="/home" surface="round" />
                <FeedLenses t={t} />
                <Link href="/around/people" className="nf-feed-find" aria-label={words.findPeople}>
                  <UiIcon name="search" size={20} />
                </Link>
              </div>
              <div className="nf-lens-track">
              <div className="nf-lens-pane" data-lens="around">
              <StoryRing
                stories={FEED_STORIES}
                yourStoryLabel={words.yourStory}
                storiesLabel={words.storiesLabel}
                addStoryLabel={words.addStory}
              />
              <ComposeButton label={words.writePost} prompt={words.composePrompt} you={YOU} />
              <div className="nf-fv2-filter">
                <FeedTabs active={tab} t={t} />
                <div className="nf-fv2-filter__place">
                  <LocationChip
                    place="Lekki, Lagos"
                    places={FEED_PLACES}
                    currentSlug={null}
                    signedIn
                    copy={{
                      label: t.social.locationLabel,
                      allPlaces: t.social.allPlaces,
                      changePlace: t.social.changePlace,
                      pickPlaces: t.social.pickPlaces,
                      signIn: t.common.signIn,
                    }}
                  />
                </div>
              </div>
              <section>
                <Feed
                  initial={view === "friends-empty" ? [] : friends ? POSTS.slice(0, 3) : POSTS}
                  locale="en"
                  sheet={sheetWordsOf(t)}
                  signedIn
                  canCompose
                  aside={<WhoToFollow people={FOLLOW_SAMPLE} city="Lagos" signedIn more={false} />}
                  emptyMessage={words.emptyFriendsBody}
                  emptyTitle={words.emptyFriendsTitle}
                  emptyIcon="people-ring"
                  emptyAction={{ href: "/around/people", label: words.emptyFriendsAction }}
                />
              </section>
              </div>
              </div>
            </div>
            <aside className="nf-fv2-rail" aria-label={words.railTitle}>
              <PeopleRail people={FOLLOW_SAMPLE} signedIn title={words.railTitle} seeAll={words.railSeeAll} />
            </aside>
          </div>
          <CreateBloom signedIn areas={[]} reviewable={[]} initialCompose={view === "composer"} you={YOU} />
        </div>
      )}
    </AppShell>
  );
}
