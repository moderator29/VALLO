import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/app/admin/_components/nav";
import { MANUAL_CHAPTERS } from "@/lib/admin/manual/chapters";
import { DESK_NOTES, DESK_MAP, RAIL_HREFS } from "./desk-map";
import { PLAYBOOKS } from "./tools/playbooks";

/**
 * THE COPILOT KEEPS UP WITH THE CONSOLE (16 November 2026).
 *
 * The copilot's knowledge went stale the old way: a desk was added to the rail
 * and the assistant on every other desk had never heard of it, so "where do I
 * do X" answered with the nearest thing it knew. These hold the knowledge base
 * to the rail, in both directions, and name exactly what to add when they
 * fail.
 *
 * A desk is COVERED when the copilot can reach it: a note in the desk map
 * (which `where_do_i_go` answers from and every tool may offer as a
 * destination), a playbook whose steps end on it, or a chapter of the staff
 * manual that is the desk itself.
 */

const navHrefs = [...new Set(ADMIN_NAV.filter((item) => item.href.startsWith("/admin")).map((item) => item.href))];
const manualHrefs = MANUAL_CHAPTERS.map((chapter) => `/admin/manual/${chapter.slug}`);

function coverageOf(href: string): string[] {
  const from: string[] = [];
  if (DESK_MAP.some((desk) => desk.href === href)) from.push("the desk map");
  if (PLAYBOOKS.some((playbook) => playbook.deskHref === href)) from.push("a playbook");
  if (manualHrefs.includes(href) || href === "/admin/manual") from.push("a manual chapter");
  return from;
}

describe("every desk on the rail is something the copilot knows", () => {
  it("has a note in the desk map for every destination the rail lists", () => {
    const missing = ADMIN_NAV.filter((item) => !DESK_NOTES[item.key]).map((item) => `${item.key} (${item.href}, "${item.label}")`);
    expect(
      missing,
      missing.length === 0
        ? ""
        : [
            "The console map has desks the copilot has never heard of, so it cannot answer 'where do I do this' for them.",
            "ADD each of these to DESK_NOTES in src/lib/admin/copilot/desk-map.ts, keyed by the rail key, as:",
            ...missing.map((desk) => `  "${desk.split(" ")[0]}": { purpose: "<one plain sentence: what this desk is for>", scopes: [<the access areas that open it, or nothing for every staff member>], words: ["<what a person would call it>"] },`),
            "A desk only an admin or the super admin opens takes door: \"admin\" or door: \"super_admin\".",
          ].join("\n"),
    ).toEqual([]);
  });

  it("is reachable through a tool, a playbook or a manual passage", () => {
    const uncovered = navHrefs.filter((href) => coverageOf(href).length === 0);
    expect(
      uncovered,
      uncovered.length === 0
        ? ""
        : [
            "These admin pages are on the rail and the copilot cannot reach them at all:",
            ...uncovered.map((href) => `  ${href}`),
            "ADD each one to DESK_NOTES in src/lib/admin/copilot/desk-map.ts (purpose, scopes, words), which is what where_do_i_go answers from,",
            "or give it a playbook in src/lib/admin/copilot/tools/playbooks.ts when it has a step by step procedure.",
          ].join("\n"),
    ).toEqual([]);
  });

  it("says what each desk is for in plain words, with the words a person would search for", () => {
    const thin = DESK_MAP.filter((desk) => desk.purpose.trim().length < 25 || desk.words.length === 0).map((desk) => desk.key);
    expect(thin, `these desk notes are too thin to answer with: ${thin.join(", ")}. Give each a full sentence of purpose and at least one search word.`).toEqual([]);
    for (const desk of DESK_MAP) {
      expect(desk.purpose, desk.key).not.toContain("\u2014");
      expect(desk.purpose.endsWith("."), desk.key).toBe(true);
    }
  });

  it("names no desk the rail does not have, so the map cannot drift", () => {
    const railKeys = new Set(ADMIN_NAV.map((item) => item.key));
    const strays = Object.keys(DESK_NOTES).filter((key) => !railKeys.has(key));
    expect(strays, `these desk notes name a desk that is not on the rail: ${strays.join(", ")}. Remove them, or put the desk back on the rail.`).toEqual([]);
  });

  it("takes the name and the address from the rail itself, never a copy of them", () => {
    for (const desk of DESK_MAP) {
      const onRail = ADMIN_NAV.find((item) => item.key === desk.key);
      expect(onRail, desk.key).toBeDefined();
      expect(desk.href).toBe(onRail!.href);
      expect(desk.label).toBe(onRail!.label);
    }
    expect(RAIL_HREFS).toContain("/admin/copilot");
  });

  it("offers every playbook's desk as a page the rail really has", () => {
    const dead = PLAYBOOKS.filter((playbook) => playbook.deskHref.startsWith("/admin"))
      .filter((playbook) => !RAIL_HREFS.includes(playbook.deskHref) && !manualHrefs.includes(playbook.deskHref))
      .map((playbook) => `${playbook.key} points at ${playbook.deskHref}`);
    expect(dead, `a playbook ends on a page that is not on the rail: ${dead.join("; ")}`).toEqual([]);
  });
});
