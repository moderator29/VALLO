import { describe, expect, it } from "vitest";
import {
  agentMonthly,
  countByMonth,
  daysBetween,
  enquiriesInLastDays,
  isBlank,
  isPaid,
  lastMonthKeys,
  leasesEndingToday,
  monthGrid,
  nextRentDue,
  ownerView,
  paidByBooking,
  parseAgreementsWaiting,
  parseBuildings,
  parseEarnings,
  parseEnquiries,
  parseTenancies,
  parseVisits,
  pickFeatured,
  recentContacts,
  reminders,
  renewalsWithin,
  rentMonth,
  rentPaidByMonth,
  runningTenancies,
  unitsSplit,
  upcomingVisits,
  visitCountsByDay,
  visitsThisWeek,
  visitsToday,
  type Building,
  type EarningRow,
  type Visit,
} from "./dashboard-model";

/* 11:00 UTC on 13 October 2026 is noon in Lagos. */
const NOW = new Date("2026-10-13T11:00:00Z");
const TODAY = "2026-10-13";

describe("days and months", () => {
  it("lists the last six months ending with the current one, across a year end", () => {
    expect(lastMonthKeys("2026-10-13", 6)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(lastMonthKeys("2026-02-01", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("counts instants into Lagos months, not UTC months", () => {
    const keys = ["2026-09", "2026-10"];
    /* 23:30 UTC on 30 September is already October in Lagos. */
    expect(countByMonth(["2026-09-30T23:30:00Z", "2026-09-15T10:00:00Z", "2026-10-02T10:00:00Z", "2026-03-01T10:00:00Z", null, "nope"], keys)).toEqual([1, 2]);
  });

  it("measures whole days", () => {
    expect(daysBetween("2026-10-13", "2026-10-14")).toBe(1);
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysBetween("2026-10-13", "2027-01-11")).toBe(90);
  });
});

describe("monthGrid", () => {
  it("is Monday first, squared to whole weeks, and marks today and the visit days", () => {
    const weeks = monthGrid(TODAY, new Map([["2026-10-14", 2]]));
    /* 1 October 2026 is a Thursday: three blanks before it. */
    expect(weeks[0]!.slice(0, 4).map((c) => c.date)).toEqual([null, null, null, 1]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const cells = weeks.flat();
    expect(cells.filter((c) => c.date !== null)).toHaveLength(31);
    expect(cells.find((c) => c.isToday)?.date).toBe(13);
    expect(cells.find((c) => c.day === "2026-10-14")?.count).toBe(2);
    expect(cells.find((c) => c.day === "2026-10-15")?.count).toBe(0);
  });

  it("handles a month that starts on Monday and one of 28 days", () => {
    const weeks = monthGrid("2026-06-10", new Map());
    expect(weeks[0]![0]!.date).toBe(1);
    expect(monthGrid("2026-02-10", new Map()).flat().filter((c) => c.date !== null)).toHaveLength(28);
  });
});

describe("visits", () => {
  const visits: Visit[] = [
    { id: "past", slotAt: "2026-10-12T09:00:00Z", state: "COMPLETED", listingTitle: "A" },
    { id: "earlier-today", slotAt: "2026-10-13T08:00:00Z", state: "CONFIRMED", listingTitle: "B" },
    { id: "later-today", slotAt: "2026-10-13T14:00:00Z", state: "CONFIRMED", listingTitle: "C" },
    { id: "day6", slotAt: "2026-10-19T10:00:00Z", state: "CONFIRMED", listingTitle: null },
    { id: "day7", slotAt: "2026-10-20T10:00:00Z", state: "CONFIRMED", listingTitle: null },
  ];

  it("parses real rows, flattens the listing embed, drops the rest", () => {
    const rows = parseVisits([
      { id: "a", slot_at: "2026-10-14T10:00:00Z", state: "CONFIRMED", listings: { title: "Flat" } },
      { id: "b", slot_at: "2026-10-14T10:00:00Z", state: "COMPLETED", listings: [{ title: "Other" }] },
      { id: "c", slot_at: "2026-10-14T10:00:00Z", state: "DECLINED" },
      { id: "d", slot_at: "garbage", state: "CONFIRMED" },
      { slot_at: "2026-10-14T10:00:00Z", state: "CONFIRMED" },
    ]);
    expect(rows.map((r) => [r.id, r.listingTitle])).toEqual([["a", "Flat"], ["b", "Other"]]);
    expect(parseVisits(null)).toEqual([]);
  });

  it("upcoming is confirmed and not yet past, soonest first", () => {
    expect(upcomingVisits(visits, NOW).map((v) => v.id)).toEqual(["later-today", "day6", "day7"]);
  });

  it("this week is today and the six days after it", () => {
    expect(visitsThisWeek(visits, NOW).map((v) => v.id)).toEqual(["later-today", "day6"]);
  });

  it("today is the Lagos day, so a 23:30 UTC slot belongs to tomorrow", () => {
    expect(visitsToday(visits, NOW).map((v) => v.id)).toEqual(["later-today"]);
    const late: Visit[] = [{ id: "x", slotAt: "2026-10-13T23:30:00Z", state: "CONFIRMED", listingTitle: null }];
    expect(visitsToday(late, NOW)).toEqual([]);
  });

  it("counts visits by Lagos day, completed and confirmed both", () => {
    const counts = visitCountsByDay(visits);
    expect(counts.get("2026-10-12")).toBe(1);
    expect(counts.get("2026-10-13")).toBe(2);
    expect(counts.get("2026-10-14")).toBeUndefined();
  });
});

describe("units donut", () => {
  const unit = (over: Partial<Building>): Building => ({
    listingId: "l", place: "p", bedrooms: 2, status: "PUBLISHED", letState: "vacant", tenancyEndsOn: null, rentMinor: null, rentPeriod: null, ...over,
  });

  it("splits let, live and vacant, and the rest, and they add up", () => {
    const split = unitsSplit([
      unit({ letState: "let", status: "SUSPENDED" }),
      unit({}),
      unit({ status: "APPROVED" }),
      unit({ status: "DRAFT" }),
      unit({ status: "SUBMITTED" }),
    ]);
    expect(split).toEqual({ let: 1, vacant: 2, other: 2, total: 5 });
    expect(split.let + split.vacant + split.other).toBe(split.total);
  });

  it("no units is a real zero split", () => {
    expect(unitsSplit([])).toEqual({ let: 0, vacant: 0, other: 0, total: 0 });
  });

  it("parses my_buildings rows defensively", () => {
    const rows = parseBuildings([
      { listing_id: "a", place_name: "Yaba", bedrooms: 2, status: "PUBLISHED", let_state: "let", tenancy_ends_on: "2027-01-05", achieved_rent_minor: "120000000", rent_period: "year" },
      { listing_id: "b", status: "DRAFT", tenancy_ends_on: "not a day", rent_period: "weekly" },
      { place_name: "no id" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ letState: "let", tenancyEndsOn: "2027-01-05", rentMinor: 120000000, rentPeriod: "year" });
    expect(rows[1]).toMatchObject({ letState: "vacant", tenancyEndsOn: null, rentPeriod: null });
  });
});

describe("rent", () => {
  const charge = (over: Record<string, unknown>) => ({
    id: "t1", listing_id: "l1", booking_id: "b1", move_in: "2026-01-01", rent_period: "year", rent_minor: 100_000_00, total_minor: 150_000_00, created_at: "2025-12-20T10:00:00Z", ...over,
  });
  const earn = (over: Record<string, unknown>) => ({
    kind: "earning", occurred_at: "2026-10-05T10:00:00Z", gross_minor: 150_000_00, status: "SUCCESSFUL", booking_id: "b1", ...over,
  });

  it("parses charges and works out the end of the tenancy", () => {
    const [t] = parseTenancies([charge({}), charge({ id: "bad", total_minor: null }), charge({ id: "bad2", move_in: "x" })]);
    expect(parseTenancies([charge({}), charge({ id: "bad", total_minor: null })])).toHaveLength(1);
    expect(t).toMatchObject({ id: "t1", endsOn: "2027-01-01", period: "year" });
    expect(parseTenancies([charge({ rent_period: "month", move_in: "2026-01-31" })])[0]!.endsOn).toBe("2026-02-28");
  });

  it("counts only settled payments, takes reversals off, and never goes below zero", () => {
    const rows = parseEarnings([
      earn({}),
      earn({ booking_id: "b2", status: "REFUNDED" }),
      { kind: "reversal", occurred_at: "2026-10-06T10:00:00Z", gross_minor: -50_000_00, status: "refunded", booking_id: "b1" },
      { kind: "reversal", occurred_at: "2026-10-06T10:00:00Z", gross_minor: -10_000_00, status: "refunded", booking_id: "b3" },
      { kind: "other", gross_minor: 1 },
    ]);
    expect(rows).toHaveLength(4);
    const paid = paidByBooking(rows);
    expect(paid.get("b1")).toBe(100_000_00);
    expect(paid.get("b2")).toBeUndefined();
    expect(paid.get("b3")).toBe(0);
  });

  it("a tenancy is paid only when what came in covers its total", () => {
    const [t] = parseTenancies([charge({})]);
    expect(isPaid(t!, new Map([["b1", 150_000_00]]))).toBe(true);
    expect(isPaid(t!, new Map([["b1", 149_999_99]]))).toBe(false);
    expect(isPaid(t!, new Map())).toBe(false);
    expect(isPaid({ ...t!, bookingId: null }, new Map([["b1", 1e12]]))).toBe(false);
  });

  it("rent due this month: charges opened in the Lagos month, and how much of them is paid", () => {
    const tenancies = parseTenancies([
      charge({ id: "a", booking_id: "ba", created_at: "2026-10-02T10:00:00Z", total_minor: 100 }),
      charge({ id: "b", booking_id: "bb", created_at: "2026-10-09T10:00:00Z", total_minor: 300 }),
      charge({ id: "old", booking_id: "bo", created_at: "2026-09-30T23:30:00Z", total_minor: 999 }),
      charge({ id: "nov", booking_id: "bn", created_at: "2026-09-30T22:30:00Z", total_minor: 555 }),
    ]);
    const paid = new Map([["ba", 100], ["bb", 120], ["bo", 999]]);
    /* 23:30 UTC on 30 September is October in Lagos, so "old" is this month. */
    expect(rentMonth(tenancies, paid, TODAY)).toEqual({ billedMinor: 1399, paidMinor: 1219, openedCount: 3, paidCount: 2 });
  });

  it("an empty month is a real zero", () => {
    expect(rentMonth([], new Map(), TODAY)).toEqual({ billedMinor: 0, paidMinor: 0, openedCount: 0, paidCount: 0 });
  });

  it("rent paid in by month counts settled rent payments only, in the right Lagos month", () => {
    const rows: EarningRow[] = parseEarnings([
      earn({ occurred_at: "2026-10-01T10:00:00Z", gross_minor: 10 }),
      earn({ occurred_at: "2026-09-30T23:30:00Z", gross_minor: 20 }),
      earn({ occurred_at: "2026-09-10T10:00:00Z", gross_minor: 40 }),
      earn({ occurred_at: "2026-09-11T10:00:00Z", gross_minor: 80, booking_id: "stay" }),
      earn({ occurred_at: "2026-09-12T10:00:00Z", gross_minor: 160, status: "REFUNDED" }),
      earn({ occurred_at: "2025-01-12T10:00:00Z", gross_minor: 320 }),
    ]);
    expect(rentPaidByMonth(rows, new Set(["b1"]), ["2026-08", "2026-09", "2026-10"])).toEqual([0, 40, 30]);
  });
});

describe("leases and renewals", () => {
  const t = (id: string, moveIn: string, over: Record<string, unknown> = {}) => ({
    id, listing_id: `l-${id}`, booking_id: `b-${id}`, move_in: moveIn, rent_period: "year", rent_minor: 100, total_minor: 100, created_at: "2025-01-01T10:00:00Z", ...over,
  });
  const tenancies = parseTenancies([
    t("today", "2025-10-13"),
    t("soon", "2025-11-01"),
    t("far", "2026-03-01"),
    t("ninety", "2025-10-13", { rent_period: "year", move_in: "2026-01-11" }),
    t("ended", "2025-09-01"),
    t("unpaid", "2025-10-20"),
  ]);
  const paid = new Map([["b-today", 100], ["b-soon", 100], ["b-far", 100], ["b-ninety", 100], ["b-ended", 100]]);
  const places = new Map([["l-today", "Yaba"]]);
  const running = runningTenancies(tenancies, paid, TODAY, places);

  it("running tenancies are paid and not ended, soonest first", () => {
    expect(running.map((r) => r.id)).toEqual(["today", "soon", "ninety", "far"]);
    expect(running[0]).toMatchObject({ place: "Yaba", days: 0 });
    expect(running[1]!.place).toBeNull();
  });

  it("ending today is its own card, and renewals are tomorrow to 90 days", () => {
    expect(leasesEndingToday(running).map((r) => r.id)).toEqual(["today"]);
    expect(renewalsWithin(running).map((r) => r.id)).toEqual(["soon", "ninety"]);
    expect(running.find((r) => r.id === "ninety")!.days).toBe(90);
  });

  it("the next rent due is the first running tenancy to end", () => {
    expect(nextRentDue(running)?.id).toBe("today");
    expect(nextRentDue([])).toBeNull();
  });
});

describe("agreements waiting on the owner", () => {
  it("keeps an open agreement where the owner has not confirmed the current terms", () => {
    const rows = parseAgreementsWaiting([
      { id: "a", status: "awaiting_parties", terms_version: 2, owner_confirmed_version: 1, listing_id: "l", kind: "rent", updated_at: "2026-10-02" },
      { id: "b", status: "awaiting_parties", terms_version: 2, owner_confirmed_version: 2, updated_at: "2026-10-01" },
      { id: "c", status: "awaiting_parties", terms_version: 1, owner_confirmed_version: null, updated_at: "2026-09-01" },
      { id: "d", status: "paid", terms_version: 1, owner_confirmed_version: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a"]);
  });
});

describe("ownerView", () => {
  const tenancies = parseTenancies([
    { id: "t1", listing_id: "l1", booking_id: "b1", move_in: "2025-10-13", rent_period: "year", rent_minor: 500, total_minor: 600, created_at: "2026-10-03T10:00:00Z" },
  ]);
  const earnings = parseEarnings([{ kind: "earning", occurred_at: "2026-10-04T10:00:00Z", gross_minor: 600, status: "SUCCESSFUL", booking_id: "b1" }]);

  it("builds every figure from real inputs", () => {
    const view = ownerView({ buildings: [], tenancies, earnings, visits: [], agreements: [] }, NOW);
    expect(view.units).toEqual({ let: 0, vacant: 0, other: 0, total: 0 });
    expect(view.rentMonth).toMatchObject({ billedMinor: 600, paidMinor: 600 });
    expect(view.paidThisMonthMinor).toBe(600);
    expect(view.trend!.map((p) => p.key)).toHaveLength(6);
    expect(view.leaseToday!.map((r) => r.id)).toEqual(["t1"]);
    expect(view.renewals).toEqual([]);
    expect(view.property).toBeNull();
  });

  it("leaves a figure null when its input could not be read, and never makes it zero", () => {
    const view = ownerView({ buildings: null, tenancies: null, earnings: null, visits: null, agreements: null }, NOW);
    expect(view).toMatchObject({
      units: null, rentMonth: null, trend: null, paidThisMonthMinor: null, leaseToday: null, renewals: null,
      nextDue: undefined, visitsWeek: null, agreements: null, property: null,
    });
  });

  it("rent figures need both the charges and the payments", () => {
    const view = ownerView({ buildings: null, tenancies, earnings: null, visits: null, agreements: null }, NOW);
    expect(view.rentMonth).toBeNull();
    expect(view.trend).toBeNull();
  });

  it("the property card is the unit whose tenancy ends first, linked to its running tenancy", () => {
    const buildings = parseBuildings([
      { listing_id: "l2", place_name: "Lekki", status: "PUBLISHED", let_state: "vacant" },
      { listing_id: "l1", place_name: "Yaba", status: "PUBLISHED", let_state: "let", tenancy_ends_on: "2026-10-13" },
    ]);
    const view = ownerView({ buildings, tenancies, earnings, visits: null, agreements: null }, NOW);
    expect(view.property?.listingId).toBe("l1");
    expect(view.propertyTenancyId).toBe("t1");
  });
});

describe("agent", () => {
  const enq = (listing: string | null, at: string) => ({ listing_id: listing, created_at: at });

  it("picks the live listing with the most enquiries in 30 days, the first on a tie, the first live with none", () => {
    const rows = parseEnquiries([
      enq("a", "2026-10-10T10:00:00Z"),
      enq("b", "2026-10-11T10:00:00Z"),
      enq("b", "2026-10-12T10:00:00Z"),
      enq("c", "2026-10-12T10:00:00Z"),
      enq("c", "2026-10-12T11:00:00Z"),
      enq("c", "2026-08-01T10:00:00Z"),
      enq(null, "2026-10-12T10:00:00Z"),
    ]);
    expect(pickFeatured(["a", "b", "c"], rows, NOW)).toEqual({ listingId: "b", enquiries: 2 });
    expect(pickFeatured(["z", "a"], rows, NOW)).toEqual({ listingId: "a", enquiries: 1 });
    expect(pickFeatured(["z", "y"], rows, NOW)).toEqual({ listingId: "z", enquiries: 0 });
    expect(pickFeatured([], rows, NOW)).toBeNull();
  });

  it("counts a 30 day window including today, in Lagos", () => {
    const rows = parseEnquiries([enq("a", "2026-09-14T10:00:00Z"), enq("a", "2026-09-13T10:00:00Z")]);
    expect(enquiriesInLastDays(rows, NOW, 30)).toHaveLength(1);
  });

  it("bins enquiries and visits into six months; null stays null", () => {
    const enquiries = parseEnquiries([enq("a", "2026-10-01T10:00:00Z"), enq("a", "2026-05-02T10:00:00Z"), enq("a", "2026-04-02T10:00:00Z")]);
    const visits = parseVisits([{ id: "v", slot_at: "2026-10-20T10:00:00Z", state: "CONFIRMED" }]);
    const m = agentMonthly(enquiries, visits, TODAY);
    expect(m.enquiries!.map((b) => b.count)).toEqual([1, 0, 0, 0, 0, 1]);
    expect(m.visits!.map((b) => b.count)).toEqual([0, 0, 0, 0, 0, 1]);
    expect(agentMonthly(null, null, TODAY)).toEqual({ enquiries: null, visits: null });
  });

  it("a series with nothing in the window is blank, an unread one too", () => {
    expect(isBlank(agentMonthly([], [], TODAY).enquiries)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(agentMonthly(parseEnquiries([enq("a", "2026-10-01T10:00:00Z")]), [], TODAY).enquiries)).toBe(false);
  });

  it("reminders are follow-ups, then visits today, then listings to confirm; empty lines are not drawn", () => {
    const r = reminders({ followupsDue: 3, followupsOverdue: 1, visitsToday: 2, expiring: 4 });
    expect(r.items.map((i) => [i.kind, i.count, i.href])).toEqual([
      ["followup", 3, "/agent/messages?filter=due"],
      ["visit", 2, "/agent/inspections"],
      ["expiring", 4, "/agent/listings"],
    ]);
    expect(r.items[0]!.overdue).toBe(1);
    expect(reminders({ followupsDue: 0, visitsToday: 0, expiring: 0 })).toEqual({ items: [], unread: [] });
  });

  it("a reminder source that could not be read is reported unread, not as nothing", () => {
    const r = reminders({ followupsDue: null, visitsToday: 1, expiring: null });
    expect(r.unread).toEqual(["followup", "expiring"]);
    expect(r.items.map((i) => i.kind)).toEqual(["visit"]);
  });

  it("contacts are the newest thread of each listing counterpart, at most five", () => {
    const thread = (id: string, who: string | undefined, at: string, kind?: string) => ({
      id, counterpartName: who ?? id, counterpartId: who, listingTitle: null, lastAt: at, contextKind: kind,
    });
    const list = recentContacts([
      thread("1", "ada", "2026-10-01T10:00:00Z"),
      thread("2", "ada", "2026-10-05T10:00:00Z"),
      thread("3", "bola", "2026-10-03T10:00:00Z"),
      thread("4", "chi", "2026-10-04T10:00:00Z", "booking"),
      thread("5", undefined, "2026-10-02T10:00:00Z"),
    ]);
    expect(list.map((c) => c.id)).toEqual(["2", "3", "5"]);
    expect(recentContacts([])).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => thread(`t${i}`, `p${i}`, `2026-10-0${i + 1}T10:00:00Z`));
    expect(recentContacts(many)).toHaveLength(5);
  });
});
