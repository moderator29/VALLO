import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { AGENT_INNER_PAGES, agentInnerNavCopy, agentInnerPageFor } from "./agent-inner-nav";

/**
 * R3-08: InnerNav across the agent tree. Every page in the set carries the
 * rail's own label for its href (never the fallback id), every agent route
 * resolves to the right page or to none, and the shell is what mounts it, so
 * no agent page can be left out.
 */
describe("the agent desk's inner navigation", () => {
  for (const locale of ["en", "ha", "ig", "yo"] as const) {
    it(`names every page with the rail's label in ${locale}`, () => {
      const copy = agentInnerNavCopy(getDictionary(locale));
      expect(copy.pages).toHaveLength(AGENT_INNER_PAGES.length);
      for (const page of copy.pages) {
        expect(page.label, page.href).not.toBe(page.id);
        expect(page.label.length, page.href).toBeGreaterThan(0);
      }
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.toggleLabel.length).toBeGreaterThan(0);
    });
  }

  it("lights the page a route belongs to, and nothing for a page outside the desk's set", () => {
    expect(agentInnerPageFor("/agent/dashboard")).toBe("dashboard");
    expect(agentInnerPageFor("/agent/listings")).toBe("listings");
    expect(agentInnerPageFor("/agent/listings/abc/health")).toBe("listings");
    expect(agentInnerPageFor("/agent/analytics/listings/abc")).toBe("analytics");
    expect(agentInnerPageFor("/agent/promotion")).toBe("promotion");
    /* A listing's own promotion screen sits under the listing it promotes. */
    expect(agentInnerPageFor("/agent/listings/abc/promotion")).toBe("listings");
    expect(agentInnerPageFor("/agent/settings")).toBeNull();
    expect(agentInnerPageFor("/agent/list")).toBeNull();
  });

  it("is mounted by the shell as the bar's second row, off on a conversation and on a flow", () => {
    const shell = readFileSync(join(__dirname, "AgentShell.tsx"), "utf8");
    const mount = shell.indexOf("<AgentInnerNav");
    expect(mount).toBeGreaterThan(-1);
    /* Inside the workspace bar, so it is sticky with it (as the host's row). */
    expect(shell.lastIndexOf("<WorkspaceHeader", mount)).toBeGreaterThan(-1);
    expect(shell.indexOf("</WorkspaceHeader>", mount)).toBeGreaterThan(mount);
    expect(shell.slice(shell.lastIndexOf("{immersive || flow ? null : (", mount), mount)).toContain("? null : (");
  });
});
