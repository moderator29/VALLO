import "server-only";

import { discoverPeople, searchRooms } from "@/lib/features/roommates/queries";
import { EMPTY_PEOPLE_FILTERS, EMPTY_ROOM_FILTERS, type RoomCard, type RoommateCard } from "@/lib/features/roommates/model";
import { countOf } from "@vallo/i18n/core";
import type { IntelligenceResult, Understood } from "../contract";
import { placeFromLabel } from "../places";
import { compact, matchesAllWords, nairaOf } from "./format";
import type { Source } from "./types";

/**
 * ROOMMATES: ROOMS OFFERED, AND (SIGNED IN) PEOPLE OPEN TO MATCHING.
 *
 * Both through the roommates module's own reads, which call SECURITY DEFINER
 * functions that hold every privacy rule (`roommate_search_listings`: live
 * listings only; `roommate_discover`: hidden fields come back null, blocked
 * people never come back, and only a member with an active profile of their
 * own may browse people). Nothing here reads a roommate table directly.
 *
 * No budget is passed: a roommate share is priced per month or per year and
 * the words rarely say which, so a ceiling would be a guess. The "why" line
 * therefore never claims one.
 */

function roomResult(room: RoomCard): IntelligenceResult {
  const href = `/roommates/r/${room.id}`;
  const per = room.rentPeriod === "month" ? "month" : room.rentPeriod === "year" ? "year" : undefined;
  const amount = room.shareMinor ?? room.rentMinor;
  return compact({
    key: `roommate:room:${room.id}`,
    kind: "roommate",
    title: room.title,
    href,
    subtitle: room.roomsAvailable ? `${countOf(room.roomsAvailable, "rooms")} available` : "Room offered",
    imageUrl: room.photoUrls[0],
    price: amount && amount > 0 && per ? { amount: nairaOf(amount), per } : undefined,
    place: [room.area, room.city].filter(Boolean).join(", ") || undefined,
    bedrooms: room.bedrooms ?? undefined,
    verified: room.verified,
    actions: [{ id: "open", label: "Open", href }],
  });
}

function personResult(card: RoommateCard): IntelligenceResult {
  const href = `/roommates/p/${card.userId}`;
  return compact({
    key: `roommate:person:${card.userId}`,
    kind: "roommate",
    title: card.name,
    href,
    subtitle: "Looking for a roommate",
    imageUrl: card.avatarUrl ?? undefined,
    place: [card.areas[0], card.city].filter(Boolean).join(", ") || undefined,
    actions: [{ id: "view-profile", label: "View profile", href }],
    person: card.handle ? { handle: card.handle } : undefined,
  });
}

function placeWords(u: Understood): { city: string | null; area: string | null } {
  const place = placeFromLabel(u.place);
  if (!place) return { city: null, area: null };
  return { city: place.city, area: place.isCity ? null : place.name };
}

export const roommateSource: Source = {
  kind: "roommate",
  applies: ({ understood }) =>
    understood.kind === "roommate" || ((understood.kind === undefined || understood.kind === "place") && Boolean(understood.place || understood.text)),
  async run(ctx) {
    const u = ctx.understood;
    const { city, area } = placeWords(u);
    const [rooms, people] = await Promise.all([
      searchRooms({ ...EMPTY_ROOM_FILTERS, q: [area, u.text].filter(Boolean).join(" "), city }, 0),
      ctx.viewer.signedIn && u.kind === "roommate"
        ? discoverPeople({ ...EMPTY_PEOPLE_FILTERS, q: u.text ?? "", city }, 0)
        : Promise.resolve(null),
    ]);
    const roomRows = rooms.state === "ok" ? rooms.items.map(roomResult) : [];
    const peopleRows =
      people && people.state === "ok"
        ? people.items.filter((p) => p.userId !== ctx.viewer.userId && matchesAllWords(area ?? undefined, `${p.areas.join(" ")} ${p.city ?? ""}`)).map(personResult)
        : [];
    const all = [...roomRows, ...peopleRows];
    return {
      results: all.slice(ctx.offset, ctx.offset + ctx.limit),
      total: rooms.state === "ok" && rooms.next === null && (!people || people.state !== "ok" || people.next === null) ? all.length : undefined,
      more: u.kind === "roommate" && ctx.viewer.signedIn ? "/roommates/discover" : "/roommates",
    };
  },
};
