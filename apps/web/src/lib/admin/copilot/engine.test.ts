import { describe, expect, it } from "vitest";
import { buildAdminSystemPrompt } from "./engine";

describe("the admin copilot's system prompt", () => {
  it("names the staff member once by first name, their position and their desk", () => {
    const prompt = buildAdminSystemPrompt({
      viewerFirstName: "Ada",
      positionTitle: "Business Development Executive",
      roleSummary: "Brings in landlords and agents.",
      deskName: "Business Development",
      context: "3 new leads, 1 listing awaiting review.",
    });
    expect(prompt).toContain("Ada");
    expect(prompt).toContain("Business Development Executive");
    expect(prompt).toContain("Brings in landlords and agents.");
    expect(prompt).toContain("Business Development desk");
    expect(prompt).toContain("3 new leads, 1 listing awaiting review.");
  });

  it("names a super admin plainly when there is no named position", () => {
    const prompt = buildAdminSystemPrompt({
      viewerFirstName: "Tunde",
      positionTitle: null,
      roleSummary: null,
      deskName: "Money",
      context: null,
    });
    expect(prompt).toContain("super admin with full console access");
    expect(prompt).not.toContain("null");
  });

  it("never invents a figure: it carries only the context it was given", () => {
    const prompt = buildAdminSystemPrompt({
      viewerFirstName: "Bimbo",
      positionTitle: "Social Media Manager",
      roleSummary: "Plans content.",
      deskName: "Social Media",
      context: null,
    });
    expect(prompt).toContain("Never invent a figure");
    expect(prompt).not.toMatch(/Today, on this desk/);
  });

  it("tells it plainly it can take no action itself", () => {
    const prompt = buildAdminSystemPrompt({
      viewerFirstName: "Femi",
      positionTitle: null,
      roleSummary: null,
      deskName: "the console",
      context: null,
    });
    expect(prompt).toMatch(/cannot take any action yourself/);
  });
});
