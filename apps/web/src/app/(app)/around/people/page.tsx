import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { PeopleFinder } from "@/components/social/find/PeopleFinder";
import { typedOf } from "@/components/social/find/typed";
import { PeopleSections } from "@/components/social/find/PeopleSections";
import { EmptyPanel } from "@/components/social/profile/EmptyPanel";
import { SocialPaused } from "@/components/social/SocialPaused";
import { getLocale } from "@/lib/locale";
import { isSocialEnabled } from "@/lib/social/flag";
import { listMyAreas } from "@/lib/social/areas-queries";
import { findPeople } from "@/lib/social/people-queries";
import { hitsOf, type PersonHit } from "@/lib/social/people-hits";
import { readPeopleDiscovery } from "@/lib/social/people-discovery";

export const metadata: Metadata = {
  title: "Find people",
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * FIND PEOPLE (founder, 13 October 2026): the feed's search icon opens this.
 *
 * A big search field on top (handle and display name, through the existing
 * people search), then sideways rows of profile cards (Top landlords, Top
 * agents, Top hotels, Most followed) and "People to follow" as a list. Every
 * rank comes from a number the database holds (`lib/social/people-discovery`
 * says which), and a row with nobody in it is not drawn: this page never
 * invents a rank, a count or a person.
 *
 * It is signed-in only, like the feed it hangs off (`/around` is not a public
 * segment in `proxy.ts`). The address carries the search (`?q=`), so a search
 * can be sent, reloaded or gone back to, and works before any script has
 * loaded; with script the field answers as you type.
 */
export default async function FindPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!(await isSocialEnabled())) return <SocialPaused />;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const w = t.feedV2.people;

  const params = await searchParams;
  const query = typedOf(first(params.q) ?? "");
  const mine = await listMyAreas();
  const city = mine.find((area) => area.status === "ACTIVE")?.city ?? null;

  const [discovery, found] = await Promise.all([
    readPeopleDiscovery({ city }),
    query.length >= 2 ? findPeople(query) : Promise.resolve(null),
  ]);

  const signedIn = discovery.state === "ready" ? discovery.signedIn : found?.state === "ready" ? found.signedIn : false;
  const initialHits: PersonHit[] | null = found && found.state === "ready" ? hitsOf(found.people, 24) : null;

  return (
    <div className="nf-ppl" data-testid="people-page">
      <PageHeader title={w.title} fallback="/around" />

      <PeopleFinder
        words={{
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
        }}
        initialQuery={query}
        initialHits={initialHits}
        signedIn={signedIn}
      >
        {discovery.state === "unavailable" ? (
          <EmptyPanel
            icon="people-ring"
            title={w.unavailableTitle}
            body={w.unavailableBody}
            action={{ href: "/around", label: w.back }}
          />
        ) : discovery.rows.length === 0 && discovery.suggestions.length === 0 ? (
          <EmptyPanel
            icon="people-ring"
            title={w.emptyTitle}
            body={w.emptyBody}
            action={{ href: "/around", label: w.back }}
          />
        ) : (
          <PeopleSections
            rows={discovery.rows}
            suggestions={discovery.suggestions}
            signedIn={discovery.signedIn}
            words={w}
            locale={locale}
          />
        )}
      </PeopleFinder>
    </div>
  );
}
