import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { whereDoIGo } = await import("./wayfinding");
const { DESK_MAP, canOpenDesk, deskLink, findDesks } = await import("../desk-map");
const { isOfferable } = await import("./registry");
const { offerableLinks } = await import("./links");
import type { CopilotViewer } from "./types";

/**
 * WHERE DO I GO. The answer is the console's own menu, narrowed to the desks
 * this person can open, with each one offered as a destination.
 */
const viewer = (over: Partial<CopilotViewer> = {}): CopilotViewer => ({
  userId: "u1",
  firstName: "Ada",
  isAdmin: false,
  isSuperAdmin: false,
  scopes: ["support"],
  position: "support_agent",
  ...over,
});
const ctx = (v: CopilotViewer) => ({ viewer: v, now: Date.parse("2026-11-16T09:00:00Z") });
const ok = async (v: CopilotViewer, doing?: string) => {
  const out = await whereDoIGo.handler(doing === undefined ? {} : { doing }, ctx(v));
  if (!out.ok) throw new Error("the map should always answer");
  return { data: out.data as Record<string, unknown>, links: out.links ?? [] };
};

describe("the desk map", () => {
  it("is every desk the rail lists, with the rail's own name, address and group", () => {
    expect(DESK_MAP.length).toBeGreaterThan(60);
    const listings = DESK_MAP.find((d) => d.key === "listings");
    expect(listings).toMatchObject({ label: "Listings", href: "/admin/listings", group: "Departments" });
    expect(listings!.purpose.length).toBeGreaterThan(20);
    for (const desk of DESK_MAP) expect(desk.href.startsWith("/"), desk.key).toBe(true);
  });

  it("opens a desk to the right people and nobody else", () => {
    const support = DESK_MAP.find((d) => d.key === "tickets")!;
    const control = DESK_MAP.find((d) => d.key === "control")!;
    const audit = DESK_MAP.find((d) => d.key === "audit")!;
    expect(canOpenDesk(support, viewer())).toBe(true);
    expect(canOpenDesk(control, viewer())).toBe(false);
    expect(canOpenDesk(control, viewer({ isAdmin: true }))).toBe(false);
    expect(canOpenDesk(control, viewer({ isAdmin: true, isSuperAdmin: true }))).toBe(true);
    expect(canOpenDesk(audit, viewer())).toBe(false);
    expect(canOpenDesk(audit, viewer({ isAdmin: true }))).toBe(true);
  });

  it("never offers the members' help centre as a console destination", () => {
    const help = DESK_MAP.find((d) => d.href === "/settings/help");
    expect(help).toBeDefined();
    expect(deskLink(help!)).toBeNull();
  });

  it("finds the desk from the words a person would use", () => {
    const admin = viewer({ isAdmin: true, isSuperAdmin: true });
    expect(findDesks("a member cannot sign in", admin)[0]!.href).toBe("/admin/account-recovery");
    expect(findDesks("approve a listing", admin)[0]!.href).toBe("/admin/listings");
    expect(findDesks("what sql still has to run", admin)[0]!.href).toBe("/admin/control");
    expect(findDesks("fake id", admin)[0]!.href).toBe("/admin/kyc");
    expect(findDesks("who holds access", admin)[0]!.href).toBe("/admin/staff");
  });
});

describe("where_do_i_go", () => {
  it("is offered to every member of staff", () => {
    expect(isOfferable(whereDoIGo, viewer())).toBe(true);
    expect(isOfferable(whereDoIGo, viewer({ scopes: ["content"], position: "content_manager" }))).toBe(true);
  });

  it("answers with the matching desk and offers it as a destination", async () => {
    const { data, links } = await ok(viewer(), "a member wrote in about a refund");
    const matched = data.matched as { desk: string; where: string; forWhat: string }[];
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0]!.where).toBe("/admin/support");
    expect(matched[0]!.forWhat.length).toBeGreaterThan(20);
    expect(links.some((l) => l.href === "/admin/support")).toBe(true);
  });

  it("never names a desk this person cannot open, in the match or in the list", async () => {
    const support = viewer();
    const asked = await ok(support, "what sql still has to run");
    const text = JSON.stringify(asked);
    expect(text).not.toContain("/admin/control");
    expect(text).not.toContain("/admin/staff");
    const everything = await ok(support);
    const text2 = JSON.stringify(everything);
    expect(text2).not.toContain("/admin/control");
    expect(text2).not.toContain("/admin/money");
    expect(text2).toContain("/admin/support");
  });

  it("lists what the person can open when no job is named", async () => {
    const { data } = await ok(viewer({ isAdmin: true, isSuperAdmin: true }));
    expect(data.matched).toBeNull();
    expect((data.deskCount as number) > 60).toBe(true);
  });

  it("says plainly when nothing matches, and offers no invented address", async () => {
    const { data, links } = await ok(viewer(), "zzzqqq nothing like this exists");
    expect(data.matched).toEqual([]);
    expect(String(data.note)).toContain("No desk");
    for (const link of links) expect(link.href.startsWith("/admin")).toBe(true);
  });

  it("hands back only links the filter will keep for that viewer", async () => {
    const v = viewer();
    const { links } = await ok(v, "where do I find a member");
    expect(offerableLinks(links, v)).toHaveLength(links.length);
  });
});
