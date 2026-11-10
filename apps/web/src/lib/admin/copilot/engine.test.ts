import { describe, expect, it } from "vitest";
import { COPILOT_LIMITS } from "./capabilities";
import { HARD_LIMITS_LINE, HOUSE_RULES, buildAdminSystemPrompt } from "./engine";

describe("the admin copilot's system prompt", () => {
  const base = { viewerFirstName: "Ada", positionTitle: "Business Development Executive", roleSummary: "Brings in landlords and agents.", deskName: "Business Development", context: "3 new leads, 1 listing awaiting review.", scopeLabels: ["Business development"] };

  it("names the staff member once by first name, their position, scopes and desk", () => {
    const prompt = buildAdminSystemPrompt(base);
    expect(prompt).toContain("Ada");
    expect(prompt).toContain("Business Development Executive");
    expect(prompt).toContain("Brings in landlords and agents.");
    expect(prompt).toContain("Business Development desk");
    expect(prompt).toContain("Their access areas: Business development");
    expect(prompt).toContain("3 new leads, 1 listing awaiting review.");
  });

  it("names a super admin plainly when there is no named position, with no stray null", () => {
    const prompt = buildAdminSystemPrompt({ viewerFirstName: "Tunde", positionTitle: null, roleSummary: null, deskName: "Money", context: null, isSuperAdmin: true });
    expect(prompt).toContain("super admin with full console access");
    expect(prompt).not.toContain("null");
  });

  it("states today's date and lists the tools offered", () => {
    const prompt = buildAdminSystemPrompt({ ...base, now: Date.parse("2026-11-10T09:00:00Z"), tools: [{ name: "get_support_queue", kind: "read" }, { name: "create_my_task", kind: "propose" }] });
    expect(prompt).toContain("Today is 2026-11-10");
    expect(prompt).toContain("Read tools you may call: get_support_queue");
    expect(prompt).toContain("Propose tools");
    expect(prompt).toContain("create_my_task");
  });

  it("carries every hard limit in words, and the retired Guarantee wording", () => {
    const prompt = buildAdminSystemPrompt(base);
    for (const limit of COPILOT_LIMITS) expect(prompt).toContain(limit);
    expect(prompt).toContain("HARD LIMITS");
    expect(prompt).toMatch(/never move money/i);
    expect(prompt).toMatch(/never restrict, suspend or ban/i);
    expect(prompt).toMatch(/never approve or reject/i);
    expect(prompt).toMatch(/never send a message to a member/i);
    expect(prompt).toContain("Vallo Guarantee is retired");
    expect(HARD_LIMITS_LINE).toContain("no tool for any of these");
  });

  it("tells the model to prefer tools and to quote numbers only from tool results", () => {
    const rules = HOUSE_RULES.join(" ");
    expect(rules).toMatch(/Prefer calling a tool over guessing/);
    expect(rules).toMatch(/only if a tool returned it THIS turn/);
    expect(rules).toMatch(/search_manual/);
  });

  it("contains no long dash anywhere in what it tells the model", () => {
    expect(buildAdminSystemPrompt(base)).not.toContain("—");
  });
});
