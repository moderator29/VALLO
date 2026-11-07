import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WHAT A PERSON ACTUALLY SEES, AND WHERE A TAP ACTUALLY LANDS, ASSERTED
 * AGAINST THE BYTES THAT ARE SERVED.
 *
 * ===========================================================================
 * THIS FILE READS `public/sw.js` AND RUNS IT. IT DOES NOT RE-IMPLEMENT IT.
 *
 * A service worker cannot be imported: it has no exports, it addresses a
 * `self` that does not exist in Node, and it is shipped as a static file
 * rather than compiled. The usual answer to that is to copy the interesting
 * logic into a module, test the copy, and ship the original. That is a test
 * of a thing nobody runs, and section 17 of the ledger is a list of them.
 *
 * So the real file is read off disk, evaluated against a recording `self`,
 * and its listeners are called. Every assertion below is about the exact text
 * that a browser downloads from `/sw.js`. Change the icon path in the shipped
 * file and this goes red; change it here and nothing happens, because there
 * is nothing here to change.
 *
 * ===========================================================================
 * WHAT IT DOES NOT PROVE, SAID FIRST.
 *
 * It does not prove a notification reaches a device. NOTHING IN THIS
 * REPOSITORY PROVES THAT and nothing here implies it. It proves the worker's
 * decisions: what it builds, what it refuses, what it folds, and where it
 * sends a tap. The half above that (a real Chromium, a real `push` event, the
 * real notification the browser built from it) is
 * `service-worker.browser.test.ts`. The half above THAT needs a handset, a
 * push service and a VAPID pair, and is `docs/push/FIRST_NOTIFICATION.md`.
 */

const SW_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "sw.js");
const SOURCE = readFileSync(SW_PATH, "utf8");

const ORIGIN = "https://vallospaces.com";

type Options = Record<string, unknown> & { data?: Record<string, unknown>; tag?: string };
type Shown = { title: string; options: Options };
type FakeNotification = { tag: string; data: Record<string, unknown>; close: () => void };

type FakeClient = {
  url: string;
  focus?: () => Promise<FakeClient>;
  navigate?: (url: string) => Promise<FakeClient | null>;
};

type Harness = {
  listeners: Map<string, (event: unknown) => void>;
  shown: Shown[];
  closedTags: string[];
  focused: string[];
  navigatedTo: string[];
  openedWindows: string[];
  posted: Array<{ url: string; body: Record<string, unknown> }>;
  displayed: FakeNotification[];
  clientList: FakeClient[];
  getNotificationsThrows: boolean;
};

/**
 * Evaluate the shipped worker against a `self` that writes everything down.
 *
 * `new Function` rather than `eval` so the worker's own top-level `const`
 * declarations cannot reach this module's scope, and so `self` is a parameter
 * that shadows anything global rather than a property somebody has to
 * remember to clean up between tests.
 */
function loadWorker(): Harness {
  const harness: Harness = {
    listeners: new Map(),
    shown: [],
    closedTags: [],
    focused: [],
    navigatedTo: [],
    openedWindows: [],
    posted: [],
    displayed: [],
    clientList: [],
    getNotificationsThrows: false,
  };

  const fakeSelf = {
    addEventListener(type: string, handler: (event: unknown) => void) {
      harness.listeners.set(type, handler);
    },
    skipWaiting() {},
    location: { origin: ORIGIN },
    navigator: {},
    registration: {
      async getNotifications() {
        if (harness.getNotificationsThrows) throw new Error("not supported here");
        return harness.displayed;
      },
      async showNotification(title: string, options: Options) {
        harness.shown.push({ title, options });
      },
      pushManager: {
        async subscribe() {
          return {
            endpoint: `${ORIGIN}/fake-endpoint`,
            toJSON: () => ({ keys: { p256dh: "P", auth: "A" } }),
          };
        },
      },
    },
    clients: {
      async matchAll() {
        return harness.clientList;
      },
      async claim() {},
      async openWindow(url: string) {
        harness.openedWindows.push(url);
        return null;
      },
    },
  };

  const cachesStub = {
    async open() {
      return { async addAll() {}, async match() {}, async put() {} };
    },
    async keys() {
      return [];
    },
    async match() {
      return undefined;
    },
    async delete() {
      return true;
    },
  };

  const fetchStub = async (url: string, init?: { body?: string }) => {
    harness.posted.push({ url, body: JSON.parse(init?.body ?? "{}") as Record<string, unknown> });
    return { ok: true };
  };

  /* `new Function` rather than an import, because the point of this file is
     to run the shipped artefact rather than a copy of it; see the header. The
     input is a file in this repository, read at test time, never a request.
     No lint rule is disabled for it: the house configuration already permits
     this and a disabled rule would be the wrong way to buy it. */
  const run = new Function("self", "caches", "fetch", SOURCE) as (
    s: unknown,
    c: unknown,
    f: unknown,
  ) => void;
  run(fakeSelf, cachesStub, fetchStub);

  return harness;
}

function displayedNotification(
  harness: Harness,
  tag: string,
  data: Record<string, unknown>,
): FakeNotification {
  return {
    tag,
    data,
    close: () => {
      harness.closedTags.push(tag);
    },
  };
}

/** Call one listener and wait for everything it handed to `waitUntil`. */
async function dispatch(
  harness: Harness,
  type: string,
  event: Record<string, unknown>,
): Promise<void> {
  const handler = harness.listeners.get(type);
  if (!handler) throw new Error(`the shipped worker registers no "${type}" listener`);
  const waits: Array<Promise<unknown>> = [];
  handler({ ...event, waitUntil: (value: unknown) => waits.push(Promise.resolve(value)) });
  await Promise.all(waits);
}

/** A `push` event carrying a payload the browser has already decrypted. */
function pushEvent(payload: unknown): Record<string, unknown> {
  return {
    data: {
      json: () => {
        if (payload === undefined) throw new SyntaxError("not JSON");
        return payload;
      },
    },
  };
}

function clickEvent(harness: Harness, data: Record<string, unknown>): Record<string, unknown> {
  return {
    notification: {
      data,
      close: () => {
        harness.closedTags.push("clicked");
      },
    },
  };
}

function openTab(harness: Harness, url: string, options?: { navigable?: boolean }): FakeClient {
  const client: FakeClient = {
    url,
    focus: async () => {
      harness.focused.push(client.url);
      return client;
    },
  };
  if (options?.navigable !== false) {
    client.navigate = async (target: string) => {
      harness.navigatedTo.push(target);
      client.url = target;
      return client;
    };
  }
  return client;
}

/* ------------------------------------------------------------------- floors */

/**
 * THE QUESTION ASKED BEFORE ANY ASSERTION BELOW WAS WRITTEN: what would this
 * file report if the thing it watches were gone?
 *
 * Without these two, a `public/sw.js` that had lost its entire push half
 * would make `loadWorker()` succeed, every `dispatch` throw a clear error,
 * and... no, it would fail. But a `public/sw.js` that had lost only its
 * `showNotification` call would show nothing and several assertions below
 * would be asserting about an empty array. So the floors are explicit.
 */
describe("the file this suite is actually reading", () => {
  it("is the shipped worker and not an empty read", () => {
    expect(SOURCE.length).toBeGreaterThan(4_000);
    expect(SOURCE).toContain("showNotification");
    expect(SOURCE).toContain("CACHE_VERSION");
  });

  it("registers all three push listeners at the top level", () => {
    const harness = loadWorker();
    for (const type of ["push", "notificationclick", "pushsubscriptionchange"]) {
      expect(harness.listeners.has(type)).toBe(true);
    }
    /* And the offline half is still there. The push handlers moved INTO this
       file, and a move that quietly dropped the caching worker would be the
       exact failure the old arrangement existed to avoid. */
    for (const type of ["install", "activate", "fetch"]) {
      expect(harness.listeners.has(type)).toBe(true);
    }
  });
});

/* ------------------------------------------------------- what a person sees */

describe("what the worker shows", () => {
  it("carries the sender's title, body and destination", async () => {
    const harness = loadWorker();
    await dispatch(
      harness,
      "push",
      pushEvent({
        title: "Amara replied",
        body: "About the two bedroom in Lekki",
        href: "/messages/9f2",
        tag: "vallo-message",
        urgent: false,
      }),
    );

    expect(harness.shown).toHaveLength(1);
    expect(harness.shown[0]?.title).toBe("Amara replied");
    expect(harness.shown[0]?.options.body).toBe("About the two bedroom in Lekki");
    expect(harness.shown[0]?.options.tag).toBe("vallo-message");
    expect(harness.shown[0]?.options.data?.href).toBe("/messages/9f2");
  });

  it("A3: draws the place's photograph, and only an https one", async () => {
    const harness = loadWorker();
    await dispatch(harness, "push", pushEvent({ title: "x", body: "y", href: "/listing/a", image: "https://cdn.example/p.jpg" }));
    await dispatch(harness, "push", pushEvent({ title: "x", body: "y", href: "/listing/b", tag: "two", image: "http://cdn.example/p.jpg" }));
    await dispatch(harness, "push", pushEvent({ title: "x", body: "y", href: "/listing/c", tag: "three", image: "javascript:alert(1)" }));
    expect(harness.shown[0]?.options.image).toBe("https://cdn.example/p.jpg");
    expect(harness.shown[1]?.options.image).toBeUndefined();
    expect(harness.shown[2]?.options.image).toBeUndefined();
  });

  it("names an icon that exists in public/, which the old worker did not", async () => {
    const harness = loadWorker();
    await dispatch(harness, "push", pushEvent({ title: "x", body: "y", href: "/notifications" }));

    /* The worker this replaced named `/icons/icon-192.png` and
       `/icons/badge-72.png`. `apps/web/public/icons/` DOES NOT EXIST. Both
       404ed and both fell back to the browser's grey circle, which is the
       failure a screenshot would have caught and a source review did not. */
    expect(harness.shown[0]?.options.icon).toBe("/pwa/icon-192.png");
    expect(SOURCE).not.toContain("/icons/icon-192.png");
    expect(SOURCE).not.toContain("/icons/badge-72.png");
  });

  it("shows something even when the payload cannot be read at all", async () => {
    const harness = loadWorker();
    /* `event.data.json()` throwing is what an undecryptable or non-JSON push
       looks like from in here. A browser that receives a push its worker does
       not display may substitute its own "site updated in the background"
       notice, so there is no branch that shows nothing. */
    await dispatch(harness, "push", pushEvent(undefined));

    expect(harness.shown).toHaveLength(1);
    expect(harness.shown[0]?.title).toBe("Vallo");
    expect(harness.shown[0]?.options.data?.href).toBe("/notifications");
  });

  it("shows something when there is no payload at all", async () => {
    const harness = loadWorker();
    await dispatch(harness, "push", { data: null });
    expect(harness.shown).toHaveLength(1);
    expect(harness.shown[0]?.title).toBe("Vallo");
  });

  it("still shows when the browser cannot list what is on the screen", async () => {
    const harness = loadWorker();
    harness.getNotificationsThrows = true;
    await dispatch(harness, "push", pushEvent({ title: "Booking confirmed", href: "/bookings" }));
    expect(harness.shown).toHaveLength(1);
    expect(harness.shown[0]?.title).toBe("Booking confirmed");
  });
});

/* --------------------------------------------------- where a tap cannot go */

describe("the destination is refused a second time, here", () => {
  const offOrigin = [
    "https://evil.example/steal",
    "//evil.example/steal",
    "http://vallospaces.com.evil.example/",
    "javascript:alert(1)",
    "",
    "   ",
  ];

  for (const href of offOrigin) {
    it(`refuses ${JSON.stringify(href)} and lands on the notifications list`, async () => {
      const harness = loadWorker();
      await dispatch(harness, "push", pushEvent({ title: "t", href }));
      expect(harness.shown[0]?.options.data?.href).toBe("/notifications");
    });
  }

  it("keeps a path on our own origin, query and fragment included", async () => {
    const harness = loadWorker();
    await dispatch(
      harness,
      "push",
      pushEvent({ title: "t", href: "/listing/abc?from=push#reviews" }),
    );
    expect(harness.shown[0]?.options.data?.href).toBe("/listing/abc?from=push#reviews");
  });
});

/* ------------------------------------------------------------ money is loud */

describe("urgent and ordinary are not shown the same way", () => {
  it("re-alerts and stays on screen for an urgent one", async () => {
    const harness = loadWorker();
    await dispatch(
      harness,
      "push",
      pushEvent({ title: "Withdrawal failed", href: "/wallet", tag: "vallo-wallet", urgent: true }),
    );
    /* THE POINT. The tag is per person per kind, so a failed withdrawal
       REPLACES a credit on the same row. Replacing silently would mean the
       person never learns the second thing happened. */
    expect(harness.shown[0]?.options.renotify).toBe(true);
    expect(harness.shown[0]?.options.requireInteraction).toBe(true);
    expect(harness.shown[0]?.options.data?.urgent).toBe(true);
  });

  it("replaces quietly for an ordinary one", async () => {
    const harness = loadWorker();
    await dispatch(harness, "push", pushEvent({ title: "Amara replied", tag: "vallo-message" }));
    expect(harness.shown[0]?.options.renotify).toBe(false);
    expect(harness.shown[0]?.options.requireInteraction).toBe(false);
  });
});

/* ------------------------------------------------ two, and then four, at once */

describe("what happens when several arrive", () => {
  it("leaves three ordinary notifications alone", async () => {
    const harness = loadWorker();
    harness.displayed = [
      displayedNotification(harness, "vallo-booking", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-listing", { urgent: false, count: 1 }),
    ];
    await dispatch(harness, "push", pushEvent({ title: "Amara replied", tag: "vallo-message" }));

    expect(harness.closedTags).toEqual([]);
    expect(harness.shown[0]?.title).toBe("Amara replied");
  });

  it("folds the fourth into one summary and closes the rest", async () => {
    const harness = loadWorker();
    harness.displayed = [
      displayedNotification(harness, "vallo-booking", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-listing", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-social", { urgent: false, count: 1 }),
    ];
    await dispatch(harness, "push", pushEvent({ title: "Amara replied", tag: "vallo-message" }));

    expect(harness.closedTags).toEqual(["vallo-booking", "vallo-listing", "vallo-social"]);
    expect(harness.shown).toHaveLength(1);
    expect(harness.shown[0]?.title).toBe("Vallo");
    expect(harness.shown[0]?.options.body).toBe("4 things happened while you were away");
    expect(harness.shown[0]?.options.tag).toBe("vallo-summary");
    /* THE LIST, NOT THE NEWEST ITEM. A summary that opens one of the four
       hides the other three. */
    expect(harness.shown[0]?.options.data?.href).toBe("/notifications");
  });

  it("counts a summary as everything it already stands for", async () => {
    const harness = loadWorker();
    harness.displayed = [
      displayedNotification(harness, "vallo-summary", { urgent: false, count: 4 }),
    ];
    await dispatch(harness, "push", pushEvent({ title: "Amara replied", tag: "vallo-message" }));

    expect(harness.shown[0]?.options.body).toBe("5 things happened while you were away");
    expect(harness.shown[0]?.options.data?.count).toBe(5);
  });

  it("does not count a replacement as an arrival", async () => {
    const harness = loadWorker();
    /* Three messages in ONE conversation share a tag and are one row. If the
       arithmetic counted each as new, three replies would collapse the shade,
       which is the exact thing the tag exists to prevent. */
    harness.displayed = [
      displayedNotification(harness, "vallo-message", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-booking", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-listing", { urgent: false, count: 1 }),
    ];
    await dispatch(harness, "push", pushEvent({ title: "Amara replied again", tag: "vallo-message" }));

    expect(harness.closedTags).toEqual([]);
    expect(harness.shown[0]?.title).toBe("Amara replied again");
  });

  it("never folds an urgent one and never closes one", async () => {
    const harness = loadWorker();
    harness.displayed = [
      displayedNotification(harness, "vallo-wallet", { urgent: true, count: 1 }),
      displayedNotification(harness, "vallo-booking", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-listing", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-social", { urgent: false, count: 1 }),
    ];
    await dispatch(
      harness,
      "push",
      pushEvent({ title: "Withdrawal reversed", tag: "vallo-wallet", urgent: true, href: "/wallet" }),
    );

    /* The arriving urgent one is shown as itself, and the four already there,
       urgent or not, are untouched. */
    expect(harness.closedTags).toEqual([]);
    expect(harness.shown[0]?.title).toBe("Withdrawal reversed");
  });

  it("does not close an urgent one when it folds the ordinary ones", async () => {
    const harness = loadWorker();
    harness.displayed = [
      displayedNotification(harness, "vallo-wallet", { urgent: true, count: 1 }),
      displayedNotification(harness, "vallo-booking", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-listing", { urgent: false, count: 1 }),
      displayedNotification(harness, "vallo-social", { urgent: false, count: 1 }),
    ];
    await dispatch(harness, "push", pushEvent({ title: "Amara replied", tag: "vallo-message" }));

    expect(harness.closedTags).toEqual(["vallo-booking", "vallo-listing", "vallo-social"]);
    /* Four ordinary events, not five: the reversed withdrawal is still its
       own row and is not silently counted into "things that happened". */
    expect(harness.shown[0]?.options.body).toBe("4 things happened while you were away");
  });
});

/* --------------------------------------------------------------- the tap */

describe("where a tap lands", () => {
  it("focuses a tab already on that exact page, without navigating it", async () => {
    const harness = loadWorker();
    const onPage = openTab(harness, `${ORIGIN}/messages/9f2`);
    const elsewhere = openTab(harness, `${ORIGIN}/home`);
    harness.clientList = [elsewhere, onPage];

    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "/messages/9f2" }));

    /* NOT navigated. A person with a half-typed reply open keeps it. */
    expect(harness.navigatedTo).toEqual([]);
    expect(harness.focused).toEqual([`${ORIGIN}/messages/9f2`]);
    expect(harness.openedWindows).toEqual([]);
  });

  it("navigates an open Vallo tab rather than opening a second one", async () => {
    const harness = loadWorker();
    harness.clientList = [openTab(harness, `${ORIGIN}/home`)];

    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "/wallet" }));

    expect(harness.navigatedTo).toEqual([`${ORIGIN}/wallet`]);
    expect(harness.focused).toEqual([`${ORIGIN}/wallet`]);
    expect(harness.openedWindows).toEqual([]);
  });

  it("opens a window when no Vallo tab is open", async () => {
    const harness = loadWorker();
    harness.clientList = [];

    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "/bookings/77" }));

    expect(harness.openedWindows).toEqual([`${ORIGIN}/bookings/77`]);
  });

  it("ignores a tab on another origin", async () => {
    const harness = loadWorker();
    /* An embedded frame, or a payment processor's window left open. It is not
       ours to navigate and it is not ours to focus. */
    harness.clientList = [openTab(harness, "https://checkout.paystack.com/x")];

    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "/wallet" }));

    expect(harness.navigatedTo).toEqual([]);
    expect(harness.focused).toEqual([]);
    expect(harness.openedWindows).toEqual([`${ORIGIN}/wallet`]);
  });

  it("falls back to focusing when a tab refuses to be navigated", async () => {
    const harness = loadWorker();
    harness.clientList = [openTab(harness, `${ORIGIN}/home`, { navigable: false })];

    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "/wallet" }));

    expect(harness.focused).toEqual([`${ORIGIN}/home`]);
    expect(harness.openedWindows).toEqual([]);
  });

  it("refuses an off-origin destination that somehow reached the data bag", async () => {
    const harness = loadWorker();
    harness.clientList = [];
    /* Belt and braces: the push handler already refused this before it was
       stored. A second check costs nothing and is the difference between one
       mistake and an open redirect through a lock screen. */
    await dispatch(harness, "notificationclick", clickEvent(harness, { href: "https://evil.example" }));

    expect(harness.openedWindows).toEqual([`${ORIGIN}/notifications`]);
  });

  it("lands on the notifications list when the data bag is empty", async () => {
    const harness = loadWorker();
    harness.clientList = [];
    await dispatch(harness, "notificationclick", { notification: { data: null, close: () => {} } });
    expect(harness.openedWindows).toEqual([`${ORIGIN}/notifications`]);
  });
});

/* ------------------------------------------- the subscription that rotates */

describe("a subscription replaced behind the person's back", () => {
  it("sends the new one straight back, with cookies", async () => {
    const harness = loadWorker();
    await dispatch(harness, "pushsubscriptionchange", {
      oldSubscription: { options: { applicationServerKey: new Uint8Array([1, 2, 3]) } },
      newSubscription: null,
    });

    expect(harness.posted).toHaveLength(1);
    expect(harness.posted[0]?.url).toBe("/api/push/register");
    expect(harness.posted[0]?.body.platform).toBe("web");
    expect(harness.posted[0]?.body.p256dh).toBe("P");
    expect(harness.posted[0]?.body.auth).toBe("A");
  });

  it("does nothing, rather than throwing, when there is nothing to re-subscribe with", async () => {
    const harness = loadWorker();
    await dispatch(harness, "pushsubscriptionchange", {
      oldSubscription: null,
      newSubscription: null,
    });
    expect(harness.posted).toEqual([]);
  });
});
