import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readPeopleFilters, readRoomFilters, type RoomCard, type RoommateCard } from "@/lib/features/roommates/model";
import { discoverPeople, listInstitutions, searchRooms } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { DiscoverView, MAX_PAGES, type DiscoverResult } from "./_parts/DiscoverView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.ui.discover.title}, ${copy.title}`, description: copy.ui.discover.subtitle };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/**
 * DISCOVER, THE READ: the filters from the address, then as many pages as
 * `?more=` asks for (Back lands on the same list), in order. The screen is
 * `_parts/DiscoverView.tsx`.
 */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const mode = params.mode === "rooms" ? "rooms" : "people";
  const pages = Math.min(MAX_PAGES, Math.max(1, Number.parseInt(typeof params.more === "string" ? params.more : "1", 10) || 1));
  const people = readPeopleFilters(params);
  const rooms = readRoomFilters(params);
  const schools = await listInstitutions({ limit: 1500 });

  let result: DiscoverResult;
  if (mode === "people") {
    let items: RoommateCard[] = [];
    let next: number | null = 0;
    result = { mode: "people", state: "ok", items, next: null };
    for (let i = 0; i < pages && next !== null; i += 1) {
      const page = await discoverPeople(people, next);
      if (page.state !== "ok") {
        result = { mode: "people", state: page.state, items: [], next: null };
        next = null;
        break;
      }
      items = items.concat(page.items);
      next = page.next;
      result = { mode: "people", state: "ok", items, next };
    }
  } else {
    let items: RoomCard[] = [];
    let next: number | null = 0;
    result = { mode: "rooms", state: "ok", items, next: null };
    for (let i = 0; i < pages && next !== null; i += 1) {
      const page = await searchRooms(rooms, next);
      if (page.state !== "ok") {
        result = { mode: "rooms", state: "not-open", items: [], next: null };
        next = null;
        break;
      }
      items = items.concat(page.items);
      next = page.next;
      result = { mode: "rooms", state: "ok", items, next };
    }
  }

  return <DiscoverView t={copy} result={result} people={people} rooms={rooms} schools={schools.items} pages={pages} now={requestNow()} />;
}
