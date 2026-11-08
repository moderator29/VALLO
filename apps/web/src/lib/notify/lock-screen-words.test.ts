import { describe, expect, it } from "vitest";

import { lockScreenWordsFor } from "./lock-screen-words";

describe("the push path's lock-screen words (8 November 2026)", () => {
  it("names a roommate request and keeps the person's note", () => {
    expect(lockScreenWordsFor({ title: "Ada is interested in sharing a home", body: "Quiet, tidy, near UNILAG", href: "/roommates/me?tab=requests" })).toEqual({
      title: "Ada is interested in sharing a home",
      body: "Quiet, tidy, near UNILAG",
    });
    expect(lockScreenWordsFor({ title: "Ada is interested in sharing a home", body: null })?.body).toBe("Open Roommates to answer");
  });

  it("covers connections, group invites, join requests, viewings and saved-search matches", () => {
    expect(lockScreenWordsFor({ title: "Ada accepted. You are connected", body: null })?.body).toBe("Start a chat when you are ready");
    expect(lockScreenWordsFor({ title: "Ada invited you to Yaba three", body: null, href: "/roommates/me?tab=groups" })?.body).toBe("Open the group to accept or decline");
    expect(lockScreenWordsFor({ title: "Ada asked to join Yaba three", body: null, href: "/roommates/groups/g1" })?.body).toBe("Open the group to answer");
    expect(lockScreenWordsFor({ title: "Ada asked to view your room", body: "Saturday 10am", href: "/roommates/me" })?.body).toBe("Saturday 10am");
    expect(lockScreenWordsFor({ title: 'A new post matches "Yaba under 600k"', body: "Ensuite room in Yaba" })).toEqual({ title: 'A new post matches "Yaba under 600k"', body: "Ensuite room in Yaba" });
  });

  it("covers Trust and Safety and Circle replies and mentions", () => {
    expect(lockScreenWordsFor({ title: "A message from Vallo Trust and Safety", body: "We need one more detail." })?.body).toBe("We need one more detail.");
    expect(lockScreenWordsFor({ title: "We looked into your report", body: "x" })?.body).toBe("Tap to see the outcome");
    expect(lockScreenWordsFor({ title: "New reply", body: "@kemi replied: Six months is usual", href: "/circle/p/p1#a-r1" })).toEqual({ title: "@kemi replied in Circle", body: "Six months is usual" });
    expect(lockScreenWordsFor({ title: "You were mentioned", body: "@kemi mentioned you: see this", href: "/circle/p/p1" })?.title).toBe("@kemi mentioned you");
  });

  it("caps long words for a phone and leaves every other row alone", () => {
    const long = lockScreenWordsFor({ title: `${"A".repeat(60)} is interested in sharing a home`, body: null });
    expect(long!.title.length).toBeLessThanOrEqual(50);
    expect(lockScreenWordsFor({ title: "Booking confirmed", body: "Lekki" })).toBeNull();
    expect(lockScreenWordsFor({ title: "Join request: Lekki renters", body: null, href: "/circle/c/l/manage" })).toBeNull();
    expect(lockScreenWordsFor({ title: "Ada invited you to Lekki renters", body: null, href: "/circle/c/l" })).toBeNull();
  });
});
