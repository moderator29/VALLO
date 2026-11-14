import { PullToRefresh } from "@/components/ui/PullToRefresh";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { stayCardFromRow } from "@/components/app/stays/stay-card-model";
import { SAVED_COOKIE, parseSavedCookie } from "@/lib/saved/keys";
import { getSavedListings, getSavedPlaces } from "@/lib/saved/queries";
import { CountTabs } from "@/components/ui/CountTabs";
import { SavedBoard, type SavedBoardItem } from "./SavedBoard";
import { AddToList, CollectionsBar } from "./Collections";
import { collectionKey, inCollection } from "@/lib/saved/collections";
import { readCollections } from "@/lib/saved/collections-read";
import { listingShelf, placeShelf } from "./shelf-rows";
import { ShelfSync } from "./ShelfSync";
import { SavedFreshness } from "./SavedFreshness";
import { resolveSession } from "@/lib/actions/session";
import { shelfFromListing } from "@/lib/offline/shelf";
import { comparable, compareTable } from "@/lib/saved/compare";
import { SavedCompare } from "./SavedCompare";
import { SavedSort, type SavedSortKey } from "./SavedSort";
import { ShareCollection } from "./ShareCollection";
import { readSavedChanges } from "@/lib/saved/changes";
import { SavedRoommates } from "@/components/roommates/SavedRoommates";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GuideScope } from "@/components/currency/GuideScope";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).nav.saved };
}

/**
 * Saved.
 *
 * The shortlist: every place this account has hearted, kept together and ready
 * to compare or book. Rows in public.saved_items are the account's truth and
 * are read under its own policy; places hearted before signing in, and every
 * catalogue place, ride along from the device mirror so nothing a guest tapped
 * is ever quietly dropped.
 *
 * Cards are rendered here on the server with the same `ListingCard` discovery
 * uses, so the shortlist looks identical to search and the client only carries
 * the heart and the undo chip.
 *
 * ---------------------------------------------------------------------------
 * THE OTHER TWO SHELVES, WHICH HAD ACTIONS AND NO SCREEN.
 *
 * `saved_places` has held the Stays side since M13 and the writes have existed
 * for as long, so a person could heart a hotel or a restaurant and then find
 * NOTHING on this page: the read was never called here, so the save was real,
 * private and invisible. `getSavedPlaces` is that read, under the account's own
 * RLS, handing each row back as a `StaySearchRow` so `stayCardFromRow` draws a
 * saved stay with exactly the card that draws a searched one.
 *
 * SAVED LISTINGS ARE NOT IN THAT READ, deliberately: they are `saved_items`,
 * which `getSavedListings` above already resolves along with the device half.
 * Reading the listing kind out of `saved_places` as well would draw some
 * properties twice and neither shelf could say which heart was which.
 *
 * The two lists interleave by `savedAt`, which is epoch seconds on both sides,
 * so the board is one shortlist in the order the person built it rather than
 * two piles with a heading between them.
 */
export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; sort?: string; rm?: string; kind?: string }>;
}) {
  const { list, sort, rm, kind } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const cookieStore = await cookies();
  const [entries, places, session] = await Promise.all([
    getSavedListings(parseSavedCookie(cookieStore.get(SAVED_COOKIE)?.value)),
    getSavedPlaces(),
    resolveSession(),
  ]);
  /* V-77: the phone's shelf is kept for one account at a time. */
  const owner = session.state === "signed-in" ? session.user.id : null;
  /* B13: what moved on these saves lately (none until the migration lands). */
  const changes =
    session.state === "signed-in"
      ? await readSavedChanges(
          session.supabase as unknown as SupabaseClient,
          entries.filter((e) => e.mode === "db").map((e) => e.listing.id),
        )
      : new Map();

  /* The copies are built here, from the same rows the cards draw, so the
     phone's copy cannot disagree with the card. */
  const shelf = shelfCopies(entries.map((entry) => entry.listing), t.experienceLabels.periodShort);

  /* B3: the compare table for every saved property, most recent first; the
     reader picks two or three of its columns (SavedCompare). */
  const cc = t.catalogue.compare;
  const compare = compareTable(
    [...entries]
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((entry) => entry.listing)
      .filter(comparable),
    locale,
    {
      moveIn: cc.moveIn,
      rent: cc.rent,
      beds: cc.beds,
      baths: cc.baths,
      size: cc.size,
      parking: cc.parking,
      type: cc.type,
      power: cc.power,
      availableFrom: cc.availableFrom,
      from: cc.from,
    },
    t.moveIn,
  );

  /* The board opens on the newest save, so that card's photograph is the
     page's largest paint and loads at once (integration QA O5). */
  const newest = Math.max(-Infinity, ...entries.map((e) => e.savedAt), ...places.map((e) => e.savedAt));
  const collections = session.state === "signed-in" ? await readCollections(session.supabase as unknown as SupabaseClient) : [];
  const activeList = collections.find((c) => c.id === list) ?? null;
  const listsFor = (kind: "listing" | "accommodation" | "restaurant", id: string) =>
    session.state === "signed-in" ? (
      <AddToList collections={collections} itemKey={collectionKey(kind, id)} kind={kind} id={id} />
    ) : undefined;
  const allItems: SavedBoardItem[] = [
    ...entries.map<SavedBoardItem>((entry) => ({
      id: entry.listing.id,
      mode: entry.mode,
      savedAt: entry.savedAt,
      /* Every row on this board is saved by definition; `entry.mode` says
         which half resolved it (R2 finding 4) and the board's Remove reads it. */
      /* A shelf, not a card (the founder's before-after-collection-shelves.jpg
         and ONE-PRODUCT-DECISIONS recommendation 6): the things a member
         keeps are objects on lit ledges. The card stays the catalogue's. */
      card: listingShelf(entry.listing, locale, t, entry.savedAt === newest),
      changes: changes.get(entry.listing.id),
      ...(entry.mode === "db" ? { lists: listsFor("listing", entry.listing.id) } : {}),
      similarHref: `/search?q=${encodeURIComponent(entry.listing.area || entry.listing.city)}`,
    })),
    ...places.map<SavedBoardItem>((entry) => ({
      id: entry.row.entity_id,
      /* A row under RLS, never the device: `saved_places` has no local mirror
         and this page is signed-in only (`proxy.ts` sends a stranger to
         /sign-in), so the mode is the truth rather than a fallback. */
      mode: "db",
      savedAt: entry.savedAt,
      place: { kind: entry.kind === "restaurant" ? "restaurant" : "accommodation", id: entry.row.entity_id },
      card: placeShelf(stayCardFromRow(entry.row), locale, t, entry.savedAt === newest),
      lists: listsFor(entry.kind === "restaurant" ? "restaurant" : "accommodation", entry.row.entity_id),
    })),
  ].sort((a, b) => b.savedAt - a.savedAt);

  const sortKey: SavedSortKey = (["recent", "name", "price-low", "price-high"] as const).includes(sort as SavedSortKey)
    ? (sort as SavedSortKey)
    : "recent";

  const sorted = sortSavedItems(allItems, sortKey, entries);
  const inList = inCollection(sorted, activeList);

  /*
   * THE KIND TABS (the founder's count tab row, 14 November 2026): the one
   * shortlist, narrowed to homes, stays or restaurants, each tab carrying how
   * many it holds. The kind lives in the address (`?kind=`), so back, share
   * and a reload keep the tab, and the counts come from the rows this page
   * already read, never a new query. Saved searches are the same idea kept in
   * another shape, so their screen rides the same row as a link.
   */
  const kindKey: SavedKind = (["all", "homes", "stays", "restaurants"] as const).includes(kind as SavedKind)
    ? (kind as SavedKind)
    : "all";
  const items = inList.filter((item) => inKind(item, kindKey));
  const kindCounts = {
    homes: allItems.filter((i) => inKind(i, "homes")).length,
    stays: allItems.filter((i) => inKind(i, "stays")).length,
    restaurants: allItems.filter((i) => inKind(i, "restaurants")).length,
  };
  const sv = t.experienceDiscover.saved;
  const hrefFor = (next: SavedKind) => {
    const params = new URLSearchParams();
    if (next !== "all") params.set("kind", next);
    if (list) params.set("list", list);
    if (sort) params.set("sort", sort);
    const q = params.toString();
    return q ? `/saved?${q}` : "/saved";
  };

  return (
    <GuideScope copy={t.experienceSettings.preferences}>
    <PullToRefresh className="nf-cat-surface mx-auto max-w-3xl">
      <div className="relative">
        <PageScene art="globe-pin" />
      <PageHeader variant="large" title={t.nav.saved} />
      </div>
      {/* The kind tabs (the founder's count tab row, 14 November 2026). The
          saved SEARCHES ride the same row as a link, because they are the
          same idea kept in another shape and a person with none of them yet
          has no other way to reach that screen and read what it is for. */}
      <CountTabs
        semantics="links"
        label={sv.kinds.label}
        active={kindKey}
        countCap={99}
        className="mb-heading"
        data-testid="saved-kind-tabs"
        items={[
          { key: "all", label: sv.kinds.all, href: hrefFor("all") },
          { key: "homes", label: sv.kinds.homes, href: hrefFor("homes"), ...(kindCounts.homes > 0 ? { count: kindCounts.homes } : {}) },
          { key: "stays", label: sv.kinds.stays, href: hrefFor("stays"), ...(kindCounts.stays > 0 ? { count: kindCounts.stays } : {}) },
          {
            key: "restaurants",
            label: sv.kinds.restaurants,
            href: hrefFor("restaurants"),
            ...(kindCounts.restaurants > 0 ? { count: kindCounts.restaurants } : {}),
          },
          { key: "searches", label: sv.searchesLink, href: "/saved/searches", "data-testid": "saved-searches-link" },
        ]}
      />
      {/* V-77: the saved listings, copied to the phone for when there is no
          signal, and any figure that moved since it was first copied. */}
      <SavedFreshness render={crypto.randomUUID()} />
      {owner && <ShelfSync owner={owner} items={shelf} copy={t.platform.shelf} locale={locale} />}
      {session.state === "signed-in" && allItems.length > 0 ? (
        <CollectionsBar collections={collections} active={activeList?.id ?? null} />
      ) : null}
      {allItems.length > 1 ? (
        <div className="mb-heading flex items-center gap-xs">
          <SavedSort active={sortKey} />
          <ShareCollection collection={activeList} />
        </div>
      ) : null}
      <SavedBoard
        items={items}
        comparable={compare.columns.length}
        copy={{ shortlist: cc.shortlist, ready: cc.ready }}
        changeCopy={t.catalogue.savedChanges}
        slotCopy={{
          remove: t.experienceDiscover.saved.remove,
          removeLabel: t.experienceDiscover.saved.removeLabel,
          removed: t.experienceDiscover.saved.removed,
          restoring: t.experienceDiscover.saved.restoring,
          undo: t.experienceDiscover.saved.undo,
        }}
        emptyCopy={{
          title: t.experienceDiscover.saved.emptyTitle,
          body: t.experienceDiscover.saved.emptyBody,
          hydratingTitle: t.experienceDiscover.saved.hydratingTitle,
          hydratingBody: t.experienceDiscover.saved.hydratingBody,
          action: t.experienceDiscover.saved.emptyAction,
          captureLead: t.experienceDiscover.saved.captureLead,
          capture: t.experienceDiscover.saved.capture,
        }}
        compare={
          <SavedCompare
            table={compare}
            copy={{
              open: cc.open,
              openLabel: cc.openLabel,
              title: cc.title,
              pick: t.experienceDiscover.saved.pickTwo,
              pickLimit: t.experienceDiscover.saved.pickSwap,
              tooFew: cc.tooFew,
              notStated: cc.notStated,
              view: cc.view,
              close: cc.close,
              verified: t.common.verified,
              lower: t.experienceDiscover.saved.lower,
            }}
          />
        }
      />
      {/* Vallo Roommates: saved posts and people, on the same lists. */}
      <SavedRoommates
        tab={rm === "people" ? "people" : rm === "rooms" ? "rooms" : undefined}
        keep={{ list, sort }}
        onlyKeys={activeList?.keys ?? null}
        listFor={(kind, id) => (session.state === "signed-in" ? <AddToList collections={collections} itemKey={collectionKey(kind, id)} kind={kind} id={id} /> : undefined)}
      />
    </PullToRefresh>
    </GuideScope>
  );
}

/** The kind tabs' keys. "searches" is a link off the page, never a filter here. */
type SavedKind = "all" | "homes" | "stays" | "restaurants";

/** Which tab a saved row belongs under: the place kind, or a home listing. */
function inKind(item: SavedBoardItem, kind: SavedKind): boolean {
  if (kind === "all") return true;
  if (kind === "homes") return !item.place;
  if (kind === "stays") return item.place?.kind === "accommodation";
  return item.place?.kind === "restaurant";
}

/** V-77: the phone's copies, stamped with the time of the read, not a render. */
function shelfCopies(listings: Parameters<typeof shelfFromListing>[0][], short: Parameters<typeof shelfFromListing>[2]) {
  const readAt = Date.now();
  return listings.map((listing) => shelfFromListing(listing, readAt, short));
}

function sortSavedItems(
  items: SavedBoardItem[],
  key: SavedSortKey,
  entries: { listing: { title: string; priceMinor?: number | null; moveInCostMinor?: number | null } }[],
): SavedBoardItem[] {
  if (key === "recent") return items;
  const priceOf = (item: SavedBoardItem): number => {
    for (const e of entries) {
      if (e.listing.title && item.id) {
        const l = e.listing as { id?: string; priceMinor?: number | null; moveInCostMinor?: number | null };
        if (l.id === item.id) return l.moveInCostMinor ?? l.priceMinor ?? Infinity;
      }
    }
    return Infinity;
  };
  const copy = [...items];
  switch (key) {
    case "name":
      return copy.sort((a, b) => {
        const aEntry = entries.find((e) => (e.listing as { id?: string }).id === a.id);
        const bEntry = entries.find((e) => (e.listing as { id?: string }).id === b.id);
        const aTitle = (aEntry?.listing.title ?? "").toLowerCase();
        const bTitle = (bEntry?.listing.title ?? "").toLowerCase();
        return aTitle.localeCompare(bTitle);
      });
    case "price-low":
      return copy.sort((a, b) => priceOf(a) - priceOf(b));
    case "price-high":
      return copy.sort((a, b) => priceOf(b) - priceOf(a));
    default:
      return copy;
  }
}
