import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { RoommatesHome } from "@/lib/features/roommates/queries";
import { RoommatesDashboard } from "./Dashboard";

const t = getDictionary("en").roommates;
const home = (over: Partial<RoommatesHome>): RoommatesHome => ({
  live: true, signedIn: true, viewerName: "Ada", myStatus: "active", completeness: 100, stats: null,
  recommended: [], rooms: [], together: [], institutions: [], pending: { requests: 0, invites: 0, viewings: 0 }, ...over,
});
const html = (h: RoommatesHome) => renderToStaticMarkup(<RoommatesDashboard home={h} t={t} />);

describe("the Roommates home dashboard", () => {
  it("a new person: no next card (the profile card owns it), an honest empty count, every area", () => {
    const out = html(home({ myStatus: "none" }));
    expect(out).toContain('data-next="profile"');
    expect(out).not.toContain("roommates-next\"");
    expect(out).toContain(t.area.dash.countsEmpty);
    for (const href of ["/roommates/discover", "/roommates/groups", "/roommates/campus", "/roommates/nysc", "/roommates/me", "/roommates/split", "/roommates/verify", "/roommates/safety"]) expect(out).toContain(`href="${href}"`);
  });
  it("a ready person with requests: the first next action is the requests, with real counts", () => {
    const out = html(home({ pending: { requests: 2, invites: 0, viewings: 1 } }));
    expect(out).toContain('data-next="requests"');
    expect(out).toContain("2 requests");
    expect(out).toContain("1 viewing");
    expect(out).toContain(t.area.dash.requests.cta);
  });
  it("a ready person with nothing waiting and no matches: post a room, and says nothing waits", () => {
    const out = html(home({}));
    expect(out).toContain('data-next="post"');
    expect(out).toContain(t.area.dash.countsEmpty);
  });
  it("a signed-out visitor: sign in, no counts", () => {
    const out = html(home({ signedIn: false, myStatus: "none" }));
    expect(out).toContain('data-next="sign-in"');
    expect(out).not.toContain("roommates-counts");
  });
});
