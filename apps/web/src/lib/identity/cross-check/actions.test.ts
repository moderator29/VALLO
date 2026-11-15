import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type Script } from "@/lib/testing/fake-supabase";
import { bvnHmac, ninHmac } from "../nin";
import { jpeg } from "./image-fixtures";

/*
 * The two server calls behind the panel: who may make them, what they keep,
 * what they write to the audit trail, and that an ID number never leaves the
 * call in any form but its keyed hash.
 */
const STAFF = "99999999-9999-4999-8999-999999999999";
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DOCUMENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY = "k".repeat(40);
const NIN = "12345678901";
const NO_TABLE = { data: null, error: { code: "PGRST205", message: "not in the schema cache" } };

const seam = vi.hoisted(() => ({
  access: { state: "admin", user: { id: "" } } as { state: string; user?: { id: string } },
  scopes: [] as (string | undefined)[],
  script: {} as Record<string, unknown>,
  fake: null as unknown,
  audits: [] as Record<string, unknown>[],
  adminThrows: false,
  files: {} as Record<string, Uint8Array>,
}));

vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async (scope?: string) => {
    seam.scopes.push(scope);
    return seam.access;
  },
  adminRefusal: (access: { state: string }) => `refused: ${access.state}`,
}));
vi.mock("@/lib/admin/audit", () => ({
  writeAudit: async (_client: unknown, entry: Record<string, unknown>) => {
    seam.audits.push(entry);
    return true;
  },
}));
vi.mock("@/lib/photo-hash/hash-server", () => ({ greyPixels: async () => new Uint8Array(72) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (seam.adminThrows) throw new Error("no service key");
    const fake = seam.fake as ReturnType<typeof fakeSupabase>;
    return {
      ...fake.client,
      storage: { from: () => ({ download: async (path: string) => (seam.files[path] ? { data: new Blob([seam.files[path] as BlobPart]), error: null } : { data: null, error: {} }) }) },
    };
  },
}));

const { compareIdNumber, runCrossChecks } = await import("./actions");

function stage(script: Script): ReturnType<typeof fakeSupabase> {
  const fake = fakeSupabase(script);
  seam.fake = fake;
  return fake;
}

const OWNED = { agent_documents: { select: { data: { kind: "identity", uploader_id: SUBJECT, application_id: null } } } };

beforeEach(() => {
  seam.access = { state: "admin", user: { id: STAFF } };
  seam.scopes = [];
  seam.audits = [];
  seam.adminThrows = false;
  seam.files = {};
  stage({});
  vi.stubEnv("VALLO_NIN_HMAC_KEY", KEY);
});

describe("running the cross-checks for one person", () => {
  it("is behind the kyc_review door, and a refusal reads nothing", async () => {
    seam.access = { state: "not-admin" };
    const fake = stage({});
    expect(await runCrossChecks(SUBJECT)).toEqual({ state: "refused", message: "refused: not-admin" });
    expect(seam.scopes).toEqual(["kyc_review"]);
    expect(fake.calls).toEqual([]);
    expect(seam.audits).toEqual([]);
  });

  it("refuses a reviewer's own account, and anything that is not an id", async () => {
    expect(await runCrossChecks(STAFF)).toEqual({ state: "refused", message: "This is your own account, so somebody else has to review it." });
    expect(await runCrossChecks("../../etc")).toEqual({ state: "failed" });
    expect(await runCrossChecks(undefined as unknown as string)).toEqual({ state: "failed" });
    expect(seam.audits).toEqual([]);
  });

  it("answers with findings and writes one audit row of counts, with nothing personal in it", async () => {
    seam.files[`${SUBJECT}/front.jpg`] = jpeg({ exif: { software: "Adobe Photoshop" } });
    stage({
      agent_documents: {
        select: (call) =>
          call.filters.some(([, column]) => column === "review_status")
            ? { data: [] }
            : { data: [{ id: DOCUMENT, kind: "identity", subtype: "nin_card", storage_path: `${SUBJECT}/front.jpg`, back_storage_path: null, uploaded_at: "2026-11-14T10:00:00Z" }] },
      },
      agent_applications: { select: { data: [] } },
      kyc_document_fingerprints: { upsert: { error: null }, select: { data: [] } },
      kyc_id_number_marks: { select: (call) => (call.filters.some(([, column]) => column === "owner_id" && call.filters.length === 1) ? { data: [{ number_hmac: "a".repeat(64) }] } : { data: [{ owner_id: OTHER }] }) },
      identity_verifications: { select: { data: [] } },
      identity_checks: { select: { data: [] } },
      confirmed_phones: { select: { data: [] } },
      profiles: { select: { data: { created_at: new Date().toISOString() } } },
    });
    const report = await runCrossChecks(SUBJECT);
    if (report.state !== "ok") throw new Error(`expected ok, got ${report.state}`);
    expect(report.findings[0]).toMatchObject({ key: "id_number.shared", level: "stop", title: "This ID number is on 1 other account" });
    expect(report.findings.find((f) => f.key === "file.front.editor")!.title).toBe("The front image was saved by an editing app (Photoshop)");
    expect(report.findings.find((f) => f.key === "account.phone")!.level).toBe("look");
    expect(seam.audits).toEqual([
      { actorId: STAFF, action: "kyc.cross_checks.run", entityType: "user", entityId: SUBJECT, detail: { stop: 1, look: 2, not_run: 0 } },
    ]);
  });

  it("answers failed, never an exception, when the service client cannot be made", async () => {
    seam.adminThrows = true;
    expect(await runCrossChecks(SUBJECT)).toEqual({ state: "failed" });
  });

  it("still answers when every table is down: each line says it could not run", async () => {
    const down = { select: "throw" as const, upsert: "throw" as const };
    stage({ agent_documents: down, agent_applications: down, kyc_id_number_marks: down, confirmed_phones: down, profiles: down });
    const report = await runCrossChecks(SUBJECT);
    if (report.state !== "ok") throw new Error("expected ok");
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every((f) => f.notRun)).toBe(true);
  });
});

describe("comparing a typed ID number", () => {
  const input = { documentId: DOCUMENT, kind: "nin", number: "1234 5678 901" };

  it("is behind the kyc_review door", async () => {
    seam.access = { state: "signed-out" };
    const fake = stage(OWNED);
    expect(await compareIdNumber(input)).toEqual({ ok: false, error: "refused: signed-out" });
    expect(seam.scopes).toEqual(["kyc_review"]);
    expect(fake.calls).toEqual([]);
  });

  it("refuses a bad document id, an unknown kind and an empty or absurd number before touching the database", async () => {
    const fake = stage(OWNED);
    expect((await compareIdNumber({ ...input, documentId: "nope" })).ok).toBe(false);
    expect((await compareIdNumber({ ...input, kind: "ssn" })).ok).toBe(false);
    expect((await compareIdNumber({ ...input, number: "  " })).ok).toBe(false);
    expect((await compareIdNumber({ ...input, number: "12" })).ok).toBe(false);
    expect((await compareIdNumber({ ...input, number: "1".repeat(40) })).ok).toBe(false);
    expect((await compareIdNumber(null as unknown as typeof input)).ok).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(seam.audits).toEqual([]);
  });

  it("says so, and keeps nothing, when the server has no key fit to use", async () => {
    vi.stubEnv("VALLO_NIN_HMAC_KEY", "short");
    const fake = stage(OWNED);
    const result = await compareIdNumber(input);
    expect(result).toEqual({ ok: false, error: "Comparing ID numbers is not set up on this server yet. Nothing was saved. Carry on with the other checks." });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a document that is gone, is not an ID, or is the reviewer's own", async () => {
    stage({ agent_documents: { select: { data: null } } });
    expect(await compareIdNumber(input)).toEqual({ ok: false, error: "That document is no longer here. Reload the page." });
    stage({ agent_documents: { select: { data: { kind: "address", uploader_id: SUBJECT, application_id: null } } } });
    expect((await compareIdNumber(input)).ok).toBe(false);
    const own = stage({ agent_documents: { select: { data: { kind: "identity", uploader_id: STAFF, application_id: null } } } });
    expect(await compareIdNumber(input)).toEqual({ ok: false, error: "This is your own account, so somebody else has to review it." });
    expect(own.wrote()).toBe(false);
  });

  it("keeps only the keyed hash of the number, the same hash the vNIN route makes", async () => {
    const fake = stage({ ...OWNED, kyc_id_number_marks: { upsert: { error: null }, select: { data: [] } }, identity_verifications: { select: { data: [] } }, identity_checks: { select: { data: [] } } });
    const result = await compareIdNumber(input);
    expect(result).toEqual({ ok: true, findings: [expect.objectContaining({ key: "id_number.shared", level: "ok", title: "This ID number is on no other account" })] });
    const kept = fake.of("kyc_id_number_marks", "upsert")[0]!.values as Record<string, unknown>;
    expect(kept).toEqual({ document_id: DOCUMENT, owner_id: SUBJECT, id_type: "nin", number_hmac: ninHmac(NIN, KEY), recorded_by: STAFF });
    /* Nothing sent to the database, returned or audited carries the number. */
    const everything = JSON.stringify([fake.calls, result, seam.audits]);
    expect(everything).not.toContain(NIN);
    expect(everything).not.toContain("1234 5678 901");
    expect(seam.audits).toEqual([
      { actorId: STAFF, action: "kyc.id_number.compared", entityType: "agent_documents", entityId: DOCUMENT, detail: { id_type: "nin", kept: true, shared: false } },
    ]);
    expect(JSON.stringify(seam.audits)).not.toContain(ninHmac(NIN, KEY));
  });

  it("stops when another account carries the same number, linking to it and naming nobody", async () => {
    stage({ ...OWNED, kyc_id_number_marks: { upsert: { error: null }, select: { data: [{ owner_id: OTHER }] } }, identity_verifications: { select: { data: [] } }, identity_checks: { select: { data: [] } } });
    const result = await compareIdNumber(input);
    if (!result.ok) throw new Error(result.error);
    expect(result.findings[0]).toMatchObject({ level: "stop", title: "This ID number is on 1 other account", links: [{ href: `/admin/people/${OTHER}`, label: "Open the other account" }] });
    expect(seam.audits[0]!.detail).toEqual({ id_type: "nin", kept: true, shared: true });
  });

  it("uses the BVN hash for a BVN and a prefixed hash for the other documents", async () => {
    const bvn = stage({ ...OWNED, kyc_id_number_marks: { upsert: { error: null }, select: { data: [] } } });
    await compareIdNumber({ ...input, kind: "bvn", number: "22123456789" });
    expect((bvn.of("kyc_id_number_marks", "upsert")[0]!.values as { number_hmac: string }).number_hmac).toBe(bvnHmac("22123456789", KEY));
    const passport = stage({ ...OWNED, kyc_id_number_marks: { upsert: { error: null }, select: { data: [] } } });
    await compareIdNumber({ ...input, kind: "passport", number: "a 1234 5678" });
    const hash = (passport.of("kyc_id_number_marks", "upsert")[0]!.values as { number_hmac: string }).number_hmac;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(ninHmac(NIN, KEY));
  });

  it("before the SQL has run, still compares a NIN with the older records and says the hash was not kept", async () => {
    stage({ ...OWNED, kyc_id_number_marks: { upsert: NO_TABLE, select: NO_TABLE }, identity_verifications: { select: { data: [{ subject_id: OTHER }] } }, identity_checks: { select: { data: [] } } });
    const result = await compareIdNumber(input);
    if (!result.ok) throw new Error(result.error);
    expect(result.findings.map((f) => [f.key, f.level, f.notRun ?? false])).toEqual([
      ["id_number.shared", "stop", false],
      ["id_number.kept", "look", true],
    ]);
    expect(seam.audits[0]!.detail).toEqual({ id_type: "nin", kept: false, shared: true });
  });

  it("before the SQL has run, a passport number has nothing to be compared with, and says not available yet", async () => {
    stage({ ...OWNED, kyc_id_number_marks: { upsert: NO_TABLE, select: NO_TABLE } });
    const result = await compareIdNumber({ ...input, kind: "passport", number: "A12345678" });
    expect(result).toEqual({ ok: true, findings: [expect.objectContaining({ key: "id_number.shared", notRun: true, title: "Not available yet: the same ID number on another account" })] });
  });

  it("answers a plain sentence, never an exception, when the database is down", async () => {
    stage({ agent_documents: { select: "throw" } });
    expect(await compareIdNumber(input)).toEqual({ ok: false, error: "That number could not be compared just now. Nothing was saved. Try again in a moment." });
    seam.adminThrows = true;
    expect((await compareIdNumber(input)).ok).toBe(false);
  });
});
