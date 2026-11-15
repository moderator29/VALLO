import { describe, expect, it } from "vitest";
import { renderClient } from "@/lib/testing/render-client";

/**
 * THE REAL HANDBOOKS IN THE KNOWLEDGE BASE.
 *
 * The position handbooks are written as components, so they are bundled here
 * the way the manual's own chapters are (`manual-search.test.ts`) rather than
 * imported into the unit project, whose React alias has no JSX runtime. This
 * holds the wiring to the real text: every position's handbook is indexed,
 * a person is shown their own, and their own ranks first for them.
 */
const run = (body: string) =>
  renderClient(`
    import { positionHandbookPassages, positionHandbookRoute, POSITION_HANDBOOK_INDEX } from "@/lib/admin/position-handbook";
    import { STAFF_POSITIONS } from "@/lib/admin/staff-positions";
    import { handbookSections } from "@/lib/admin/copilot/tools/handbook-source";
    import { buildPassages, searchPassages, visiblePassages } from "@/lib/admin/copilot/tools/manual-search";
    const source = { positionHandbookPassages, positionHandbookRoute };
    const handbooks = STAFF_POSITIONS.map((position) => ({
      position,
      title: position,
      link: positionHandbookRoute(position),
      sections: handbookSections(source, position),
    })).filter((h) => h.sections.length > 0);
    const passages = buildPassages({}, { handbooks });
    ${body}
  `);

describe("the position handbooks, as the copilot indexes them", () => {
  it("indexes every position's handbook, each section with its own anchor", async () => {
    const r = JSON.parse(
      await run(`export const html = () => JSON.stringify({
        positions: handbooks.length,
        allPositions: STAFF_POSITIONS.length,
        sections: handbooks.reduce((n, h) => n + h.sections.length, 0),
        indexed: POSITION_HANDBOOK_INDEX.length,
        links: [...new Set(passages.filter((p) => p.source === "handbook").map((p) => p.link.split("#")[0]))].slice(0, 3),
        anchored: passages.filter((p) => p.source === "handbook").every((p) => p.link.includes("#")),
      });`),
    ) as { positions: number; allPositions: number; sections: number; indexed: number; links: string[]; anchored: boolean };
    expect(r.positions).toBe(r.allPositions);
    expect(r.sections).toBeGreaterThan(r.allPositions);
    expect(r.indexed).toBe(r.allPositions);
    expect(r.links[0]).toMatch(/^\/admin\/handbook\/position\//);
    expect(r.anchored).toBe(true);
  }, 90_000);

  it("shows a person their own handbook and nobody else's, and ranks it first for them", async () => {
    const r = JSON.parse(
      await run(`
        const agent = { isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: "support_agent" };
        const mine = visiblePassages(passages, agent);
        const hits = searchPassages("what am I responsible for", mine, 5, { position: "support_agent" });
        export const html = () => JSON.stringify({
          positionsVisible: [...new Set(mine.filter((p) => p.source === "handbook").map((p) => p.position))],
          top: hits[0] ? { source: hits[0].source, position: hits[0].position, link: hits[0].link } : null,
          adminSees: [...new Set(visiblePassages(passages, { isAdmin: true, isSuperAdmin: false, scopes: [], position: null }).filter((p) => p.source === "handbook").map((p) => p.position))].length,
        });`),
    ) as { positionsVisible: string[]; top: { source: string; position: string; link: string } | null; adminSees: number };
    expect(r.positionsVisible).toEqual(["support_agent"]);
    expect(r.top).toMatchObject({ source: "handbook", position: "support_agent" });
    expect(r.top!.link).toContain("/admin/handbook/position/support_agent");
    expect(r.adminSees).toBeGreaterThan(1);
  }, 90_000);
});
