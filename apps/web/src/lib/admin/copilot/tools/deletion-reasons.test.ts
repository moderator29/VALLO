import { describe, expect, it } from "vitest";
import { FORBIDDEN_TOOL_NAME, isOfferable } from "./registry";
import { DELETION_REASON_TOOLS } from "./deletion-reasons";
import type { CopilotViewer } from "./types";

const viewer = (scopes: CopilotViewer["scopes"]): CopilotViewer => ({ userId: "u", firstName: "A", isAdmin: false, isSuperAdmin: false, scopes, position: null });

describe("the deletion reasons copilot tool", () => {
  const tool = DELETION_REASON_TOOLS[0]!;
  it("is a read tool with an allowed name, offered to operations, support lead and marketing only", () => {
    expect(tool.kind).toBe("read");
    expect(FORBIDDEN_TOOL_NAME.test(tool.name)).toBe(false);
    for (const scope of ["operations", "support_lead", "marketing"] as const) expect(isOfferable(tool, viewer([scope]))).toBe(true);
    expect(isOfferable(tool, viewer(["support", "finance"]))).toBe(false);
    expect(isOfferable(tool, { ...viewer([]), isAdmin: true })).toBe(true);
  });
  it("promises aggregates only", () => {
    expect(tool.description).toMatch(/Aggregates only/);
    expect(tool.description).not.toMatch(/—/);
  });
});
