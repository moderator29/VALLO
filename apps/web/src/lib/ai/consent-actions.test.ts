import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CONSENT_COOKIE, AI_CONSENT_VERSION, consentCookieValue } from "./consent";

/**
 * STORE-07: agreement to the AI disclosure can be taken back from Settings,
 * Privacy (`AiConsentCard`). Withdrawing clears both halves of the record,
 * so the gate the assistant and the routes read (`hasAiConsent`) answers no
 * and the assistant asks again before anything is sent.
 */

vi.mock("server-only", () => ({}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

/** One profile row, with the reads and writes the actions make against it. */
const db = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  readError: null as unknown,
  writeError: null as unknown,
  writes: [] as unknown[],
  signedIn: true,
}));

function client() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: db.readError ? null : { settings: db.settings }, error: db.readError }),
    update: (patch: { settings: Record<string, unknown> }) => {
      db.writes.push(patch);
      if (!db.writeError) db.settings = patch.settings;
      return { eq: async () => ({ error: db.writeError }) };
    },
  };
  return { from: () => chain } as never;
}

vi.mock("@/lib/actions/session", () => ({
  resolveSession: async () =>
    db.signedIn
      ? { state: "signed-in", supabase: client(), user: { id: "u1" } }
      : { state: "signed-out" },
}));

const { recordAiConsent, withdrawAiConsent } = await import("./consent-actions");
const { hasAiConsent } = await import("./consent-server");

beforeEach(() => {
  jar.clear();
  db.settings = {};
  db.readError = null;
  db.writeError = null;
  db.writes = [];
  db.signedIn = true;
});

describe("STORE-07: withdrawing agreement to the AI disclosure", () => {
  it("signed in, clears the account record and the cookie, and the gate then says no", async () => {
    await recordAiConsent();
    expect(await hasAiConsent({ supabase: client(), userId: "u1" })).toBe(true);
    expect(jar.has(AI_CONSENT_COOKIE)).toBe(true);

    expect(await withdrawAiConsent()).toEqual({ ok: true, data: null });

    expect(jar.has(AI_CONSENT_COOKIE)).toBe(false);
    expect(db.settings.aiConsent).toBeNull();
    expect(await hasAiConsent({ supabase: client(), userId: "u1" })).toBe(false);
  });

  it("keeps every other setting on the account", async () => {
    db.settings = {
      dataSaver: true,
      aiConsent: { version: AI_CONSENT_VERSION, at: "2026-09-24T10:00:00.000Z" },
    };
    await withdrawAiConsent();
    expect(db.settings.dataSaver).toBe(true);
    expect(db.settings.aiConsent).toBeNull();
  });

  it("signed out, removes this device's cookie", async () => {
    db.signedIn = false;
    jar.set(AI_CONSENT_COOKIE, consentCookieValue());
    expect(await hasAiConsent({})).toBe(true);
    expect(await withdrawAiConsent()).toEqual({ ok: true, data: null });
    expect(await hasAiConsent({})).toBe(false);
    expect(db.writes).toHaveLength(0);
  });

  it("reports a failed account write instead of claiming it is withdrawn", async () => {
    db.settings = { aiConsent: { version: AI_CONSENT_VERSION, at: "2026-09-24T10:00:00.000Z" } };
    db.writeError = { message: "down" };
    expect((await withdrawAiConsent()).ok).toBe(false);
  });

  it("does not overwrite the settings it could not read", async () => {
    db.readError = { message: "down" };
    expect((await withdrawAiConsent()).ok).toBe(false);
    expect(db.writes).toHaveLength(0);
  });
});
