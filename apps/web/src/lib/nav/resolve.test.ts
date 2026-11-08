import { describe, expect, it } from "vitest";
import { ROOT, ROUTE_PARENTS } from "./route-parents";
import { chooseBack, fillPattern, isAppRoot, matchRoute, normalisePath, parentOf, refuseHistory, type BackInput } from "./resolve";
import { previousEntry, previousEntryPath, type NavigationLike } from "./previous-entry";
import { backToLabel } from "./route-labels";

/**
 * The hierarchy, proved.
 *
 * Every back control on the platform now goes through `chooseBack`, so this
 * file is where the founder's three arrival routes are settled: a redirect, a
 * sign-in bounce and a deep link. In all three the browser's previous entry is
 * NOT the parent, and in all three the old control went there anyway. Each has
 * a test below that fails the moment the parent check is removed.
 *
 * `every declared parent resolves` is the sweep: it walks the whole of
 * `route-parents.ts`, builds a concrete path for each pattern, and insists the
 * parent it names is itself a route in the map. That is what stops an entry
 * pointing at a screen that does not exist, or at a `[handle]` the child never
 * captured, and it is the check a human reads the map against.
 */

/** A concrete path for a pattern: `/u/[handle]/edit` -> `/u/sample-handle/edit`. */
function sampleFor(pattern: string): string {
  if (pattern === "/") return "/";
  return `/${pattern
    .slice(1)
    .split("/")
    .map((segment) => {
      const dynamic = /^\[(.+)\]$/.exec(segment);
      return dynamic ? `sample-${dynamic[1]}` : segment;
    })
    .join("/")}`;
}

const PATTERNS = Object.keys(ROUTE_PARENTS);

describe("the map itself", () => {
  it("every declared parent resolves to a route that is also in the map", () => {
    const broken: string[] = [];
    for (const pattern of PATTERNS) {
      if (ROUTE_PARENTS[pattern] === ROOT) continue;
      const path = sampleFor(pattern);
      const target = parentOf(path);
      if (target.kind !== "parent") {
        broken.push(`${pattern}: resolved to ${target.kind}`);
        continue;
      }
      if (!matchRoute(target.href)) {
        broken.push(`${pattern}: parent "${target.href}" is not a route in the map`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("every route climbs to a root, so no back control can loop", () => {
    const stuck: string[] = [];
    for (const pattern of PATTERNS) {
      let path = sampleFor(pattern);
      let steps = 0;
      for (;;) {
        const target = parentOf(path);
        if (target.kind === "root") break;
        if (target.kind === "no-parent-declared" || steps > 12) {
          stuck.push(`${pattern}: stopped at "${path}" after ${steps} step(s)`);
          break;
        }
        path = target.href;
        steps += 1;
      }
    }
    expect(stuck).toEqual([]);
  });

  it("names its roots and nothing else", () => {
    const roots = PATTERNS.filter((p) => ROUTE_PARENTS[p] === ROOT);
    /* `/sign-up/finish` (B-2) is a root on purpose: a signed-in person the
       gate holds there has nothing above it to go back to. */
    /* `/home-or-landing` is a redirect, declared so the browsing screens can
       name it as their parent; it only ever lands on `/` or `/home`. */
    expect(roots.sort()).toEqual(["/", "/home", "/home-or-landing", "/sign-up/finish", "/stays", "/welcome"]);
  });

  it("puts a dynamic route under the shelf it came off, not under home", () => {
    /* The founder's own two examples. */
    expect(parentOf("/listing/c7f2")).toEqual({
      kind: "parent",
      pattern: "/listing/[id]",
      href: "/search",
    });
    expect(parentOf("/messages/c7f2")).toEqual({
      kind: "parent",
      pattern: "/messages/[id]",
      href: "/messages",
    });
  });

  it("sends the two browsing screens, opened cold, to the home that fits the reader", () => {
    /* C3.2 sent them to "/" so a stranger never met the sign-in wall, and that
       sent every signed-in member to the marketing page. `/home-or-landing`
       answers `/home` for a member and `/` for anybody else, on the server. */
    expect(parentOf("/search")).toMatchObject({ kind: "parent", href: "/home-or-landing" });
    expect(parentOf("/search?q=lekki")).toMatchObject({ kind: "parent", href: "/home-or-landing" });
    expect(parentOf("/around")).toMatchObject({ kind: "parent", href: "/home-or-landing" });
    expect(parentOf("/search")).not.toMatchObject({ href: "/" });
  });

  it("carries a captured segment into the parent", () => {
    expect(parentOf("/u/ada/followers")).toMatchObject({ href: "/u/ada" });
    expect(parentOf("/rent/move-in/c7f2")).toMatchObject({ href: "/listing/c7f2" });
    expect(parentOf("/bookings/b1/review")).toMatchObject({ href: "/bookings/b1" });
  });

  it("prefers a literal segment over a dynamic one", () => {
    /* `/messages/share/into/[id]` and `/messages/share/listing/[id]` differ
       only in a literal, and each names a different parent. A matcher that
       took the first match, or scored them equal, would send a share picker
       back to the wrong thing. */
    expect(parentOf("/messages/share/into/abc")).toMatchObject({ href: "/messages/abc" });
    expect(parentOf("/messages/share/listing/abc")).toMatchObject({ href: "/listing/abc" });
    expect(parentOf("/messages/share/stay/abc")).toMatchObject({ href: "/stay/abc" });
    expect(parentOf("/messages/share/booking/abc")).toMatchObject({ href: "/bookings/abc" });
    /* `/messages/new` is a literal and must not be read as `/messages/[id]`. */
    expect(parentOf("/messages/new")).toMatchObject({ pattern: "/messages/new" });
    expect(parentOf("/profile/setup/agent")).toMatchObject({ pattern: "/profile/setup/agent" });
  });

  it("does not silently invent a parent for a route nobody declared", () => {
    expect(parentOf("/invented/screen")).toEqual({ kind: "no-parent-declared" });
    /* Not "strip the last segment". A guess that is usually right is the thing
       that hid this defect for as long as it hid. */
    expect(parentOf("/settings/account/danger")).toEqual({ kind: "no-parent-declared" });
  });
});

describe("normalisePath", () => {
  it("levels the three shapes the callers hand in", () => {
    expect(normalisePath("/search?beds=2&city=lagos")).toBe("/search");
    expect(normalisePath("/search#results")).toBe("/search");
    expect(normalisePath("/settings/")).toBe("/settings");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("settings")).toBe("/settings");
  });

  it("matches a route despite a query string, which is how every search arrives", () => {
    expect(parentOf("/listing/c7f2?from=search")).toMatchObject({ href: "/search" });
  });
});

describe("fillPattern", () => {
  it("refuses a parent that names a segment the child never captured", () => {
    expect(() => fillPattern("/u/[handle]", {})).toThrow(/does not capture/);
  });
});

/* --------------------------------------------------------------- arrivals */

/** A web press on `path` with `previous` behind it (in-app unless said). */
function press(path: string, previous: string | null, extra: Partial<BackInput> = {}) {
  return chooseBack({
    path,
    fallback: "/home",
    surface: "web",
    previousPath: previous,
    previousIsInApp: previous !== null,
    ...extra,
  });
}

/** Where the press lands, whichever way it gets there. */
function lands(path: string, previous: string | null, extra: Partial<BackInput> = {}): string | null {
  const decision = press(path, previous, extra);
  return "href" in decision ? decision.href : null;
}

describe("however the person arrived", () => {
  it("a sign-in bounce does not send back to the login page", () => {
    /* The founder's first sentence: inside the Console, press back, land on the
       login page. `/sign-in` is genuinely in-app, so the old guard said yes. */
    expect(press("/admin/kyc", "/sign-in")).toEqual({
      action: "replace",
      href: "/admin",
      reason: "declared-parent",
      refused: "door",
    });
    expect(lands("/settings/account", "/sign-in?next=/settings/account")).toBe("/settings");
    expect(lands("/messages/abc", "/auth/callback")).toBe("/messages");
  });

  it("never returns into any door, whichever door it is", () => {
    for (const door of [
      "/sign-in",
      "/sign-in/email",
      "/sign-up",
      "/sign-up/email",
      "/sign-up/verify",
      "/forgot-password",
      "/forgot-password/code",
      "/reset-password",
      "/auth/callback",
      "/welcome",
      "/start",
      "/open",
      "/admin/enter",
      "/s/2f1d4c6e",
    ]) {
      expect({ door, refused: refuseHistory("/bookings/b1", door, true) }).toEqual({ door, refused: "door" });
    }
  });

  it("a redirect does not send back to the redirector", () => {
    expect(press("/profile/setup/agent", "/profile/setup")).toEqual({
      action: "back",
      href: "/profile/setup",
      delta: 1,
      reason: "history-is-parent",
    });
    /* ...and the same screen reached via `/welcome`, which is where the
       onboarding redirect lands people, goes to the declared parent instead. */
    expect(press("/profile/setup/agent", "/welcome")).toMatchObject({
      action: "replace",
      href: "/profile/setup",
      refused: "door",
    });
  });

  it("a cold deep link lands on the parent rather than out of the product", () => {
    /* A push notification opens `/messages/abc` in a fresh tab: nothing behind. */
    expect(press("/messages/abc", null)).toEqual({
      action: "replace",
      href: "/messages",
      reason: "declared-parent",
    });
  });

  it("a deep link with foreign history behind it never goes back", () => {
    expect(press("/listing/c7f2", "/search", { previousIsInApp: false })).toEqual({
      action: "replace",
      href: "/search",
      reason: "declared-parent",
      refused: "not-in-app",
    });
  });

  it("returns through history to the parent, keeping the hunt", () => {
    /* A filtered search, opened into a listing: going back restores the
       filters and the scroll; a push would throw the hunt away. */
    expect(press("/listing/c7f2", "/search?beds=2&city=lagos&verified=1")).toEqual({
      action: "back",
      href: "/search",
      delta: 1,
      reason: "history-is-parent",
    });
  });

  it("falls through to the caller's fallback only where nothing is declared", () => {
    expect(press("/invented/screen", "/around", { fallback: "/around" })).toEqual({
      action: "replace",
      href: "/around",
      reason: "no-parent-declared",
    });
  });
});

/* ------------------------------------------------ the screen you came from
 *
 * THE FOUNDER'S COMPLAINT, 29 September: "many back buttons take me to places
 * they're not supposed to". Every line below was a WRONG DESTINATION under the
 * old rule ("history only when the entry behind IS the parent"), which sent
 * the press to the declared parent: a screen the person had never opened.
 * Each expectation is the screen they came from.
 */
describe("back returns to the screen you came from", () => {
  const CAME_FROM: [string, string, string][] = [
    /* [screen, the screen behind it, where Back lands] */
    ["/listing/c7f2", "/home", "/home"], // was /search
    ["/listing/c7f2", "/saved", "/saved"], // was /search
    ["/listing/c7f2", "/messages/t1", "/messages/t1"], // was /search
    ["/listing/c7f2", "/bookings/b1", "/bookings/b1"], // was /search
    ["/listing/c7f2", "/agent/listings", "/agent/listings"], // was /search
    ["/stay/s1", "/stays/search?city=lagos", "/stays/search?city=lagos"], // was /stays
    ["/u/ada", "/post/p1", "/post/p1"], // was /around: the post was lost
    ["/u/ada", "/messages/t1", "/messages/t1"], // was /around
    ["/post/p1", "/u/ada", "/u/ada"], // was /around
    ["/messages/t1", "/listing/c7f2", "/listing/c7f2"], // was /messages
    ["/messages/t1", "/bookings/b1", "/bookings/b1"], // was /messages
    ["/bookings/b1", "/notifications", "/notifications"], // was /bookings
    ["/agreements/a1", "/notifications", "/notifications"], // was /agreements
    ["/search", "/home", "/home"], // was / (the marketing page)
    ["/around", "/home", "/home"], // was / (the marketing page)
    ["/support", "/agent/dashboard", "/agent/dashboard"], // was /home: left the workspace
    ["/support", "/host", "/host"], // was /home
    ["/support", "/settings", "/settings"], // was /home
    ["/legal/privacy", "/legal/terms", "/legal/terms"], // was /settings
    ["/legal/terms", "/sign-up/finish", "/sign-up/finish"], // was /settings, bounced by the gate
    ["/tenancy/t1", "/agreements/a1", "/agreements/a1"], // was /bookings
    ["/admin/people/p1", "/admin/queue", "/admin/queue"], // was /admin/people
    ["/admin/bookings/b1", "/admin/support", "/admin/support"], // was /admin/bookings
    ["/agent/messages/t1", "/agent/notifications", "/agent/notifications"], // was /agent/messages
    ["/agent/list", "/home", "/home"], // the Create sheet's "List a property"
  ];

  for (const [path, behind, want] of CAME_FROM) {
    it(`${path} opened from ${behind} goes back to ${behind}`, () => {
      const decision = press(path, behind);
      expect(decision).toMatchObject({ action: "back", delta: 1 });
      expect(lands(path, behind)).toBe(normalisePath(want));
    });
  }

  it("names the destination for the accessible label", () => {
    expect(backToLabel("/home")).toBe("Back to Home");
    expect(backToLabel("/messages")).toBe("Back to Messages");
    expect(backToLabel("/listing/c7f2")).toBe("Back to the listing");
    expect(backToLabel("/home-or-landing")).toBe("Back to Home");
    expect(backToLabel("/invented/screen")).toBe(null);
  });

  it("has a name for every declared parent a person can land on", () => {
    const unnamed = new Set<string>();
    for (const pattern of PATTERNS) {
      if (ROUTE_PARENTS[pattern] === ROOT || pattern.startsWith("/preview")) continue;
      const target = parentOf(sampleFor(pattern));
      if (target.kind === "parent" && backToLabel(target.href) === null) unnamed.add(target.href);
    }
    expect([...unnamed]).toEqual([]);
  });
});

describe("every screen has a name for the back control to say", () => {
  /* Screens nobody is ever sent BACK to: doors and flows are refused as
     history targets, redirects serve no document, and the harnesses are not
     product. Everything else must be nameable, or "Back to <it>" says "Back". */
  const UNNAMED_BY_DESIGN = new Set([
    "/start", "/sign-up/verify", "/forgot-password/code", "/reset-password", "/auth/callback",
    "/s/[token]", "/offline", "/gallery",
  ]);
  it("names every screen a person can come from", () => {
    const missing = PATTERNS.filter(
      (p) =>
        !p.startsWith("/preview") &&
        !UNNAMED_BY_DESIGN.has(p) &&
        refuseHistory("/home", sampleFor(p), true) !== "flow" &&
        backToLabel(sampleFor(p)) === null,
    );
    expect(missing).toEqual([]);
  });
});

describe("but never to a screen that is not safe to return to", () => {
  it("never returns to a submitted form or a payment", () => {
    const FORMS: [string, string, string][] = [
      ["/messages/t1", "/messages/new", "/messages"],
      ["/messages/t1", "/messages/share/listing/c7f2", "/messages"],
      ["/bookings/b1", "/checkout/b1", "/bookings"],
      ["/bookings/b1", "/checkout?stay=s1", "/bookings"],
      ["/bookings", "/pay/crypto/ref1", "/home"],
      ["/bookings/b1", "/bookings/b1/review", "/bookings"],
      ["/support/messages/k1", "/support/new", "/support/messages"],
      ["/around", "/stories/new", "/home-or-landing"],
      ["/u/ada", "/u/ada/edit", "/around"],
      ["/tenancy/t1", "/tenancy/t1/complaint", "/bookings"],
      ["/profile/application", "/profile/setup/owner", "/profile"],
      ["/agent/listings", "/agent/list", "/agent/dashboard"],
      ["/host", "/host/start", "/stays"], // the Stays home: /host is a Stays address
      ["/rent/review/r1", "/rent/pay/i1", "/bookings"],
    ];
    for (const [path, behind, want] of FORMS) {
      expect({ path, behind, ...press(path, behind) }).toMatchObject({
        path,
        behind,
        action: "replace",
        href: want,
        refused: "flow",
      });
    }
  });

  it("never returns to a success receipt", () => {
    expect(press("/agreements", "/agreements/a1?done=agreement-drawn")).toMatchObject({
      action: "replace",
      href: "/home",
      refused: "success-flag",
    });
    /* Not even when the receipt is the declared parent itself. */
    expect(press("/agreements/a1", "/agreements?done=agreement-drawn")).toMatchObject({
      action: "replace",
      href: "/agreements",
      refused: "success-flag",
    });
    expect(press("/bookings/b1", "/bookings?tab=past&done=paid")).toMatchObject({ action: "replace", href: "/bookings" });
  });

  it("never walks to a crafted or foreign entry", () => {
    for (const behind of ["//evil.example/x", "/\\evil.example", "javascript:alert(1)", "https://evil.example/home", "/auth/callback?code=x", "/sign-in?next=/settings"]) {
      const decision = press("/settings/account", behind);
      expect({ behind, ...decision }).toMatchObject({ behind, action: "replace", href: "/settings" });
    }
    expect(press("/settings/account", "/settings", { previousIsInApp: false })).toMatchObject({
      action: "replace",
      href: "/settings",
      refused: "not-in-app",
    });
    /* A filled parent always starts with a literal segment, so a crafted
       param can never produce a protocol-relative `//host`. */
    for (const pattern of PATTERNS) {
      const target = parentOf(sampleFor(pattern));
      if (target.kind === "parent") expect(target.href.startsWith("//")).toBe(false);
    }
  });

  it("never loops back into the child the last Up left behind", () => {
    /* Thread -> Up (inbox) used to leave the thread behind the inbox; the
       inbox's Back then walked straight back into the thread. */
    expect(press("/messages", "/messages/t1")).toMatchObject({ action: "replace", href: "/home", refused: "descendant" });
    expect(press("/settings", "/settings/privacy/blocked")).toMatchObject({ refused: "descendant" });
    expect(press("/bookings", "/bookings/b1/review")).toMatchObject({ action: "replace", href: "/home" });
  });

  it("never crosses from one workspace into another", () => {
    expect(press("/agent/listings", "/host/rooms")).toMatchObject({
      action: "replace",
      href: "/agent/dashboard",
      refused: "other-workspace",
    });
    expect(press("/host/rooms", "/admin/queue")).toMatchObject({ href: "/host", refused: "other-workspace" });
    expect(press("/admin/kyc", "/agent/dashboard")).toMatchObject({ href: "/admin", refused: "other-workspace" });
    /* A workspace's own landing is where a switch lands, so back from it may
       return to the workspace the person switched from. */
    expect(press("/host", "/agent/dashboard")).toMatchObject({ action: "back", href: "/agent/dashboard" });
    /* Inside one workspace, history is kept. */
    expect(press("/agent/listings/l1/calendar", "/agent/bookings")).toMatchObject({ action: "back", href: "/agent/bookings" });
  });

  it("never returns to an address nobody declared", () => {
    expect(press("/bookings/b1", "/invented/screen")).toMatchObject({ href: "/bookings", refused: "undeclared" });
  });

  it("never walks history in a browser that cannot say what is behind", () => {
    /* Safari before the Navigation API: the entry is ours, but its address is
       unknown, so the declared parent is the answer. */
    expect(press("/listing/c7f2", null, { previousIsInApp: true })).toEqual({
      action: "replace",
      href: "/search",
      reason: "declared-parent",
    });
  });
});

describe("same-screen entries are stepped over", () => {
  it("leaves a re-filtered search in one press", () => {
    /* `/home` -> `/search?a` -> `/search?b` -> `/search?c`: one press on the
       search screen's back goes to Home, three entries back. */
    expect(press("/search", "/home", { previousDistance: 3 })).toEqual({
      action: "back",
      href: "/home",
      delta: 3,
      reason: "history-is-origin",
    });
  });

  it("measures that distance from the Navigation API", () => {
    const nav = navigationWith(["/home", "/search?a=1", "/search?a=2", "/search?a=3"], 3);
    expect(previousEntry(nav)).toEqual({ path: "/home", distance: 3 });
    const withSheet = navigationWith(["/search?beds=2", "/listing/c7f2", "/listing/c7f2"], 2);
    expect(previousEntry(withSheet)).toEqual({ path: "/search?beds=2", distance: 2 });
    expect(previousEntry(navigationWith(["/search?a", "/search?b"], 1))).toBe(null);
    expect(previousEntry(null)).toBe(null);
  });
});

/* ------------------------------------------------- the home of your side */

/*
 * Session 3 navigation audit: a shared screen opened cold on the Stays side
 * went back to `/home`, the PROPERTY home, and the shell turned over under
 * the person. The home a press lands on is the home of the side the screen
 * is painted on.
 */
describe("the home is the home of the side you are on", () => {
  const SHARED = ["/messages", "/notifications", "/bookings", "/saved", "/settings", "/profile", "/assistant", "/support"];

  it("returns a shared screen on the Stays side to /stays, cold and after a refused screen", () => {
    for (const path of SHARED) {
      expect(press(path, null, { shellSide: "stays" }), path).toMatchObject({ action: "replace", href: "/stays" });
      expect(press(path, "/sign-in", { shellSide: "stays" }), path).toMatchObject({ action: "replace", href: "/stays", refused: "door" });
    }
    /* The feed names the `/home-or-landing` redirect, which only ever answers
       `/home` for a member: on the Stays side that is `/stays`. */
    expect(press("/around", null, { shellSide: "stays" })).toMatchObject({ action: "replace", href: "/stays" });
  });

  it("walks history to the Stays home when it is sitting right behind", () => {
    expect(press("/messages", "/stays", { shellSide: "stays" })).toMatchObject({
      action: "back",
      href: "/stays",
      reason: "history-is-parent",
    });
  });

  it("leaves the Property side, and a caller that cannot say, exactly as declared", () => {
    for (const path of SHARED) {
      expect(lands(path, null, { shellSide: "property" }), path).toBe("/home");
      expect(lands(path, null), path).toBe("/home");
    }
    expect(lands("/around", null)).toBe("/home-or-landing");
  });

  it("lets an address's own side win over the shell's", () => {
    /* Property-owned: never sent to the Stays home, whatever the shell says. */
    expect(lands("/search", null, { shellSide: "stays" })).toBe("/home-or-landing");
    expect(lands("/agent/dashboard", null, { shellSide: "stays" })).toBe("/home");
    /* Stays-owned: the host workspace is declared under `/stays` itself. */
    expect(parentOf("/host")).toMatchObject({ href: "/stays" });
    expect(lands("/host", null, { shellSide: "property" })).toBe("/stays");
  });

  it("only ever answers a home with a home: every other parent is untouched", () => {
    expect(lands("/messages/t1", null, { shellSide: "stays" })).toBe("/messages");
    expect(lands("/settings/account", null, { shellSide: "stays" })).toBe("/settings");
    expect(lands("/stay/s1", null, { shellSide: "stays" })).toBe("/stays");
  });

  it("never turns a root into a way out on Android because of the side", () => {
    expect(press("/home", null, { surface: "android", shellSide: "stays" })).toEqual({ action: "exit", reason: "root" });
    expect(press("/messages/abc", null, { surface: "android", shellSide: "stays" })).toMatchObject({ href: "/messages" });
    expect(press("/messages", null, { surface: "android", shellSide: "stays" })).toMatchObject({ href: "/stays" });
  });
});

/* ---------------------------------------------------------------- android */

describe("the Android hardware button", () => {
  it("closes the application only at a declared root", () => {
    for (const root of ["/", "/home", "/stays", "/welcome"]) {
      expect(isAppRoot(root)).toBe(true);
      expect(press(root, null, { surface: "android" })).toEqual({ action: "exit", reason: "root" });
    }
  });

  it("never sends the welcome intro to /home, which a stranger meets as the sign-in wall", () => {
    expect(parentOf("/welcome")).toEqual({ kind: "root", pattern: "/welcome" });
    expect(parentOf("/welcome?tour=1")).toEqual({ kind: "root", pattern: "/welcome" });
    expect(press("/welcome", null, { surface: "android" })).toEqual({ action: "exit", reason: "root" });
  });

  it("does not close the application on a cold deep link into a conversation", () => {
    expect(isAppRoot("/messages/abc")).toBe(false);
    expect(press("/messages/abc", null, { surface: "android" })).toEqual({
      action: "replace",
      href: "/messages",
      reason: "declared-parent",
    });
  });

  it("takes the same came-from answer as the drawn control", () => {
    expect(press("/listing/c7f2", "/home", { surface: "android" })).toMatchObject({ action: "back", href: "/home" });
    expect(press("/settings/account", "/sign-in", { surface: "android" })).toMatchObject({
      action: "replace",
      href: "/settings",
    });
  });

  it("never closes the application on a route nobody declared", () => {
    expect(isAppRoot("/invented/screen")).toBe(false);
    expect(press("/invented/screen", null, { surface: "android" })).toEqual({
      action: "replace",
      href: "/home",
      reason: "no-parent-declared",
    });
  });

  it("holds no route inside the Console as an exit point", () => {
    for (const pattern of PATTERNS.filter((p) => p.startsWith("/admin"))) {
      expect(isAppRoot(sampleFor(pattern))).toBe(false);
    }
  });
});

/* -------------------------------------------------- the one available proof */

function navigationWith(urls: string[], index: number): NavigationLike {
  return {
    currentEntry: { index },
    entries: () => urls.map((url) => ({ url: `https://vallospaces.com${url}` })),
  };
}

describe("previousEntryPath", () => {
  /* The name deliberately avoids spelling the router call out: the static scan
     in `tests/session-memory.spec.mjs` blanks comments but not strings, and a
     test NAME containing it reads as an unguarded back control. */
  it("reads the entry a history step would land on", () => {
    expect(previousEntryPath(navigationWith(["/search", "/listing/c7f2"], 1))).toBe("/search");
  });

  it("answers null at the first entry, where there is nothing behind", () => {
    expect(previousEntryPath(navigationWith(["/listing/c7f2"], 0))).toBe(null);
  });

  it("answers null rather than guessing when the browser has no Navigation API", () => {
    /* Safari and Firefox. No URL means no proof, which means the declared
       parent gets pushed. See the header of `previous-entry.ts`. */
    expect(previousEntryPath(null)).toBe(null);
    expect(previousEntryPath({})).toBe(null);
  });

  it("answers null for a disposed entry rather than throwing at a back control", () => {
    expect(previousEntryPath({ currentEntry: { index: 1 }, entries: () => [{ url: null }] })).toBe(
      null,
    );
    expect(
      previousEntryPath({
        currentEntry: { index: 1 },
        entries: () => {
          throw new Error("disposed");
        },
      }),
    ).toBe(null);
  });
});
