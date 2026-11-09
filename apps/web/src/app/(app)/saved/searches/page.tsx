import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { Unreachable } from "@/components/app/Unreachable";
import { Reveal } from "@/components/site/Reveal";
import { SavedSearchBoard } from "@/components/app/saved-searches/SavedSearchBoard";
import { getLocale } from "@/lib/locale";
import { listSavedSearches } from "@/lib/saved/searches-queries";
import { searchChipCopyOf } from "@/lib/saved/searches";
import { getDictionary } from "@vallo/i18n";
import { readMyBriefs } from "@/lib/briefs/queries";
import { briefDraftFrom } from "@/lib/briefs/brief";
import { BriefComposer } from "@/components/app/briefs/BriefComposer";
import { MyBriefs } from "@/components/app/briefs/MyBriefs";
import { resolveSession } from "@/lib/actions/session";
import { loadListingsByIds } from "@/lib/listings/supabase-repository";
import { withNext } from "@/lib/auth/next-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceDiscover.saved.searchesLink };
}

/**
 * Saved searches.
 *
 * The hunts this account keeps, read under its own policy in this request, so
 * what is drawn is what the database holds and a reload proves it.
 *
 * ---------------------------------------------------------------------------
 * THE EMPTY STATE IS THE MAIN STATE, AND IT IS WRITTEN AS ONE.
 *
 * A new account has no saved searches BY DEFINITION, so this screen's first
 * and most-seen face is the one with nothing on it. It does not apologise, it
 * does not describe a feature in the abstract, and it does not say "tap the
 * bookmark" about a control the reader cannot see from here. It says what a
 * saved search is FOR, in one sentence, and sends them to the one place the
 * control exists.
 *
 * ---------------------------------------------------------------------------
 * FOUR STATES, ALL DESIGNED. A read that failed is NOT drawn as an empty
 * shortlist: telling somebody their saved work is gone when the query simply
 * did not come back is the worst thing this screen could do, so a failed read
 * gets the unreachable screen, which says the fault is ours and nothing was
 * lost. Signed out gets its own screen rather than a redirect, because the
 * product shell may or may not have caught them first.
 */
export default async function SavedSearchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const state = await listSavedSearches();
  const t = getDictionary(locale);
  const sv = t.experienceDiscover.saved;

  /* V-95: the renter's briefs, the answers' titles, and a draft when they
     came from a search that found nothing (`?brief=1` plus its filters). */
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params[key] = value;
  const signedIn = state.state === "signed-in";
  const briefs = signedIn ? await readMyBriefs() : null;
  const answerIds = [...new Set((briefs ?? []).flatMap((b) => b.answers.map((a) => a.listingId)))];
  const session = signedIn && answerIds.length > 0 ? await resolveSession() : null;
  const found =
    session && session.state === "signed-in" ? await loadListingsByIds(session.supabase, answerIds).catch(() => new Map()) : new Map();
  const titles: Record<string, string> = {};
  for (const [id, listing] of found) titles[id] = (listing as { title: string }).title;

  return (
    <div className="mx-auto max-w-2xl">
      {/* The same brand object anchor /saved opens on, because a person
          crossing between the two shelves should not cross a seam. See the
          note in LiveNotifications for why it wraps the header alone. A2. */}
      <div className="relative">
        <PageScene art="search-ring" />
        <PageHeader title={sv.searchesLink} fallback="/saved" />
      </div>

      {state.state === "unconfigured" || state.state === "unavailable" ? (
        <Reveal>
          <Unreachable
            noun="saved searches"
            icon="search-ring"
            action={{ label: sv.searchesRetry, href: "/saved/searches" }}
            data-testid="saved-searches-unreachable"
          />
        </Reveal>
      ) : state.state === "signed-out" ? (
        /* Stage 5 (Session 3, W2): the object settles, the reason is the
           true one (a search belongs to an account), and both ways onward
           are offered, the second as a quiet link. */
        <DiscoveryEmpty
          data-testid="saved-searches-signed-out"
          object="empty-search"
          title={sv.searchesSignedOutTitle}
          body={sv.searchesSignedOutBody}
          primary={{ label: sv.searchesSignIn, href: withNext("/sign-in", "/saved/searches") }}
          secondary={
            <Link href="/search" className="nf-tap nf-link-quiet nf-body inline-flex min-h-11 items-center text-[var(--nf-content-link)]">
              {sv.searchesBrowse}
            </Link>
          }
        />
      ) : state.searches.length === 0 ? (
        /* The main state, written as one: what a saved search is FOR, and the
           one place the control exists. A brief, the other way to say what
           you need, sits in its own section below. */
        <DiscoveryEmpty
          data-testid="saved-searches-empty"
          object="empty-search"
          title={sv.searchesEmptyTitle}
          body={sv.searchesEmptyBody}
          primary={{ label: sv.searchesStart, href: "/search" }}
          secondary={
            <Link href="/saved" className="nf-tap nf-link-quiet nf-body inline-flex min-h-11 items-center text-[var(--nf-content-link)]">
              {sv.searchesPlaces}
            </Link>
          }
        />
      ) : (
        <Reveal>
          <SavedSearchBoard initial={state.searches} locale={locale} chipCopy={searchChipCopyOf(t.shape)} copy={sv.board} />
        </Reveal>
      )}

      {signedIn && (
        <section id="briefs" className="mt-lg flex flex-col gap-row" aria-labelledby="briefs-title">
          <h2 id="briefs-title" className="nf-h4 text-[var(--nf-content-primary)]">
            {t.frontDoor.briefs.title}
          </h2>
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{t.frontDoor.briefs.lede}</p>
          <BriefComposer
            copy={t.frontDoor.briefs}
            saved={state.state === "signed-in" ? state.searches.map((s) => ({ id: s.id, label: s.label, params: s.params })) : []}
            initial={params.brief === "1" ? briefDraftFrom(params) : null}
          />
          <MyBriefs briefs={briefs} titles={titles} copy={t.frontDoor.briefs} locale={locale} />
        </section>
      )}
    </div>
  );
}
