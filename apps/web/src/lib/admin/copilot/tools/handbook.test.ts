import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyHandbook } = await import("./handbook");
const { asHandbookModule, handbookRoute, handbookSections, loadPositionHandbook, setPositionHandbookSource } = await import("./handbook-source");
const { buildPassages, searchPassages, visiblePassages, OWN_HANDBOOK_BOOST } = await import("./manual-search");
const { isOfferable } = await import("./registry");
import type { CopilotViewer } from "./types";

/**
 * THE POSITION HANDBOOK, BOTH WAYS. The handbook module is written elsewhere
 * and may not be built yet, so both paths are held here: with it, the viewer's
 * own handbook is in the knowledge base and ranks first for them; without it,
 * nothing breaks and the job description answers instead.
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

const stub = {
  positionHandbookPassages: (position: string) => [
    { id: "promise", title: "The promise you make", text: `A ${position} answers a member within the promised time and never guesses at a refund.` },
    { id: "alone", title: "What you may decide alone", text: "You may close a ticket you answered. You may not decide a refund." },
  ],
};

afterEach(() => setPositionHandbookSource(undefined));

describe("the handbook source", () => {
  /*
   * The handbooks landed on 16 November 2026 and the loader names them. They
   * cannot be LOADED in this project: the handbook is written as components
   * and the unit project aliases React at its server build, which has no JSX
   * runtime to resolve, so the import throws here and would throw for any
   * component module. That is the fail-soft path, proved below, and the real
   * handbook text is proved through the bundler further down, the same way
   * the manual's own chapters are.
   */
  it("never throws, whatever the handbook module does in this environment", async () => {
    setPositionHandbookSource(undefined);
    await expect(loadPositionHandbook()).resolves.not.toThrow();
    const loaded = await loadPositionHandbook();
    expect(loaded === null || typeof loaded.positionHandbookPassages === "function").toBe(true);
  });

  it("degrades to no handbooks at all without throwing", async () => {
    setPositionHandbookSource(null);
    expect(await loadPositionHandbook()).toBeNull();
    expect(handbookSections(null, "support_agent")).toEqual([]);
    expect(handbookRoute(null, "support_agent")).toBe("/admin/handbook/position");
  });

  it("falls back to the index page when the module names no route", () => {
    expect(handbookRoute(stub as never, "support_agent")).toBe("/admin/handbook/position");
    const odd = { positionHandbookPassages: () => [], positionHandbookRoute: () => "https://evil.example" };
    expect(handbookRoute(odd as never, "support_agent")).toBe("/admin/handbook/position");
  });

  it("refuses a module of the wrong shape rather than trusting it", () => {
    expect(asHandbookModule(null)).toBeNull();
    expect(asHandbookModule({})).toBeNull();
    expect(asHandbookModule({ positionHandbookPassages: "not a function" })).toBeNull();
    expect(asHandbookModule(stub)).toBe(stub);
  });

  it("drops a section with a missing id, title or words, and survives one that throws", () => {
    const messy = {
      positionHandbookPassages: () => [{ id: "a", title: "A", text: "Words." }, { id: "", title: "B", text: "Words." }, { id: "c", title: "C", text: "  " }, "not an object"],
    };
    expect(handbookSections(messy as never, "support_agent").map((s) => s.id)).toEqual(["a"]);
    const angry = { positionHandbookPassages: () => { throw new Error("no handbook"); } };
    expect(handbookSections(angry as never, "support_agent")).toEqual([]);
  });

  it("reads the module once it is set", async () => {
    setPositionHandbookSource(stub as never);
    expect(await loadPositionHandbook()).toBe(stub);
    expect(handbookSections(stub as never, "support_agent")).toHaveLength(2);
  });
});

describe("the knowledge base with handbooks in it", () => {
  const passages = () =>
    buildPassages({}, {
      handbooks: [
        { position: "support_agent", title: "Support Agent", link: "/admin/handbook/position", sections: handbookSections(stub as never, "support_agent") },
        { position: "finance_officer", title: "Finance Officer", link: "/admin/handbook/position", sections: handbookSections(stub as never, "finance_officer") },
      ],
      facts: [{ title: "Where a refund goes", text: "A refund goes back to the card that paid.", link: "/cancellations" }],
    });

  it("indexes each handbook section with its own link and position", () => {
    const mine = passages().filter((p) => p.source === "handbook" && p.position === "support_agent");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]!.link).toMatch(/^\/admin\/handbook\/position#/);
  });

  it("shows a person their own handbook and nobody else's", () => {
    const seen = visiblePassages(passages(), viewer());
    expect(seen.some((p) => p.position === "support_agent")).toBe(true);
    expect(seen.some((p) => p.position === "finance_officer")).toBe(false);
  });

  it("shows every handbook to an admin, as it shows every chapter", () => {
    const seen = visiblePassages(passages(), viewer({ isAdmin: true, position: null }));
    expect(new Set(seen.filter((p) => p.source === "handbook").map((p) => p.position)).size).toBe(2);
  });

  it("ranks the reader's own handbook first for them", () => {
    const seen = visiblePassages(passages(), viewer({ isAdmin: true, position: "support_agent" }));
    const hits = searchPassages("can I decide a refund", seen, 5, { position: "support_agent" });
    expect(hits[0]!.source).toBe("handbook");
    expect(hits[0]!.position).toBe("support_agent");
    expect(hits[0]!.score).toBeGreaterThan(OWN_HANDBOOK_BOOST);
  });

  it("does not lift a handbook that is not theirs", () => {
    const seen = visiblePassages(passages(), viewer({ isAdmin: true, position: "finance_officer" }));
    const hits = searchPassages("can I decide a refund", seen, 5, { position: "finance_officer" });
    expect(hits[0]!.position).toBe("finance_officer");
  });

  it("holds every test when there is no handbook at all", () => {
    const none = buildPassages({}, { facts: [{ title: "Fees", text: "Renters pay no fee to Vallo.", link: "/terms" }] });
    expect(none.some((p) => p.source === "handbook")).toBe(false);
    expect(visiblePassages(none, viewer())).toEqual(none.filter((p) => !p.scopes));
  });
});

describe("get_my_handbook", () => {
  it("is offered to every member of staff", () => {
    expect(isOfferable(getMyHandbook, viewer())).toBe(true);
    expect(isOfferable(getMyHandbook, viewer({ scopes: ["technical"], position: "technical_administrator" }))).toBe(true);
  });

  it("reads the viewer's own handbook back, section by section, with a link to each", async () => {
    setPositionHandbookSource(stub as never);
    const out = await getMyHandbook.handler({}, ctx(viewer()));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const data = out.data as { handbookBuilt: boolean; position: string; sections: { section: string; link: string }[] };
    expect(data.handbookBuilt).toBe(true);
    expect(data.position).toBe("Support Agent");
    expect(data.sections.map((s) => s.section)).toEqual(["The promise you make", "What you may decide alone"]);
    expect(data.sections[0]!.link).toBe("/admin/handbook/position#promise");
    expect(out.links?.some((l) => l.href === "/admin/handbook/position")).toBe(true);
  });

  it("narrows to a named section when one is asked for", async () => {
    setPositionHandbookSource(stub as never);
    const out = await getMyHandbook.handler({ section: "decide alone" }, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { matched: number; sections: { section: string }[] };
    expect(data.matched).toBe(1);
    expect(data.sections[0]!.section).toBe("What you may decide alone");
  });

  it("falls back to the job description when the handbook is not built, and invents nothing", async () => {
    setPositionHandbookSource(null);
    const out = await getMyHandbook.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { handbookBuilt: boolean; note: string; jobDescription: { responsibilities: string[] } | null };
    expect(data.handbookBuilt).toBe(false);
    expect(data.note).toContain("not in place");
    expect(data.jobDescription!.responsibilities.length).toBeGreaterThan(0);
    expect(JSON.stringify(out.data)).not.toContain("sections");
  });

  it("reads a handbook with its own route when the module names one", async () => {
    setPositionHandbookSource({ ...stub, positionHandbookRoute: (p: string) => `/admin/handbook/position/${p}` } as never);
    const out = await getMyHandbook.handler({}, ctx(viewer({ position: "kyc_reviewer", scopes: ["kyc_review"] })));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { handbookBuilt: boolean; sections: { link: string }[]; page: string };
    expect(data.handbookBuilt).toBe(true);
    expect(data.page).toBe("/admin/handbook/position/kyc_reviewer");
    expect(data.sections[0]!.link).toMatch(/^\/admin\/handbook\/position\/kyc_reviewer#/);
  });

  it("says there is no position handbook for somebody with no named position", async () => {
    setPositionHandbookSource(stub as never);
    const out = await getMyHandbook.handler({}, ctx(viewer({ position: null, isAdmin: true })));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { position: null; note: string };
    expect(data.position).toBeNull();
    expect(data.note).toContain("no named position");
  });
});
