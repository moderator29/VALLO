import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE CONTROL: THE SAME ROUTES, CARRYING A SESSION, THROUGH THE REAL GUARD.
 *
 * ===========================================================================
 * WHY THIS FILE HAD TO EXIST BEFORE THE GATE COULD BE CALLED PROVEN
 * ===========================================================================
 *
 * A GATE THAT REFUSES EVERYBODY PASSES A TEST THAT ONLY CHECKS REFUSALS.
 * `tests/gate.spec.mjs` watches forty-one product routes bounce an anonymous
 * visitor to `/sign-in`, and every one of those rows is equally green over a
 * middleware that redirects the entire platform, including its owners. That
 * would be a catastrophe reported as a clean run.
 *
 * So the same list is put through `proxy()` again with a session attached, and
 * every route that bounced must now not bounce.
 *
 * ===========================================================================
 * IT DRIVES THE REAL MIDDLEWARE, NOT A MODEL OF IT
 * ===========================================================================
 *
 * `src/proxy.test.ts` asserts `isPublicPath`, which is the DECISION. This
 * calls `proxy()` itself: the real `createServerClient`, the real cookie
 * adapter, a real `getUser()` over HTTP, the real branch, the real response.
 * The difference matters, because `isPublicPath` can be perfect while the
 * middleware never consults it, and no test of a pure function can see that.
 *
 * WHAT STANDS IN FOR SUPABASE, AND WHAT THAT COSTS. This container's egress
 * proxy answers `CONNECT <project>.supabase.co:443` with 403, so no real
 * session can be obtained here at all. A local stand-in serves the ONE
 * endpoint `proxy()` calls, `GET /auth/v1/user`, and the cookie is minted by
 * the same library the middleware reads it with, so a cookie the server would
 * silently fail to parse cannot be mistaken for a session.
 *
 * NOTHING HERE IS A CREDENTIAL. The JWT is unsigned, the address is
 * `example.invalid`, the id is all ones, and it only satisfies a client
 * pointed at `127.0.0.1`.
 *
 * ===========================================================================
 * WHAT THIS PROVES, AND WHAT IT EXPLICITLY DOES NOT
 * ===========================================================================
 *
 * PROVES: the guard admits a request carrying a session on every route it
 * refuses without one, answers the API routes rather than refusing them, and
 * still lets the public routes through.
 *
 * DOES NOT PROVE: that those pages RENDER for a signed-in reader. A page past
 * the middleware reads data, and past this stand-in there is no data, so a
 * data-backed screen would draw its empty or not-found state for reasons that
 * have nothing to do with the gate. That half is UNPROVEN in this container
 * and is closed by one signed-in reload of the live site. Saying so is the
 * point: presenting an unreachable claim as a green row is the fault this
 * whole file exists to avoid.
 */

/** An invented reader. Not a person, not an account, not a credential. */
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "reviewer@example.invalid",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Structurally valid, deliberately unsigned. The stand-in verifies nothing. */
function accessToken(expiresAt: number): string {
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: USER.id,
      aud: "authenticated",
      role: "authenticated",
      email: USER.email,
      iss: "gate-control",
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: expiresAt,
    }),
    Buffer.from("unsigned").toString("base64url"),
  ].join(".");
}

/**
 * Every route the signed-out walk refuses, plus the data routes and the
 * public ones.
 *
 * Kept in step with `tests/gate.spec.mjs` by hand and on purpose. Two lists
 * that drift are two lists, and a control that walked a shorter list than the
 * refusal pass would be a control with holes exactly where nobody looked.
 */
const PRODUCT = [
  "/home",
  "/search",
  "/search?view=map",
  "/listing/anything",
  "/around",
  "/around/yaba-unilag",
  "/stays",
  "/stays/search",
  "/stay/anything",
  "/restaurants",
  "/restaurant/anything",
  "/rent",
  "/price",
  "/price/area/anything",
  "/u",
  /* `/u/somebody` moved to PUBLIC on 9 November 2026 (the bare profile page);
     its sub-routes stay here. */
  "/u/somebody/edit",
  "/post/anything",
  "/saved",
  "/messages",
  "/notifications",
  "/profile",
  "/settings",
  "/settings/passcode",
  "/wallet",
  "/bookings",
  "/checkout/anything",
  "/trips",
  "/host",
  "/escrow",
  "/inspections",
  "/verification",
  "/assistant",
  "/stories",
  "/crypto",
  "/legal/privacy",
  "/legal/terms",
  "/admin",
  "/admin/support",
  "/agent/dashboard",
  "/agent/listings",
  "/agent/bookings",
  /* The workspaces' own assistant, settings and bell (29 September 2026). */
  "/agent/assistant",
  "/host/assistant",
  "/host/settings",
  "/host/notifications",
  "/styleguide",
];

const API_CLOSED = [
  "/api/map/listings?west=3&south=6&east=4&north=7",
  "/api/crypto/markets",
  "/api/crypto/pairs",
  "/api/crypto/coins/bitcoin",
  "/api/assistant",
  "/api/documents/anything",
  "/api/push/register",
  "/api/push/revoke",
  "/api/push/self-test",
  "/api/passcode/touch",
];

const PUBLIC = [
  /* The public half of the VAPID pair. Shut until 23 September, which is why
     push_tokens had zero rows: no browser could ever reach the key it needs to
     subscribe with. */
  "/api/push/key",
  "/",
  "/about",
  "/careers",
  "/contact",
  "/help",
  "/docs",
  "/docs/what-vallo-is",
  "/cancellations",
  "/eula",
  "/privacy",
  "/safety",
  "/standards",
  "/terms",
  "/delete-account",
  "/offline",
  "/sign-in",
  "/sign-up",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/welcome",
  "/robots.txt",
  "/sitemap.xml",
  /* The two pages the founder opened on 9 November 2026 so a forwarded link
     unfurls as its own card (SHARE_AND_CONTROLS.md 1.2): the bare profile page
     and the bare Circle post page. Each reads public data only. */
  "/u/somebody",
  "/circle/p/6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
];

/*
 * The stand-in listens on a port the operating system picks. A fixed port
 * collided whenever two copies of this suite ran on one machine (two
 * worktrees, or CI beside a local run): the second `listen` raised
 * EADDRINUSE, nothing handled it, and the whole file failed at collection.
 */
let STUB = "";

let server: Server;
let cookieHeader = "";
let proxy: (request: Request) => Promise<Response>;
let NextRequest: typeof import("next/server").NextRequest;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/auth/v1/user") {
      res.end(JSON.stringify(USER));
      return;
    }
    /* Everything else is refused loudly rather than faked, so nothing this
       file reports can be traced back to a convenient invention. */
    res.statusCode = 404;
    res.end(JSON.stringify({ stub: "serves /auth/v1/user only", path: url.pathname }));
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("the stand-in reported no port"));
    });
  });
  STUB = `http://127.0.0.1:${port}`;

  /* Set BEFORE the module is loaded: `lib/supabase/env.ts` reads
     `process.env` at module scope, so an import above this line would arm the
     guard against the wrong address. */
  process.env.NEXT_PUBLIC_SUPABASE_URL = STUB;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "stub-anon-key";

  const { createServerClient } = await import("@supabase/ssr");
  const jar: { name: string; value: string }[] = [];
  const client = createServerClient(STUB, "stub-anon-key", {
    cookies: {
      getAll: () => jar,
      setAll: (list) => {
        for (const cookie of list) jar.push({ name: cookie.name, value: cookie.value });
      },
    },
  });
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  /* Two fields and no more. `setSession` accepts exactly this pair by its own
     type, reads the expiry out of the token itself, and asks the stand-in's
     `/auth/v1/user` for the reader. Handing it a whole session object works at
     runtime and does not typecheck, which is how this was caught: the first
     version passed one, `npx tsc --noEmit` failed in the clean worktree, and
     the shared tree had never been asked. */
  const { error } = await client.auth.setSession({
    access_token: accessToken(expiresAt),
    refresh_token: "unsigned-refresh",
  });
  if (error) throw new Error(`the stand-in could not mint a session: ${error.message}`);
  if (jar.length === 0) throw new Error("no cookie was written, so there is nothing to walk with");
  cookieHeader = jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

  ({ proxy } = (await import("./proxy")) as unknown as {
    proxy: (request: Request) => Promise<Response>;
  });
  ({ NextRequest } = await import("next/server"));
  /* Loading the middleware pulls in most of the server graph, which takes
     well over the 10 s hook default on a machine running several suites. */
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** One request through the real middleware, with or without the session. */
async function ask(path: string, withSession: boolean) {
  const request = new NextRequest(`http://127.0.0.1${path}`, {
    headers: withSession ? { cookie: cookieHeader } : {},
  });
  const response = await proxy(request as unknown as Request);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
  };
}

/* Each case walks up to forty-one routes through the real middleware, one
   HTTP round trip to the stand-in each: tens of milliseconds idle, seconds
   under a loaded machine, so the 5 s default is not a budget for it. */
describe("the gate admits a session, which is the half a refusal test cannot see", { timeout: 30_000 }, () => {
  it("is armed at all, and refuses without the session", async () => {
    /* THE INSTRUMENT PROVES ITSELF FIRST. If the guard were a pass-through
       here, because the environment was not set in time or Supabase read as
       unconfigured, every assertion below would pass over a middleware that
       does nothing. This is the assertion that says the branch is live. */
    const anonymous = await ask("/home", false);
    expect(anonymous.status, "the guard is not armed, so nothing below means anything").toBe(307);
    expect(anonymous.location).toContain("/sign-in");
  });

  it("lets a session through every route it bounces an anonymous visitor from", async () => {
    const refused: string[] = [];
    for (const path of PRODUCT) {
      const answer = await ask(path, true);
      if (answer.location.includes("/sign-in")) {
        refused.push(`${path} was still sent to ${answer.location}`);
      }
    }
    expect(refused, "the gate refuses its own users").toEqual([]);
  });

  it("answers the data routes for a session rather than refusing them", async () => {
    const shut: string[] = [];
    for (const path of API_CLOSED) {
      const answer = await ask(path, true);
      if (answer.status === 401) shut.push(`${path} answered 401`);
    }
    expect(shut, "a signed-in caller cannot reach the platform's own data routes").toEqual([]);
  });

  it("still refuses every one of those data routes without a session", async () => {
    /* The other direction of the same pair, because "the API answers a
       session" is also true of an API that answers everybody. */
    const open: string[] = [];
    for (const path of API_CLOSED) {
      const answer = await ask(path, false);
      if (answer.status !== 401) open.push(`${path} answered ${answer.status}`);
    }
    expect(open, "a stranger can still fetch product data").toEqual([]);
  });

  it("leaves the public routes open to a session too", async () => {
    const closed: string[] = [];
    for (const path of PUBLIC) {
      const answer = await ask(path, true);
      if (answer.location.includes("/sign-in")) closed.push(`${path} was sent to sign-in`);
    }
    expect(closed).toEqual([]);
  });
});
