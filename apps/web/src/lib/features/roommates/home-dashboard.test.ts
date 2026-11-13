import { describe, expect, it } from "vitest";
import { activeRoommatesTab, dashboardCounts, nextAction, ROOMMATES_TABS } from "./home-dashboard";

const base = { signedIn: true, myStatus: "active" as const, pending: { requests: 0, invites: 0, viewings: 0 }, recommended: [] as never[] };

describe("the home dashboard's next action", () => {
  it("asks a signed-out visitor to sign in", () => {
    expect(nextAction({ ...base, signedIn: false }).kind).toBe("sign-in");
  });
  it("sends a new person to make a profile and a draft to continue it", () => {
    expect(nextAction({ ...base, myStatus: "none" })).toEqual({ kind: "profile", started: false });
    expect(nextAction({ ...base, myStatus: "draft" })).toEqual({ kind: "profile", started: true });
  });
  it("puts people waiting on you before everything else", () => {
    expect(nextAction({ ...base, myStatus: "none", pending: { requests: 2, invites: 1, viewings: 1 } })).toEqual({ kind: "requests", count: 2 });
    expect(nextAction({ ...base, pending: { requests: 0, invites: 1, viewings: 1 } }).kind).toBe("invites");
    expect(nextAction({ ...base, pending: { requests: 0, invites: 0, viewings: 3 } }).kind).toBe("viewings");
  });
  it("shows matches when there are some and a post when there are none", () => {
    expect(nextAction({ ...base, recommended: [{}, {}] as never[] })).toEqual({ kind: "matches", count: 2 });
    expect(nextAction(base).kind).toBe("post");
  });
  it("counts only what the read holds", () => {
    expect(dashboardCounts({ pending: { requests: 1, invites: 0, viewings: 2 }, recommended: [{}] as never[] })).toEqual({ requests: 1, invites: 0, viewings: 2, matches: 1 });
  });
});

describe("the sub-navigation's active tab", () => {
  it.each([
    ["/roommates", "home"],
    ["/roommates/discover", "discover"],
    ["/roommates/p/abc", "discover"],
    ["/roommates/r/abc/edit", "discover"],
    ["/roommates/groups/new", "groups"],
    ["/roommates/campus/unilag", "schools"],
    ["/roommates/nysc", "nysc"],
    ["/roommates/me", "mine"],
    ["/roommates/profile", "mine"],
    ["/roommates/new", "mine"],
    ["/roommates/split", "mine"],
    ["/roommates/safety", "safety"],
  ])("%s lights %s", (path, tab) => {
    expect(activeRoommatesTab(path)).toBe(tab);
  });
  it("has seven tabs, Home first", () => {
    expect(ROOMMATES_TABS.map((x) => x.id)).toEqual(["home", "discover", "groups", "schools", "nysc", "mine", "safety"]);
  });
});

describe("the tab roots, where the page draws the area's tabs under its own title", () => {
  it("is true on each tab's own page and false on every inner page", async () => {
    const { isRoommatesTabRoot, ROOMMATES_TABS } = await import("./home-dashboard");
    for (const tab of ROOMMATES_TABS) {
      expect(isRoommatesTabRoot(tab.href), tab.href).toBe(true);
      expect(isRoommatesTabRoot(`${tab.href}/`), `${tab.href}/`).toBe(true);
    }
    for (const inner of ["/roommates/r/abc", "/roommates/p/abc", "/roommates/groups/new", "/roommates/campus/unilag", "/roommates/profile", "/roommates/new", "/roommates/verify", "/roommates/split", "/roommates/tools/checklist", "/home"]) {
      expect(isRoommatesTabRoot(inner), inner).toBe(false);
    }
  });
});
