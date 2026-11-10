import { describe, expect, it } from "vitest";

import { FORBIDDEN_TOOL_NAME, isOfferable } from "./registry";
import { STAFF_DESK_TOOLS } from "./staff-desks";
import type { CopilotViewer } from "./types";

const viewer = (scopes: CopilotViewer["scopes"]): CopilotViewer => ({ userId: "u", firstName: "A", isAdmin: false, isSuperAdmin: false, scopes, position: null });
const names = (scope: CopilotViewer["scopes"][number]) => STAFF_DESK_TOOLS.filter((t) => isOfferable(t, viewer([scope]))).map((t) => t.name);

describe("the staff desks' copilot tools", () => {
  it("are all offerable (none trips the forbidden-name rule) and belong to exactly one desk", () => {
    expect(STAFF_DESK_TOOLS.filter((t) => FORBIDDEN_TOOL_NAME.test(t.name))).toEqual([]);
    expect(new Set(STAFF_DESK_TOOLS.map((t) => t.name)).size).toBe(STAFF_DESK_TOOLS.length);
    for (const t of STAFF_DESK_TOOLS) expect(t.scopes, t.name).toHaveLength(1);
  });

  it("give each desk read tools and draft tools, and nothing from another desk", () => {
    for (const scope of ["marketing", "content", "technical", "support_lead"] as const) {
      const own = STAFF_DESK_TOOLS.filter((t) => t.scopes[0] === scope);
      expect(own.some((t) => t.kind === "read"), scope).toBe(true);
      expect(own.some((t) => t.kind === "propose"), scope).toBe(true);
      expect(names(scope).sort()).toEqual(own.map((t) => t.name).sort());
    }
  });

  it("hold no tool for someone without the desk's scope", () => {
    expect(STAFF_DESK_TOOLS.filter((t) => isOfferable(t, viewer(["support"])))).toEqual([]);
    expect(STAFF_DESK_TOOLS.filter((t) => isOfferable(t, viewer(["social_media", "finance"])))).toEqual([]);
  });

  it("make every propose tool a draft: no action can run, so nothing is saved by confirming", async () => {
    for (const t of STAFF_DESK_TOOLS.filter((x) => x.kind === "propose")) {
      expect(t.name.startsWith("draft_"), t.name).toBe(true);
    }
  });

  it("describe no tool in words that promise safety", () => {
    for (const t of STAFF_DESK_TOOLS) expect(t.description, t.name).not.toMatch(/—/);
  });
});
