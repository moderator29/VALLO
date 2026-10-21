import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getDictionary } from "@vallo/i18n";
import {
  ownerView,
  reminders,
  type OwnerInputs,
} from "@/lib/workspace/dashboard-model";
import { agentFixture, ownerFixture } from "@/app/(dev)/preview/workspace-dash/fixtures";
import { donutArcs } from "./UnitsDonut";
import { AgentBand, AgentBody, OwnerBand, OwnerBody, type AgentDash } from "./Sections";

const t = getDictionary("en");
const NOW = new Date("2026-10-13T11:00:00Z");
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("donutArcs", () => {
  it("shares the ring out in proportion and the arcs add up to the whole ring", () => {
    const arcs = donutArcs({ let: 3, vacant: 1, other: 1 }, 100);
    expect(arcs.map((a) => a.key)).toEqual(["let", "vacant", "other"]);
    expect(arcs.map((a) => Math.round(a.length))).toEqual([60, 20, 20]);
    expect(arcs.reduce((sum, a) => sum + a.length, 0)).toBeCloseTo(100);
    expect(arcs[1]!.offset).toBeCloseTo(60);
  });
  it("a part with none has no arc, and nothing at all is no ring", () => {
    expect(donutArcs({ let: 2, vacant: 0, other: 0 }, 100).map((a) => a.key)).toEqual(["let"]);
    expect(donutArcs({ let: 0, vacant: 0, other: 0 })).toEqual([]);
  });
});

describe("owner dashboard cards", () => {
  const { view, places } = ownerFixture(NOW, false);
  const out = html(<OwnerBody view={view} places={places} t={t} locale="en" />);

  it("draws real numbers: the lease ending today, rent paid, the units ring, the next rent due", () => {
    expect(out).toContain("Lease ends today");
    expect(out).toContain("Yaba, 2 bedroom flat");
    expect(out).toContain('data-testid="wsd-rent-paid"');
    expect(out).toContain("wsd-donut__arc--let");
    expect(out).toContain("Next rent due");
    expect(out).toContain("Agreements waiting on you");
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("undefined");
  });

  it("the band has the four tiles, and a tile whose read failed is left out", () => {
    expect(html(<OwnerBand view={view} t={t} locale="en" tag="en-NG" />)).toContain("Waiting on you");
    const unread: OwnerInputs = { buildings: null, tenancies: null, earnings: null, visits: null, agreements: null };
    const band = html(<OwnerBand view={ownerView(unread, NOW)} t={t} locale="en" tag="en-NG" />);
    expect(band).not.toContain("Rent paid this month");
    expect(band).not.toContain("Waiting on you");
  });

  it("an owner with nothing yet gets empty states, no ring and no chart", () => {
    const empty = ownerFixture(NOW, true);
    const page = html(<OwnerBody view={empty.view} places={empty.places} t={t} locale="en" />);
    expect(page).toContain("No rental units yet");
    expect(page).toContain("No rent charge was opened this month.");
    expect(page).toContain("No rent is due soon");
    expect(page).not.toContain("wsd-donut__arc");
    expect(page).not.toContain("nf-viz-bar");
    expect(page).not.toContain("wsd-lease");
  });

  it("every card says so when its read failed, and none draws a zero in its place", () => {
    const unread: OwnerInputs = { buildings: null, tenancies: null, earnings: null, visits: null, agreements: null };
    const page = html(<OwnerBody view={ownerView(unread, NOW)} places={new Map()} t={t} locale="en" />);
    expect(page.match(/This could not be loaded/g)?.length).toBeGreaterThanOrEqual(5);
    expect(page).not.toContain("wsd-donut__arc");
    expect(page).not.toContain("wsd-rent-paid");
  });
});

describe("agent dashboard cards", () => {
  const dash = agentFixture(NOW, false);

  it("draws the four tiles with real counts", () => {
    const band = html(<AgentBand dash={dash} now={NOW} t={t} tag="en-NG" />);
    for (const label of ["New enquiries", "Viewings booked", "Listings live", "Deals closed"]) expect(band).toContain(label);
  });

  it("draws reminders with a door each, the calendar with visit dots, contacts with message and call, and the chart", () => {
    const body = html(<AgentBody dash={dash} today="2026-10-13" t={t} locale="en" />);
    expect(body).toContain("3 follow-ups due");
    expect(body).toContain("1 overdue");
    expect(body).toContain("1 visit today");
    expect(body).toContain("2 listings to confirm as still available");
    expect(body).toContain('href="/agent/messages?filter=due"');
    expect(body).toContain("wsd-cal__dot");
    expect(body).toContain('href="tel:+2348012345678"');
    expect(body).toContain('href="/agent/messages/t1"');
    expect(body).toContain("nf-viz-bar");
    expect(body).not.toContain("NaN");
  });

  it("only a contact with an allowed number gets a call button", () => {
    const body = html(<AgentBody dash={dash} today="2026-10-13" t={t} locale="en" />);
    expect(body.match(/href="tel:/g)?.length).toBe(2);
  });

  it("an agent with nothing yet gets empty states, no bars and a calendar with no dots", () => {
    const empty = agentFixture(NOW, true);
    const body = html(<AgentBody dash={empty} today="2026-10-13" t={t} locale="en" />);
    expect(body).toContain("Nothing needs you today");
    expect(body).toContain("No live listing yet");
    expect(body).toContain("No enquiries yet");
    expect(body).toContain("Nothing recorded in the last 6 months yet.");
    expect(body).not.toContain("nf-viz-bar");
    expect(body).not.toContain("wsd-cal__dot");
  });

  it("a failed read is said, never drawn as a zero", () => {
    const failed: AgentDash = {
      enquiries: null,
      visits: null,
      closedDeals: null,
      liveListings: 2,
      featured: null,
      reminders: reminders({ followupsDue: null, visitsToday: null, expiring: 1 }),
      threads: null,
      callNumbers: new Map(),
    };
    const band = html(<AgentBand dash={failed} now={NOW} t={t} tag="en-NG" />);
    expect(band).not.toContain("New enquiries");
    expect(band).not.toContain("Deals closed");
    expect(band).toContain("Listings live");
    const body = html(<AgentBody dash={failed} today="2026-10-13" t={t} locale="en" />);
    expect(body).toContain("Some reminders could not be loaded.");
    expect(body.match(/This could not be loaded/g)?.length).toBeGreaterThanOrEqual(3);
    expect(body).not.toContain("nf-viz-bar");
  });
});

describe("the three other languages", () => {
  it("each has the workspace namespace in its own words, never English", () => {
    const en = getDictionary("en").workspaceDash;
    for (const locale of ["yo", "ig", "ha"] as const) {
      const w = getDictionary(locale).workspaceDash;
      expect(w.agent.reminders.title).not.toBe(en.agent.reminders.title);
      expect(w.owner.units.title).not.toBe(en.owner.units.title);
      expect(w.followup.dueChip).not.toBe(en.followup.dueChip);
    }
  });
});
