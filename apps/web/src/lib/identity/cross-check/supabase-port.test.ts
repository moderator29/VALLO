import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fakeSupabase, type Call, type Script } from "@/lib/testing/fake-supabase";
import { FINGERPRINTS, NUMBER_MARKS, PICTURE_PAGES, supabasePort, tableMissing, type LooseClient } from "./supabase-port";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NO_TABLE = { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.x' in the schema cache" } };
const DOWN = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };

function make(script: Script, files: Record<string, Uint8Array | null> = {}) {
  const fake = fakeSupabase(script);
  const downloads: string[] = [];
  const client = {
    ...fake.client,
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          downloads.push(`${bucket}:${path}`);
          const bytes = files[path];
          return bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: "not found" } };
        },
      }),
    },
  } as unknown as LooseClient;
  const port = supabasePort(client, { greyPixels: async (bytes) => Array.from({ length: 72 }, (_, i) => (bytes[0]! + i) % 256) });
  return { port, fake, downloads };
}

const has = (call: Call, kind: string, column: string) => call.filters.some(([k, c]) => k === kind && c === column);

describe("their own documents", () => {
  it("reads the rows they uploaded and the older rows filed through an application, once each", async () => {
    const { port, fake } = make({
      agent_documents: {
        select: (call) =>
          has(call, "eq", "uploader_id")
            ? { data: [{ id: "d1", kind: "identity", subtype: "passport", storage_path: `${SUBJECT}/a.jpg`, back_storage_path: null, uploaded_at: "2026-11-14T10:00:00Z" }] }
            : {
                data: [
                  { id: "d1", kind: "identity", subtype: "passport", storage_path: `${SUBJECT}/a.jpg`, back_storage_path: null, uploaded_at: "2026-11-14T10:00:00Z" },
                  { id: "d0", kind: "address", subtype: null, storage_path: `${SUBJECT}/old.pdf`, back_storage_path: null, uploaded_at: "2026-09-01T10:00:00Z" },
                  { id: "dx", kind: "address", subtype: null, storage_path: null, back_storage_path: null, uploaded_at: "2026-09-01T10:00:00Z" },
                ],
              },
      },
      agent_applications: { select: { data: [{ id: "app-1" }] } },
    });
    const docs = await port.documents(SUBJECT);
    expect(docs.map((d) => d.id)).toEqual(["d1", "d0"]);
    expect(docs[0]).toEqual({ id: "d1", kind: "identity", subtype: "passport", storagePath: `${SUBJECT}/a.jpg`, backStoragePath: null, uploadedAt: "2026-11-14T10:00:00Z" });
    const older = fake.of("agent_documents", "select")[1]!;
    expect(older.filters).toContainEqual(["in", "application_id", ["app-1"]]);
    expect(older.filters).toContainEqual(["is", "uploader_id", null]);
  });

  it("throws when the read fails, so the desk can say the check could not run", async () => {
    const { port } = make({ agent_documents: { select: DOWN } });
    await expect(port.documents(SUBJECT)).rejects.toThrow();
  });

  it("downloads from the private bucket and answers null for a file that is not there", async () => {
    const { port, downloads } = make({}, { "a/b.jpg": Uint8Array.from([1, 2, 3]) });
    expect([...(await port.download("a/b.jpg"))!]).toEqual([1, 2, 3]);
    expect(await port.download("a/missing.jpg")).toBeNull();
    expect(downloads).toEqual(["agent-documents:a/b.jpg", "agent-documents:a/missing.jpg"]);
  });
});

describe("fingerprints", () => {
  const row = { documentId: "d1", side: "front" as const, ownerId: SUBJECT, kind: "identity", sha256: "a".repeat(64), dhash: "00000000000000ff", byteSize: 1234 };

  it("upserts one row per file, keyed by document and side", async () => {
    const { port, fake } = make({ [FINGERPRINTS]: { upsert: { error: null } } });
    expect(await port.saveFingerprints([row])).toBe("saved");
    expect(fake.of(FINGERPRINTS, "upsert")[0]!.values).toEqual([
      { document_id: "d1", side: "front", owner_id: SUBJECT, kind: "identity", sha256: "a".repeat(64), dhash: "00000000000000ff", byte_size: 1234 },
    ]);
    expect(await port.saveFingerprints([])).toBe("saved");
    expect(fake.of(FINGERPRINTS, "upsert")).toHaveLength(1);
  });

  it("tells a table that is not there yet from a write that failed", async () => {
    expect(await make({ [FINGERPRINTS]: { upsert: NO_TABLE } }).port.saveFingerprints([row])).toBe("unavailable");
    expect(await make({ [FINGERPRINTS]: { upsert: { error: { code: "42P01", message: 'relation "x" does not exist' } } } }).port.saveFingerprints([row])).toBe("unavailable");
    expect(await make({ [FINGERPRINTS]: { upsert: DOWN } }).port.saveFingerprints([row])).toBe("failed");
  });

  it("finds the same file on other accounts only, and never selects more than the hash and the owner", async () => {
    const { port, fake } = make({ [FINGERPRINTS]: { select: { data: [{ sha256: "a".repeat(64), owner_id: OTHER }] } } });
    expect(await port.ownersOfFiles(["a".repeat(64)], SUBJECT)).toEqual({ state: "ok", value: [{ sha256: "a".repeat(64), ownerId: OTHER }] });
    const call = fake.of(FINGERPRINTS, "select")[0]!;
    expect(call.filters).toContainEqual(["in", "sha256", ["a".repeat(64)]]);
    expect(call.filters).toContainEqual(["neq", "owner_id", SUBJECT]);
    expect(await port.ownersOfFiles([], SUBJECT)).toEqual({ state: "ok", value: [] });
  });

  it("answers unavailable before the SQL has run, and throws on any other failure", async () => {
    expect(await make({ [FINGERPRINTS]: { select: NO_TABLE } }).port.ownersOfFiles(["x"], SUBJECT)).toEqual({ state: "unavailable" });
    expect(await make({ [FINGERPRINTS]: { select: NO_TABLE } }).port.otherPictures(["identity"], SUBJECT)).toEqual({ state: "unavailable" });
    await expect(make({ [FINGERPRINTS]: { select: DOWN } }).port.ownersOfFiles(["x"], SUBJECT)).rejects.toThrow();
    await expect(make({ [FINGERPRINTS]: { select: DOWN } }).port.otherPictures(["identity"], SUBJECT)).rejects.toThrow();
  });

  it("reads other accounts' picture hashes a page at a time, and stops at the cap", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ owner_id: OTHER, kind: "identity", dhash: i.toString(16).padStart(16, "0") }));
    const full = make({ [FINGERPRINTS]: { select: { data: page } } });
    const answer = await full.port.otherPictures(["identity", "selfie"], SUBJECT);
    expect(answer.state === "ok" && answer.value.length).toBe(PICTURE_PAGES * 1000);
    expect(full.fake.of(FINGERPRINTS, "select")).toHaveLength(PICTURE_PAGES);
    const short = make({ [FINGERPRINTS]: { select: { data: page.slice(0, 3) } } });
    const few = await short.port.otherPictures(["identity"], SUBJECT);
    expect(few).toEqual({ state: "ok", value: page.slice(0, 3).map((r) => ({ ownerId: OTHER, kind: "identity", dhash: r.dhash })) });
    expect(short.fake.of(FINGERPRINTS, "select")).toHaveLength(1);
    expect(short.fake.of(FINGERPRINTS, "select")[0]!.filters).toContainEqual(["not", "dhash", "is"]);
  });

  it("turns a file's bytes into grey pixels through the picture library it was given", async () => {
    const grey = await make({}).port.greyPixels(Uint8Array.from([10, 0, 0]));
    expect(grey).toHaveLength(72);
    expect(grey[0]).toBe(10);
  });
});

describe("ID number hashes", () => {
  const H1 = "1".repeat(64);
  const H2 = "2".repeat(64);
  const H3 = "3".repeat(64);

  it("gathers this person's hashes from the desk's marks and from the vNIN and selfie-check records", async () => {
    const { port } = make({
      [NUMBER_MARKS]: { select: { data: [{ number_hmac: H1 }] } },
      identity_verifications: { select: { data: [{ nin_hmac: H2, bvn_hmac: null }] } },
      identity_checks: { select: { data: [{ nin_hmac: H2, bvn_hmac: H3 }] } },
    });
    const answer = await port.numberHashes(SUBJECT);
    expect(answer.state === "ok" && answer.value.sort()).toEqual([H1, H2, H3]);
  });

  it("is unavailable only when the marks table is missing and nothing else holds a number", async () => {
    expect(await make({ [NUMBER_MARKS]: { select: NO_TABLE } }).port.numberHashes(SUBJECT)).toEqual({ state: "unavailable" });
    const other = await make({ [NUMBER_MARKS]: { select: NO_TABLE }, identity_checks: { select: { data: [{ nin_hmac: H2, bvn_hmac: null }] } } }).port.numberHashes(SUBJECT);
    expect(other).toEqual({ state: "ok", value: [H2] });
    expect(await make({ [NUMBER_MARKS]: { select: { data: [] } } }).port.numberHashes(SUBJECT)).toEqual({ state: "ok", value: [] });
  });

  it("throws when the marks read fails for any other reason, and shrugs off an older table failing", async () => {
    await expect(make({ [NUMBER_MARKS]: { select: DOWN } }).port.numberHashes(SUBJECT)).rejects.toThrow();
    const answer = await make({ [NUMBER_MARKS]: { select: { data: [{ number_hmac: H1 }] } }, identity_verifications: { select: DOWN } }).port.numberHashes(SUBJECT);
    expect(answer).toEqual({ state: "ok", value: [H1] });
  });

  it("finds other accounts with the same hash in all three places, each once, and never this person", async () => {
    const { port, fake } = make({
      [NUMBER_MARKS]: { select: { data: [{ owner_id: OTHER }] } },
      identity_verifications: { select: { data: [{ subject_id: OTHER }] } },
      identity_checks: { select: { data: [{ subject_id: "44444444-4444-4444-8444-444444444444" }] } },
    });
    expect((await port.ownersOfNumbers([H1], SUBJECT)).sort()).toEqual([OTHER, "44444444-4444-4444-8444-444444444444"]);
    for (const call of [...fake.of(NUMBER_MARKS, "select"), ...fake.of("identity_verifications", "select"), ...fake.of("identity_checks", "select")]) {
      expect(call.filters.some(([kind, , value]) => kind === "neq" && value === SUBJECT)).toBe(true);
    }
    expect(fake.of("identity_verifications", "select").map((c) => c.filters[0]![1])).toEqual(["nin_hmac", "bvn_hmac"]);
    expect(await port.ownersOfNumbers([], SUBJECT)).toEqual([]);
  });

  it("will not say a number is on no other account when nothing could be compared", async () => {
    const { port } = make({ [NUMBER_MARKS]: { select: NO_TABLE }, identity_verifications: { select: DOWN }, identity_checks: { select: DOWN } });
    await expect(port.ownersOfNumbers([H1], SUBJECT)).rejects.toThrow();
  });

  it("keeps a typed number as its keyed hash on the document, and nothing else", async () => {
    const { port, fake } = make({ [NUMBER_MARKS]: { upsert: { error: null } } });
    expect(await port.saveNumber({ documentId: "d1", ownerId: SUBJECT, kind: "nin", hmac: H1, recordedBy: "staff-1" })).toBe("saved");
    expect(fake.of(NUMBER_MARKS, "upsert")[0]!.values).toEqual({ document_id: "d1", owner_id: SUBJECT, id_type: "nin", number_hmac: H1, recorded_by: "staff-1" });
    expect(await make({ [NUMBER_MARKS]: { upsert: NO_TABLE } }).port.saveNumber({ documentId: "d1", ownerId: SUBJECT, kind: "nin", hmac: H1, recordedBy: "s" })).toBe("unavailable");
    expect(await make({ [NUMBER_MARKS]: { upsert: DOWN } }).port.saveNumber({ documentId: "d1", ownerId: SUBJECT, kind: "nin", hmac: H1, recordedBy: "s" })).toBe("failed");
  });
});

describe("the account", () => {
  it("answers whether a phone is confirmed from the fact of a row, never selecting the number", async () => {
    const yes = make({ confirmed_phones: { select: { data: [{ user_id: SUBJECT }] } } });
    expect(await yes.port.phoneConfirmed(SUBJECT)).toBe(true);
    expect(await make({ confirmed_phones: { select: { data: [] } } }).port.phoneConfirmed(SUBJECT)).toBe(false);
    await expect(make({ confirmed_phones: { select: DOWN } }).port.phoneConfirmed(SUBJECT)).rejects.toThrow();
    const source = readFileSync(join(__dirname, "supabase-port.ts"), "utf8");
    expect(source).toContain('from("confirmed_phones").select("user_id")');
    expect(source).not.toMatch(/select\("[^"]*\bphone\b/);
  });

  it("reads when the account was opened", async () => {
    expect(await make({ profiles: { select: { data: { created_at: "2026-10-01T09:00:00Z" } } } }).port.accountCreatedAt(SUBJECT)).toBe("2026-10-01T09:00:00Z");
    expect(await make({ profiles: { select: { data: null } } }).port.accountCreatedAt(SUBJECT)).toBeNull();
    await expect(make({ profiles: { select: DOWN } }).port.accountCreatedAt(SUBJECT)).rejects.toThrow();
  });

  it("counts refused ID and selfie documents only", async () => {
    const { port, fake } = make({ agent_documents: { select: { data: [{ id: "a" }, { id: "b" }] } } });
    expect(await port.refusedBefore(SUBJECT)).toBe(2);
    const call = fake.of("agent_documents", "select")[0]!;
    expect(call.filters).toContainEqual(["eq", "review_status", "rejected"]);
    expect(call.filters).toContainEqual(["in", "kind", ["identity", "selfie"]]);
  });

  it("finds who a document belongs to, through its application when the row names no uploader", async () => {
    expect(await make({ agent_documents: { select: { data: { kind: "identity", uploader_id: SUBJECT, application_id: null } } } }).port.documentOwner("d1")).toEqual({ ownerId: SUBJECT, kind: "identity" });
    const older = make({ agent_documents: { select: { data: { kind: "identity", uploader_id: null, application_id: "app-1" } } }, agent_applications: { select: { data: { user_id: OTHER } } } });
    expect(await older.port.documentOwner("d1")).toEqual({ ownerId: OTHER, kind: "identity" });
    expect(await make({ agent_documents: { select: { data: null } } }).port.documentOwner("d1")).toBeNull();
    expect(await make({ agent_documents: { select: { data: { kind: "identity", uploader_id: null, application_id: null } } } }).port.documentOwner("d1")).toEqual({ ownerId: null, kind: "identity" });
    await expect(make({ agent_documents: { select: DOWN } }).port.documentOwner("d1")).rejects.toThrow();
  });
});

describe("recognising a table that is not there yet", () => {
  it("knows PostgREST's and Postgres's ways of saying so, and nothing else", () => {
    expect(tableMissing({ code: "PGRST205", message: "" })).toBe(true);
    expect(tableMissing({ code: "42P01", message: "" })).toBe(true);
    expect(tableMissing({ code: null, message: "Could not find the table in the schema cache" })).toBe(true);
    expect(tableMissing({ code: "57014", message: "timeout" })).toBe(false);
    expect(tableMissing(null)).toBe(false);
  });
});

describe("privacy, held in the source", () => {
  it("never selects a name, a number or a path from another account's rows", () => {
    const source = readFileSync(join(__dirname, "supabase-port.ts"), "utf8");
    const selects = [...source.matchAll(/\.select\("([^"]+)"\)/g)].map((m) => m[1]!);
    const allowed = new Set([
      "id",
      "sha256, owner_id",
      "owner_id, kind, dhash",
      "number_hmac",
      "nin_hmac, bvn_hmac",
      "owner_id",
      "subject_id",
      "user_id",
      "created_at",
      "kind, uploader_id, application_id",
    ]);
    for (const columns of selects) expect(allowed.has(columns), columns).toBe(true);
    /* The one wider select is this person's own documents. */
    expect(source).toContain('const DOCUMENT_COLUMNS = "id, kind, subtype, storage_path, back_storage_path, uploaded_at";');
  });

  it("nothing in the cross-check library writes to a log", () => {
    for (const file of ["read.ts", "supabase-port.ts", "actions.ts", "number-hash.ts", "image-signals.ts", "mrz.ts", "formats.ts", "consistency.ts", "signals.ts"]) {
      expect(readFileSync(join(__dirname, file), "utf8"), file).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
  });
});
