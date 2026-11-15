import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isLinkOfferable, offerableLinks } = await import("./links");
const { defineTool } = await import("./types");
const { runCopilotTool } = await import("./registry");
const { z } = await import("zod");
import type { CopilotViewer, ToolLink } from "./types";

/**
 * THE LINK FILTER. A viewer never receives a destination they cannot open:
 * the drop happens on the server, before the model is given the tool result,
 * so the model cannot offer it and the renderer has nothing to draw.
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

const LINKS: ToolLink[] = [
  { label: "Open Support", href: "/admin/support" },
  { label: "Open the Money desk", href: "/admin/money", scope: "finance" },
  { label: "Open the Staff desk", href: "/admin/staff", requires: "super_admin" },
  { label: "Open the Audit log", href: "/admin/audit", requires: "admin" },
  { label: "Open the COO desk", href: "/admin/overview", requires: "coo" },
];

describe("one link against one viewer", () => {
  it("offers a page with no access area to any member of staff", () => {
    expect(isLinkOfferable({ label: "Open Support", href: "/admin/support" }, viewer())).toBe(true);
  });

  it("refuses a page whose access area the viewer does not hold", () => {
    expect(isLinkOfferable({ label: "Money", href: "/admin/money", scope: "finance" }, viewer())).toBe(false);
    expect(isLinkOfferable({ label: "Money", href: "/admin/money", scope: "finance" }, viewer({ scopes: ["finance"] }))).toBe(true);
  });

  it("refuses an address that is not a console page, and an empty label", () => {
    expect(isLinkOfferable({ label: "Out", href: "https://evil.example" }, viewer({ isAdmin: true }))).toBe(false);
    expect(isLinkOfferable({ label: "Help", href: "/settings/help" }, viewer({ isAdmin: true }))).toBe(false);
    expect(isLinkOfferable({ label: "  ", href: "/admin/support" }, viewer())).toBe(false);
  });

  it("keeps a super admin page from an admin, and an admin page from a staff member", () => {
    const admin = viewer({ isAdmin: true, scopes: [] });
    expect(isLinkOfferable({ label: "Staff", href: "/admin/staff", requires: "super_admin" }, admin)).toBe(false);
    expect(isLinkOfferable({ label: "Staff", href: "/admin/staff", requires: "super_admin" }, viewer({ isAdmin: true, isSuperAdmin: true }))).toBe(true);
    expect(isLinkOfferable({ label: "Audit", href: "/admin/audit", requires: "admin" }, viewer())).toBe(false);
    expect(isLinkOfferable({ label: "Audit", href: "/admin/audit", requires: "admin" }, admin)).toBe(true);
  });

  it("opens the COO desk only to the whole COO bundle or a super admin", () => {
    const coo = { label: "COO", href: "/admin/overview", requires: "coo" } as const;
    expect(isLinkOfferable(coo, viewer({ scopes: ["operations"] }))).toBe(false);
    expect(isLinkOfferable(coo, viewer({ scopes: ["listing_approval", "moderation", "support", "agreements", "operations"], position: "coo" }))).toBe(true);
    expect(isLinkOfferable(coo, viewer({ isSuperAdmin: true }))).toBe(true);
  });
});

describe("the list a viewer is given", () => {
  it("gives a support agent only the pages they can open", () => {
    expect(offerableLinks(LINKS, viewer()).map((l) => l.href)).toEqual(["/admin/support"]);
  });

  it("gives a super admin all of them", () => {
    const all = offerableLinks(LINKS, viewer({ isAdmin: true, isSuperAdmin: true, scopes: ["finance"] }));
    expect(all.map((l) => l.href)).toEqual(LINKS.map((l) => l.href));
  });

  it("keeps one entry per address, in the order the tool gave them, under the cap", () => {
    const repeated: ToolLink[] = [
      { label: "First", href: "/admin/support" },
      { label: "Again", href: "/admin/support" },
      ...Array.from({ length: 9 }, (_, i) => ({ label: `D${i}`, href: `/admin/d${i}` })),
    ];
    const out = offerableLinks(repeated, viewer());
    expect(out[0]).toEqual({ label: "First", href: "/admin/support" });
    expect(new Set(out.map((l) => l.href)).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it("gives nothing back for a tool that offered nothing", () => {
    expect(offerableLinks(undefined, viewer())).toEqual([]);
    expect(offerableLinks([], viewer())).toEqual([]);
  });
});

describe("the registry drops a forbidden destination before the model sees it", () => {
  const leaky = defineTool({
    name: "get_desk_note",
    description: "A read that offers every desk, whether or not the viewer holds it.",
    kind: "read",
    scopes: ["support"],
    status: "Reading",
    input: z.object({}),
    handler: async () => ({ ok: true, data: { note: "ok" }, links: LINKS }),
  });

  it("passes on only the pages the viewer holds, and says so in the result", async () => {
    const v = viewer();
    const run = await runCopilotTool("get_desk_note", {}, ctx(v), [leaky]);
    expect(run.ok).toBe(true);
    expect(run.destinations).toEqual([{ label: "Open Support", href: "/admin/support" }]);
    expect(run.content).toContain("/admin/support");
    for (const hidden of ["/admin/money", "/admin/staff", "/admin/audit", "/admin/overview"]) {
      expect(run.content, hidden).not.toContain(hidden);
    }
    expect(run.content).toContain("takeMeThere");
    expect(run.content).toContain("[[go:");
  });

  it("passes on every page for a super admin and keeps the tool's own fields", async () => {
    const run = await runCopilotTool("get_desk_note", {}, ctx(viewer({ isAdmin: true, isSuperAdmin: true, scopes: ["finance"] })), [leaky]);
    expect(run.destinations).toHaveLength(5);
    expect(run.content).toContain("note");
  });

  it("says nothing about destinations when a tool offers none", async () => {
    const quiet = defineTool({ name: "get_quiet", description: "A read with no destinations at all.", kind: "read", scopes: ["support"], status: "Reading", input: z.object({}), handler: async () => ({ ok: true, data: { note: "ok" } }) });
    const run = await runCopilotTool("get_quiet", {}, ctx(viewer()), [quiet]);
    expect(run.destinations).toEqual([]);
    expect(run.content).not.toContain("takeMeThere");
  });
});
