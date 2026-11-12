import { formatNumber } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { sheetWordsOf } from "@/components/social/sheet-words";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Feed } from "@/components/social/feed/Feed";
import { AroundFab } from "@/components/social/AroundFab";
import { JoinButton } from "@/app/(app)/around/JoinButton";
import { PLACE_COPY } from "@/lib/social/places-model";
import { FEED_PLACES, FEED_POSTS, FEED_STORIES, PLACE_REVIEWS } from "../fixtures";

/**
 * One place, from fixtures: the district feed with its header, chips, stories
 * and reviews, the stat card under the conversation, the finer places inside
 * this one, and the dock. `/around/[slug]` composes exactly this.
 */
const AREA = {
  id: "00000000-0000-4000-8000-00000000c001",
  name: "Lekki Phase 1",
  city: "Lagos",
  slug: "lekki-phase-1",
  blurb:
    "The stretch between Admiralty Way and the second roundabout, and everything people who live here actually need to know about it.",
  memberCount: 1284,
  postCount: 96,
};

const WITHIN = [
  { id: "w1", slug: "admiralty-way", name: "Admiralty Way", memberCount: 212 },
  { id: "w2", slug: "osapa-london", name: "Osapa London", memberCount: 148 },
  { id: "w3", slug: "ikate", name: "Ikate", memberCount: 96 },
];

export default function PlacePreview() {
  return (
    <div className="nf-shell mx-auto w-full max-w-3xl pb-4xl pt-md">
      <Link href="/around/eti-osa" className="nf-chip nf-enter__back mb-md">
        <UiIcon name="arrow-up" size={16} />
        Part of Eti-Osa
      </Link>

      <section className="mb-lg">
        <Feed
          initial={FEED_POSTS}
          locale="en"
          sheet={sheetWordsOf(getDictionary("en"))}
          signedIn
          canCompose
          areaId={AREA.id}
          areaName={AREA.name}
          emptyMessage=""
          district={{
            city: AREA.city,
            slug: AREA.slug,
            places: FEED_PLACES,
            stories: FEED_STORIES,
            reviews: PLACE_REVIEWS,
            join: <JoinButton areaId={AREA.id} joined={false} signedIn size="sm" />,
          }}
        />
      </section>

      <section className="nf-card mb-md p-lg">
        <p className="text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-primary)]">
          {AREA.blurb}
        </p>
        <dl className="mt-md flex flex-wrap gap-x-lg gap-y-sm">
          <div>
            <dt className="nf-overline text-[var(--nf-content-muted)]">Members</dt>
            <dd className="nf-numeric mt-3xs text-[length:var(--nf-text-body-lg)] font-bold text-[var(--nf-content-primary)]">
              {formatNumber(AREA.memberCount, "en")}
            </dd>
          </div>
          <div>
            <dt className="nf-overline text-[var(--nf-content-muted)]">Posts</dt>
            <dd className="nf-numeric mt-3xs text-[length:var(--nf-text-body-lg)] font-bold text-[var(--nf-content-primary)]">
              {formatNumber(AREA.postCount, "en")}
            </dd>
          </div>
          <div>
            <dt className="nf-overline text-[var(--nf-content-muted)]">Looked after by</dt>
            <dd className="nf-numeric mt-3xs text-[length:var(--nf-text-body-lg)] font-bold text-[var(--nf-content-primary)]">
              2
            </dd>
          </div>
        </dl>
        <p className="mt-md text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          Kept by{" "}
          <Link href="/u/chii_realty" className="font-semibold text-[var(--nf-brand-secondary)]">
            @chii_realty
          </Link>
          . They can hide a post while somebody reviews it, and they cannot delete
          anybody&rsquo;s post.
        </p>
      </section>

      <section className="nf-enter mb-md">
        <h2 className="nf-enter__title">{PLACE_COPY.withinTitle(AREA.name)}</h2>
        <p className="nf-enter__lede">{PLACE_COPY.withinBody}</p>
        <ul className="nf-enter__grid">
          {WITHIN.map((place) => (
            <li key={place.id}>
              <Link href={`/around/${place.slug}`} className="nf-chip nf-enter__chip">
                <span className="nf-enter__chip-name">{place.name}</span>
                <span className="nf-enter__chip-count nf-numeric">
                  {formatNumber(place.memberCount, "en")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AroundFab currentAreaId={AREA.id} />
    </div>
  );
}
