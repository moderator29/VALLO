"use client";

import type { SheetWords } from "@/components/social/sheet-words";
import { useCallback, useRef, useState } from "react";
import { Feed } from "@/components/social/feed/Feed";
import { withNext } from "@/lib/auth/next-link";
import type { PostView } from "@/components/social/feed/PostCard";
import type { ActivityEntry } from "@/lib/social/posts-queries";
import type { MediaTile, PropertyCard, ReviewCard } from "@/lib/social/profile-tabs-queries";
import type { StoryCard } from "@/lib/social/stories-queries";
import { MediaGrid } from "./MediaGrid";
import { PropertyList } from "./PropertyList";
import { ReviewList } from "./ReviewList";
import { ActivityList } from "./ActivityList";
import { StoryGrid } from "../story/StoryGrid";
import { EmptyPanel } from "./EmptyPanel";
import type { TabKey } from "@/lib/social/profile-tabs-schema";
import type { Dictionary } from "@vallo/i18n/core";
import "./social-profile.css";

/**
 * The tabs, and what is under them.
 *
 * **Two sets, because two kinds of person are asked different questions about
 * themselves.** Somebody renting gets Posts, Replies, Media and Activity.
 * An agent gets Properties, Stories, Reviews and Activity, because what a
 * stranger wants from an agent's page is the flats, the writing, and what
 * other guests said, in that order.
 *
 * A normal person never sees a Properties tab. That is not a filter, it is the
 * whole point: an empty Properties tab on somebody who does not sell property
 * is a worse lie than an absent one, and it is the exact reason this bar was
 * deleted once before when Replies could not fill.
 *
 * Three decisions worth stating, because each had an obvious wrong answer.
 *
 * **Everything arrives with the page.** The four reads run in parallel on the
 * server, so the whole set costs one round trip and moving between tabs is
 * instant on a connection where a round trip is 400ms. Fetching a tab when it
 * is opened spends that 400ms every single time somebody looks.
 *
 * **The tab lives in the address bar and switching does not navigate.**
 * `history.replaceState` writes `?tab=` without asking Next for a new render,
 * so a reload lands back where the person was and a share is a link to the
 * thing they were looking at, while the switch itself costs nothing. A real
 * navigation would re-run the route and flash the profile skeleton.
 *
 * **Arrow keys move between tabs**, because a tab list that only answers to a
 * pointer is a tab list half the people using it cannot reach.
 *
 * **The live tab is filled, not underlined.** A two pixel stroke under one word
 * in a row of four is the smallest possible statement of where you are, and on
 * a 390px screen held at arm's length in daylight it is very nearly no
 * statement at all. A filled pill on an inset track says it once, loudly, and
 * it is the same pill geometry the rest of the platform uses for a chosen
 * thing.
 *
 * The words are `t.socialProfile`, handed down by the page rather than read
 * from a constant, because this is a client component and there is no locale
 * context. Only that section travels, not the whole dictionary: the tab bar
 * needs eight strings and the payload for the rest would be paid on every
 * profile anybody opens.
 */

export type TabLabels = Dictionary["socialProfile"];

const LABEL_KEY = {
  posts: "tabPosts",
  replies: "tabReplies",
  media: "tabMedia",
  activity: "tabActivity",
  properties: "tabProperties",
  stories: "tabStories",
  reviews: "tabReviews",
} as const satisfies Record<TabKey, keyof TabLabels>;

export type ProfileTabData = {
  posts: PostView[];
  replies: PostView[];
  media: MediaTile[];
  activity: ActivityEntry[];
  properties: PropertyCard[];
  stories: StoryCard[];
  reviews: ReviewCard[];
};

export function ProfileTabs({
  handle,
  isOwner,
  signedIn,
  hasBio,
  tabs,
  data,
  storyCount,
  initialTab,
  labels,
  sheet,
}: {
  handle: string;
  isOwner: boolean;
  signedIn: boolean;
  hasBio: boolean;
  tabs: TabKey[];
  data: ProfileTabData;
  /** `t.socialProfile`, from the server component that owns the request. */
  labels: TabLabels;
  /** Printed beside Stories. Only an agent's bar carries it. */
  storyCount: number;
  /** The post action sheet's two lines, from the server. */
  sheet: SheetWords;
  initialTab?: TabKey;
}) {
  const first = tabs[0] ?? "posts";
  const [tab, setTab] = useState<TabKey>(
    initialTab && tabs.includes(initialTab) ? initialTab : first,
  );
  const listRef = useRef<HTMLDivElement>(null);
  /* The panel crossfades with a 12px lift (`nf-tab-swap`) once a tab has been
     CHOSEN, never for the tab the page opens on. */
  const [moved, setMoved] = useState(false);

  const select = useCallback(
    (next: TabKey) => {
      setMoved(true);
      setTab(next);
      /* Next.js supports writing the browser's own history entry directly for
         exactly this case: state the page already holds, reflected in the URL,
         with no server round trip. Wrapped because a sandboxed frame can refuse
         it, and a tab bar must not throw when it does. */
      try {
        const url = new URL(window.location.href);
        if (next === first) url.searchParams.delete("tab");
        else url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* The tab still changed. The address bar simply did not follow. */
      }
    },
    [first],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = tabs.indexOf(tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    select(target);
    listRef.current?.querySelector<HTMLButtonElement>(`#nf-tab-${target}`)?.focus();
  };

  return (
    <>
      <div
        ref={listRef}
        role="tablist"
        aria-label={labels.tabsLabel.replace("{handle}", handle)}
        onKeyDown={onKeyDown}
        className="nf-glass-seg nf-glass-seg--profile"
        style={{ "--nf-seg-count": tabs.length } as React.CSSProperties}
      >
        {tabs.map((key) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              id={`nf-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              /*
               * Only the selected tab names a panel, because only the selected
               * tab HAS one: a single `#nf-panel-${tab}` is rendered below and
               * the other panels do not exist in the DOM. Setting
               * `aria-controls` on all six pointed five of them at an id that
               * was not there, and a dangling IDREF is not a weaker promise
               * than none - it is a broken one, which assistive technology
               * reports as a fault in the page rather than quietly ignoring.
               *
               * The alternative is rendering all six panels and hiding five.
               * `Panel` draws posts, replies, stories, photos, properties and
               * activity, every one of them image-heavy, so that is six times
               * the DOM and six times the image fetches to satisfy an
               * attribute. Omitting it where it cannot be honoured is both
               * correct and free; `aria-controls` is optional on a tab.
               */
              aria-controls={selected ? `nf-panel-${key}` : undefined}
              tabIndex={selected ? 0 : -1}
              className="nf-glass-seg__tab"
              onClick={() => select(key)}
            >
              {labels[LABEL_KEY[key]]}
              {key === "stories" && storyCount > 0 ? (
                <span className="nf-social-tab__count nf-numeric">{storyCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        key={tab}
        id={`nf-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`nf-tab-${tab}`}
        tabIndex={-1}
        className={`mt-md${moved ? " nf-tab-swap" : ""}`}
      >
        <Panel
          tab={tab}
          handle={handle}
          isOwner={isOwner}
          signedIn={signedIn}
          hasBio={hasBio}
          data={data}
          sheet={sheet}
        />
      </div>
    </>
  );
}

function Panel({
  tab,
  handle,
  isOwner,
  signedIn,
  hasBio,
  data,
  sheet,
}: {
  tab: TabKey;
  handle: string;
  isOwner: boolean;
  signedIn: boolean;
  hasBio: boolean;
  data: ProfileTabData;
  sheet: SheetWords;
}) {
  if (tab === "posts" || tab === "replies") {
    const posts = tab === "posts" ? data.posts : data.replies;
    if (posts.length === 0) {
      return (
        <EmptyPanel
          icon={tab === "posts" ? "chat" : "chat-duo"}
          title={
            isOwner
              ? tab === "posts"
                ? "Nothing here yet"
                : "You have not replied to anything yet"
              : tab === "posts"
                ? `@${handle} has not posted yet`
                : `@${handle} has not replied to anything yet`
          }
          body={
            isOwner
              ? tab === "posts"
                ? "Everything you write around a place sits here, newest first, so anybody who follows you can find it later."
                : "Answering somebody is the fastest way into a place. Every reply you write shows up here with the person it answers."
              : tab === "posts"
                ? "When they write something around a place, it shows up here."
                : "Replies they write in a conversation show up here, alongside the person each one answers."
          }
          action={
            isOwner
              ? hasBio
                ? { href: "/around", label: "Find a place to talk in" }
                : { href: `/u/${handle}/edit`, label: "Add your bio" }
              : undefined
          }
        />
      );
    }
    return (
      <Feed
        key={tab}
        initial={posts}
        sheet={sheet}
        signedIn={signedIn}
        /* VIEW-ONLY PUBLIC PROFILE (founder, 9 November 2026). A signed-out
           visitor who taps like, reply, repost or save goes to sign UP carrying
           this page, not the app's shared sign-in door. */
        signedOutHref={signedIn ? undefined : withNext("/sign-up", `/u/${handle}`)}
        emptyMessage={
          isOwner
            ? "Everything you write around a place sits here."
            : `When @${handle} writes something, it shows up here.`
        }
      />
    );
  }

  if (tab === "media") {
    return <MediaGrid tiles={data.media} handle={handle} isOwner={isOwner} />;
  }

  if (tab === "activity") {
    return <ActivityList entries={data.activity} handle={handle} isOwner={isOwner} signedIn={signedIn} sheet={sheet} />;
  }

  if (tab === "properties") {
    if (data.properties.length === 0) {
      return (
        <EmptyPanel
          icon="homes-sparkle"
          title={isOwner ? "No live listings yet" : `@${handle} has nothing live right now`}
          body={
            isOwner
              ? "Every listing of yours that is live shows up here, so somebody reading your page can go straight to it."
              : "When they publish a place, it shows up here."
          }
          action={isOwner ? { href: "/agent/listings", label: "Go to your listings" } : undefined}
        />
      );
    }
    return <PropertyList properties={data.properties} />;
  }

  if (tab === "stories") {
    return <StoryGrid stories={data.stories} handle={handle} isOwner={isOwner} />;
  }

  if (data.reviews.length === 0) {
    return (
      <EmptyPanel
        icon="reviews"
        title={isOwner ? "No reviews yet" : `Nobody has reviewed @${handle} yet`}
        body={
          isOwner
            ? "A guest can write a review after they have stayed. They show up here as they arrive."
            : "Reviews from guests who have stayed show up here."
        }
      />
    );
  }
  return <ReviewList reviews={data.reviews} />;
}
