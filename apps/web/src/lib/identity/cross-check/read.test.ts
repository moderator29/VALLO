import { describe, expect, it } from "vitest";

import { dHash } from "@/lib/photo-hash/dhash";
import { jpeg, png } from "./image-fixtures";
import {
  MAX_LINKS,
  accountLinks,
  currentFiles,
  hashToHex,
  hexToHash,
  numberFinding,
  readCrossChecks,
  sha256Hex,
  type Answer,
  type CrossCheckPort,
  type Fingerprint,
  type SubjectDocument,
} from "./read";
import type { Finding } from "./signals";

const NOW = new Date("2026-11-15T12:00:00Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_A = "22222222-2222-4222-8222-222222222222";
const OTHER_B = "33333333-3333-4333-8333-333333333333";

const FRONT = jpeg({ width: 1920, height: 1080 });
const BACK = jpeg({ width: 1920, height: 1081 });
const SELFIE = jpeg({ width: 1280, height: 960 });
const BILL = jpeg({ width: 1000, height: 1400 });

const DOCS: SubjectDocument[] = [
  { id: "doc-id", kind: "identity", subtype: "drivers_licence", storagePath: `${SUBJECT}/front.jpg`, backStoragePath: `${SUBJECT}/back.jpg`, uploadedAt: "2026-11-14T10:00:00Z" },
  { id: "doc-selfie", kind: "selfie", subtype: null, storagePath: `${SUBJECT}/selfie.jpg`, backStoragePath: null, uploadedAt: "2026-11-14T10:01:00Z" },
  { id: "doc-bill", kind: "address", subtype: "utility_bill", storagePath: `${SUBJECT}/bill.jpg`, backStoragePath: null, uploadedAt: "2026-11-14T10:02:00Z" },
];

const FILES: Record<string, Uint8Array> = {
  [`${SUBJECT}/front.jpg`]: FRONT,
  [`${SUBJECT}/back.jpg`]: BACK,
  [`${SUBJECT}/selfie.jpg`]: SELFIE,
  [`${SUBJECT}/bill.jpg`]: BILL,
};

/** Grey pixels that depend on the file, so each file has its own picture hash. */
function grey(bytes: Uint8Array): number[] {
  const seed = bytes.reduce((sum, b) => (sum * 31 + b) % 9973, 7);
  return Array.from({ length: 72 }, (_, i) => (seed * (i + 3) * 17) % 256);
}

type Stub = CrossCheckPort & { saved: Fingerprint[][]; downloads: string[] };

function stub(over: Partial<CrossCheckPort> = {}): Stub {
  const saved: Fingerprint[][] = [];
  const downloads: string[] = [];
  const ok = <T,>(value: T): Answer<T> => ({ state: "ok", value });
  return {
    saved,
    downloads,
    documents: async () => DOCS,
    download: async (path) => {
      downloads.push(path);
      return FILES[path] ?? null;
    },
    greyPixels: async (bytes) => grey(bytes),
    saveFingerprints: async (rows) => {
      saved.push(rows);
      return "saved";
    },
    ownersOfFiles: async () => ok([]),
    otherPictures: async () => ok([]),
    numberHashes: async () => ok(["a".repeat(64)]),
    ownersOfNumbers: async () => [],
    phoneConfirmed: async () => true,
    accountCreatedAt: async () => "2026-10-01T09:00:00Z",
    refusedBefore: async () => 0,
    ...over,
  };
}

const run = (port: CrossCheckPort) => readCrossChecks(port, SUBJECT, { now: NOW, dHash });
const byKey = (findings: Finding[], key: string) => findings.find((f) => f.key === key);
const boom = async () => {
  throw new Error("database down");
};

describe("a clean person", () => {
  it("reads only their own files, keeps a fingerprint of each, and finds nothing", async () => {
    const port = stub();
    const findings = await run(port);
    expect(port.downloads.sort()).toEqual(Object.keys(FILES).sort());
    expect(port.saved).toHaveLength(1);
    expect(port.saved[0]!.map((row) => [row.documentId, row.side, row.kind])).toEqual([
      ["doc-id", "front", "identity"],
      ["doc-id", "back", "identity"],
      ["doc-selfie", "front", "selfie"],
      ["doc-bill", "front", "address"],
    ]);
    for (const row of port.saved[0]!) {
      expect(row.ownerId).toBe(SUBJECT);
      expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    /* A bill is text: it gets no picture hash. */
    expect(port.saved[0]!.map((row) => row.dhash !== null)).toEqual([true, true, true, false]);
    expect(port.saved[0]![0]!.sha256).toBe(sha256Hex(FRONT));
    expect(port.saved[0]![0]!.byteSize).toBe(FRONT.length);

    expect(findings.every((f) => f.level === "ok" && !f.notRun)).toBe(true);
    expect(findings.map((f) => f.key).sort()).toEqual(
      [
        "account.age",
        "account.phone",
        "account.refused",
        "file.plain",
        "file.same",
        "id_number.shared",
        "picture.similar",
      ].sort(),
    );
    expect(byKey(findings, "file.plain")!.title).toBe("No editing mark on the front image, the back image, the selfie or the proof of address");
    expect(byKey(findings, "file.plain")!.detail).toContain("absence means nothing");
    expect(byKey(findings, "account.age")!.title).toBe("The account is 45 days old");
    expect(byKey(findings, "id_number.shared")!.title).toBe("This ID number is on no other account");
  });

  it("says nothing about files for a person with no documents, and still answers the rest", async () => {
    const port = stub({ documents: async () => [] });
    const findings = await run(port);
    expect(port.downloads).toEqual([]);
    expect(port.saved).toEqual([]);
    expect(findings.map((f) => f.key).sort()).toEqual(["account.age", "account.phone", "account.refused", "id_number.shared"]);
  });
});

describe("the same ID number on another account", () => {
  it("stops, counts the accounts, links to them, and names nobody", async () => {
    const findings = await run(stub({ ownersOfNumbers: async () => [OTHER_A] }));
    const item = byKey(findings, "id_number.shared")!;
    expect(findings[0]).toBe(item);
    expect(item).toMatchObject({ level: "stop", title: "This ID number is on 1 other account" });
    expect(item.links).toEqual([{ href: `/admin/people/${OTHER_A}`, label: "Open the other account" }]);
    expect(`${item.title} ${item.detail}`).not.toContain(OTHER_A);
    expect(item.detail).toContain("do not tell the member");
  });

  it("counts each other account once", async () => {
    const item = byKey(await run(stub({ ownersOfNumbers: async () => [OTHER_A, OTHER_B, OTHER_A] })), "id_number.shared")!;
    expect(item.title).toBe("This ID number is on 2 other accounts");
    expect(item.links!.map((l) => l.label)).toEqual(["Open other account 1", "Open other account 2"]);
  });

  it("asks for the number to be typed when none is recorded, and does not call that a pass", async () => {
    const item = byKey(await run(stub({ numberHashes: async () => ({ state: "ok", value: [] }) })), "id_number.shared")!;
    expect(item).toMatchObject({ notRun: true, title: "The ID number has not been compared with other accounts yet" });
    expect(item.level).not.toBe("ok");
  });

  it("says not available yet before the SQL has run", async () => {
    const item = byKey(await run(stub({ numberHashes: async () => ({ state: "unavailable" }) })), "id_number.shared")!;
    expect(item).toMatchObject({ notRun: true, title: "Not available yet: the same ID number on another account" });
  });

  it.each([
    ["reading their own number", { numberHashes: boom }],
    ["looking for it elsewhere", { ownersOfNumbers: boom }],
  ])("fails soft when %s fails", async (_name, over) => {
    const findings = await run(stub(over));
    expect(byKey(findings, "id_number.shared")).toMatchObject({ notRun: true, title: "This check could not run: the same ID number on another account" });
    /* The other checks still ran. */
    expect(byKey(findings, "file.same")!.level).toBe("ok");
  });
});

describe("the same file on another account", () => {
  it("stops, says which file, and links to the other account", async () => {
    const findings = await run(stub({ ownersOfFiles: async () => ({ state: "ok", value: [{ sha256: sha256Hex(FRONT), ownerId: OTHER_A }] }) }));
    const item = byKey(findings, "file.same")!;
    expect(item).toMatchObject({ level: "stop", title: "The same file is on 1 other account" });
    expect(item.detail).toContain("An exact copy of the front image");
    expect(item.links).toEqual([{ href: `/admin/people/${OTHER_A}`, label: "Open the other account" }]);
  });

  it("names both files when two are copies, and counts the accounts, not the rows", async () => {
    const item = byKey(
      await run(
        stub({
          ownersOfFiles: async () => ({
            state: "ok",
            value: [
              { sha256: sha256Hex(FRONT), ownerId: OTHER_A },
              { sha256: sha256Hex(SELFIE), ownerId: OTHER_A },
            ],
          }),
        }),
      ),
      "file.same",
    )!;
    expect(item.title).toBe("The same file is on 1 other account");
    expect(item.detail).toContain("the front image and the selfie");
  });

  it("is not available until the SQL has run, by either sign, and the picture check says the same", async () => {
    const bySave = await run(stub({ saveFingerprints: async () => "unavailable" }));
    expect(byKey(bySave, "file.same")).toMatchObject({ notRun: true, title: "Not available yet: the same file on another account" });
    expect(byKey(bySave, "picture.similar")).toMatchObject({ notRun: true, title: "Not available yet: a very similar picture on another account" });
    const byRead = await run(stub({ ownersOfFiles: async () => ({ state: "unavailable" }), otherPictures: async () => ({ state: "unavailable" }) }));
    expect(byKey(byRead, "file.same")!.title).toMatch(/^Not available yet/);
    expect(byKey(byRead, "picture.similar")!.title).toMatch(/^Not available yet/);
    /* What each file says about itself needs no table. */
    expect(byKey(bySave, "file.plain")!.level).toBe("ok");
  });

  it("still compares when keeping the fingerprints failed", async () => {
    for (const saveFingerprints of [async () => "failed" as const, boom]) {
      const findings = await run(stub({ saveFingerprints, ownersOfFiles: async () => ({ state: "ok", value: [{ sha256: sha256Hex(BACK), ownerId: OTHER_B }] }) }));
      expect(byKey(findings, "file.same")).toMatchObject({ level: "stop" });
    }
  });

  it("fails soft when the comparison read fails", async () => {
    const findings = await run(stub({ ownersOfFiles: boom }));
    expect(byKey(findings, "file.same")).toMatchObject({ notRun: true, title: "This check could not run: the same file on another account" });
    expect(byKey(findings, "picture.similar")!.level).toBe("ok");
  });
});

describe("a very similar picture on another account", () => {
  const frontHash = dHash(grey(FRONT));
  const near = hashToHex(frontHash ^ BigInt(0b101));
  const far = hashToHex(frontHash ^ BigInt("0xffffffff"));

  it("asks for a closer look, links to the account, and is never a stop", async () => {
    const findings = await run(stub({ otherPictures: async () => ({ state: "ok", value: [{ ownerId: OTHER_A, kind: "identity", dhash: near }] }) }));
    const item = byKey(findings, "picture.similar")!;
    expect(item).toMatchObject({ level: "look", title: "A picture very like theirs is on 1 other account" });
    expect(item.detail).toContain("the front image");
    expect(item.detail).toContain("compare the two by eye");
    expect(item.links).toEqual([{ href: `/admin/people/${OTHER_A}`, label: "Open the other account" }]);
  });

  it("ignores a different picture, a picture of another kind, and a hash that does not parse", async () => {
    const findings = await run(
      stub({
        otherPictures: async () => ({
          state: "ok",
          value: [
            { ownerId: OTHER_A, kind: "identity", dhash: far },
            { ownerId: OTHER_A, kind: "selfie", dhash: near },
            { ownerId: OTHER_B, kind: "identity", dhash: "not-a-hash" },
          ],
        }),
      }),
    );
    expect(byKey(findings, "picture.similar")).toMatchObject({ level: "ok", title: "No picture very like theirs is on another account" });
  });

  it("leaves an account already named as holding an exact copy to that louder line", async () => {
    const findings = await run(
      stub({
        ownersOfFiles: async () => ({ state: "ok", value: [{ sha256: sha256Hex(FRONT), ownerId: OTHER_A }] }),
        otherPictures: async () => ({ state: "ok", value: [{ ownerId: OTHER_A, kind: "identity", dhash: hashToHex(frontHash) }] }),
      }),
    );
    expect(byKey(findings, "file.same")!.level).toBe("stop");
    expect(byKey(findings, "picture.similar")!.level).toBe("ok");
  });

  it("asks only for the kinds of picture it holds", async () => {
    let asked: string[] = [];
    await run(
      stub({
        otherPictures: async (kinds) => {
          asked = kinds;
          return { state: "ok", value: [] };
        },
      }),
    );
    expect(asked.sort()).toEqual(["identity", "selfie"]);
  });

  it("could not run when no picture could be decoded, and the file check still ran", async () => {
    const port = stub({ greyPixels: boom });
    const findings = await run(port);
    expect(byKey(findings, "picture.similar")).toMatchObject({ notRun: true, title: "This check could not run: a very similar picture on another account" });
    expect(byKey(findings, "file.same")!.level).toBe("ok");
    expect(port.saved[0]!.every((row) => row.dhash === null)).toBe(true);
  });

  it("fails soft when the picture read fails", async () => {
    expect(byKey(await run(stub({ otherPictures: boom })), "picture.similar")).toMatchObject({ notRun: true });
  });
});

describe("what each file says about itself", () => {
  it("reports an editing mark on the front image and a screenshot as the selfie", async () => {
    const edited = jpeg({ exif: { software: "Adobe Photoshop 25.1 (Windows)" } });
    const shot = png({ width: 1170, height: 2532 });
    const findings = await run(
      stub({
        download: async (path) => (path.endsWith("front.jpg") ? edited : path.endsWith("selfie.jpg") ? shot : (FILES[path] ?? null)),
      }),
    );
    expect(byKey(findings, "file.front.editor")).toMatchObject({ level: "look", title: "The front image was saved by an editing app (Photoshop)" });
    expect(byKey(findings, "file.selfie.screenshot")).toMatchObject({ level: "look", title: "The selfie looks like a screenshot" });
    /* The selfie is stored as .jpg and is a PNG inside. */
    expect(byKey(findings, "file.selfie.type")).toMatchObject({ level: "look" });
  });

  it("keeps a single clean file's own line when the others have something to say", async () => {
    const edited = jpeg({ exif: { software: "Canva" } });
    const findings = await run(stub({ download: async (path) => (path.endsWith("front.jpg") ? (FILES[path] ?? null) : edited) }));
    expect(byKey(findings, "file.front.plain")).toMatchObject({ level: "ok", title: "The front image carries no editing mark" });
    expect(byKey(findings, "file.plain")).toBeUndefined();
    expect(findings.filter((f) => f.key.endsWith(".editor"))).toHaveLength(3);
  });

  it("passes the signal reader the first 256 KB only", async () => {
    const head = jpeg({ cut: true });
    const big = new Uint8Array(600 * 1024);
    big.set(head);
    /* An editing mark far past the limit is not seen. */
    big.set(Uint8Array.from([..."xmp:CreatorTool=\"Adobe Photoshop\""].map((c) => c.charCodeAt(0))), 400 * 1024);
    const findings = await run(stub({ download: async (path) => (path.endsWith("front.jpg") ? big : (FILES[path] ?? null)) }));
    expect(byKey(findings, "file.front.editor")).toBeUndefined();
  });

  it("says which file could not be read, and still looks at the others", async () => {
    const port = stub({ download: async (path) => (path.endsWith("back.jpg") ? null : (FILES[path] ?? null)) });
    const findings = await run(port);
    expect(byKey(findings, "file.back.read")).toMatchObject({ notRun: true, title: "This check could not run: the back image could not be read from storage" });
    expect(byKey(findings, "file.plain")!.title).toBe("No editing mark on the front image, the selfie or the proof of address");
    expect(port.saved[0]!.map((row) => `${row.documentId}:${row.side}`)).toEqual(["doc-id:front", "doc-selfie:front", "doc-bill:front"]);
  });

  it("treats a download that throws, and an empty file, as unreadable", async () => {
    const thrown = await run(stub({ download: boom }));
    expect(thrown.filter((f) => /^file\..*\.read$/.test(f.key))).toHaveLength(4);
    expect(byKey(thrown, "file.same")).toBeUndefined();
    const empty = await run(stub({ download: async () => new Uint8Array(0) }));
    expect(empty.filter((f) => /^file\..*\.read$/.test(f.key))).toHaveLength(4);
  });

  it("says so in one line when their documents could not be listed", async () => {
    const findings = await run(stub({ documents: boom }));
    expect(byKey(findings, "file.read")).toMatchObject({ notRun: true, title: "This check could not run: their document files" });
    expect(byKey(findings, "account.phone")!.level).toBe("ok");
  });
});

describe("the account", () => {
  it("notes a phone that is not confirmed and photos refused before, as things to look at", async () => {
    const findings = await run(stub({ phoneConfirmed: async () => false, refusedBefore: async () => 2 }));
    expect(byKey(findings, "account.phone")).toMatchObject({ level: "look", title: "Their phone number is not confirmed" });
    expect(byKey(findings, "account.refused")).toMatchObject({ level: "look", title: "2 ID or selfie photos from this account were refused before" });
    const one = await run(stub({ refusedBefore: async () => 1 }));
    expect(byKey(one, "account.refused")!.title).toBe("1 ID or selfie photo from this account was refused before");
  });

  it("puts the account's age in plain words", async () => {
    expect(byKey(await run(stub({ accountCreatedAt: async () => "2026-11-15T08:00:00Z" })), "account.age")!.title).toBe("The account was opened today");
    expect(byKey(await run(stub({ accountCreatedAt: async () => "2026-11-14T08:00:00Z" })), "account.age")!.title).toBe("The account was opened yesterday");
    expect(byKey(await run(stub({ accountCreatedAt: async () => "2026-11-05T08:00:00Z" })), "account.age")!.title).toBe("The account is 10 days old");
  });

  it.each([
    ["account.phone", { phoneConfirmed: boom }, "whether their phone number is confirmed"],
    ["account.age", { accountCreatedAt: boom }, "how old the account is"],
    ["account.age", { accountCreatedAt: async () => null }, "how old the account is"],
    ["account.age", { accountCreatedAt: async () => "not a date" }, "how old the account is"],
    ["account.refused", { refusedBefore: boom }, "how many of their photos were refused before"],
  ])("fails soft on %s", async (key, over, what) => {
    const findings = await run(stub(over));
    expect(byKey(findings, key)).toMatchObject({ notRun: true, title: `This check could not run: ${what}` });
    expect(findings.filter((f) => f.notRun)).toHaveLength(1);
  });
});

describe("when everything is down", () => {
  it("never throws, and says every check could not run", async () => {
    const port = stub({
      documents: boom,
      numberHashes: boom,
      phoneConfirmed: boom,
      accountCreatedAt: boom,
      refusedBefore: boom,
    });
    const findings = await run(port);
    expect(findings.map((f) => f.key).sort()).toEqual(["account.age", "account.phone", "account.refused", "file.read", "id_number.shared"]);
    expect(findings.every((f) => f.notRun === true)).toBe(true);
    expect(findings.every((f) => f.title.startsWith("This check could not run"))).toBe(true);
  });
});

describe("ordering and helpers", () => {
  it("puts a stop above everything else", async () => {
    const findings = await run(stub({ ownersOfNumbers: async () => [OTHER_A], phoneConfirmed: async () => false, refusedBefore: boom }));
    const ranks = findings.map((f) => (f.notRun ? "not-run" : f.level));
    expect(ranks[0]).toBe("stop");
    expect(ranks.indexOf("look")).toBeLessThan(ranks.indexOf("not-run"));
    expect(ranks.indexOf("not-run")).toBeLessThan(ranks.indexOf("ok"));
  });

  it("links to at most five other accounts", () => {
    const many = Array.from({ length: 8 }, (_, i) => `id-${i}`);
    expect(accountLinks(many)).toHaveLength(MAX_LINKS);
    expect(numberFinding(many).title).toBe("This ID number is on 8 other accounts");
  });

  it("chooses the newest ID, selfie and proof of address, with the back of the ID when there is one", () => {
    const older: SubjectDocument = { id: "old-id", kind: "identity", subtype: "passport", storagePath: "a/old.jpg", backStoragePath: null, uploadedAt: "2026-11-01T10:00:00Z" };
    const business: SubjectDocument = { id: "cac", kind: "business", subtype: null, storagePath: "a/cac.pdf", backStoragePath: null, uploadedAt: "2026-11-14T10:05:00Z" };
    expect(currentFiles([older, ...DOCS, business]).map((f) => `${f.slot}:${f.documentId}:${f.side}`)).toEqual([
      "front:doc-id:front",
      "back:doc-id:back",
      "selfie:doc-selfie:front",
      "address:doc-bill:front",
    ]);
    expect(currentFiles([older]).map((f) => f.slot)).toEqual(["front"]);
  });

  it("keeps a picture hash as sixteen hex characters, there and back", () => {
    const hash = BigInt("0x80000000000000ff");
    expect(hashToHex(hash)).toBe("80000000000000ff");
    expect(hexToHash("80000000000000ff")).toBe(hash);
    expect(hashToHex(BigInt(5))).toBe("0000000000000005");
    expect(hexToHash("xyz")).toBeNull();
  });
});
