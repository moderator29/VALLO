import type { KycSubjectView } from "@/lib/admin/kyc-queries";
import { dHash } from "@/lib/photo-hash/dhash";
import type { CrossCheckReport } from "@/lib/identity/cross-check/actions";
import { jpeg, png } from "@/lib/identity/cross-check/image-fixtures";
import { readCrossChecks, sha256Hex, type CrossCheckPort, type SubjectDocument } from "@/lib/identity/cross-check/read";

/**
 * FIXTURES FOR THE CROSS-CHECKS PREVIEW. Invented people, invented ids and
 * image files built byte by byte with no picture in them: no real person's
 * name, number, document or face is anywhere here.
 *
 * The findings are not typed out by hand. Each case stages what the database
 * and storage would answer and runs the real `readCrossChecks` over it, so
 * the preview shows the words the desk will really show.
 */

export const PREVIEW_NOW = new Date("2026-11-15T12:00:00Z");

const OTHER_ACCOUNT = "00000000-0000-4000-8000-0000000000f1";

type Doc = KycSubjectView["documents"][number];

function doc(id: string, over: Partial<Doc>): Doc {
  return {
    id,
    kind: "identity",
    subtype: "passport",
    reviewStatus: "pending",
    rejectionReason: null,
    issuedOn: null,
    uploadedAt: "2026-11-14T10:00:00Z",
    reviewedAt: null,
    reviewedByName: null,
    media: "image",
    backMedia: null,
    issuingCountry: "NG",
    isResubmission: false,
    tooOld: false,
    nameOnDocument: null,
    answersRequest: false,
    ...over,
  };
}

function subject(userId: string, over: Partial<KycSubjectView>): KycSubjectView {
  return {
    userId,
    displayName: null,
    applicationId: null,
    applicationReference: null,
    agentId: null,
    tier: 0,
    rungs: [],
    business: null,
    documents: [],
    payoutNameCheck: null,
    namesOnRecord: { account: null, application: null },
    identityName: null,
    request: null,
    consents: [
      { consent: "accuracy", consentedAt: "2026-11-14T09:58:00Z" },
      { consent: "terms", consentedAt: "2026-11-14T09:58:00Z" },
      { consent: "processing", consentedAt: "2026-11-14T09:58:00Z" },
    ],
    consentsRead: true,
    ...over,
  };
}

const CLEAN_ID = "00000000-0000-4000-8000-0000000000a1";
const STOP_ID = "00000000-0000-4000-8000-0000000000b1";
const DOWN_ID = "00000000-0000-4000-8000-0000000000c1";

export const CLEAN_SUBJECT = subject(CLEAN_ID, {
  displayName: "Chidi Okeke (example)",
  documents: [
    doc("00000000-0000-4000-8000-0000000000a2", { subtype: "passport", nameOnDocument: "OKEKE CHIDI EMMANUEL" }),
    doc("00000000-0000-4000-8000-0000000000a3", { kind: "selfie", subtype: null, issuingCountry: null }),
    doc("00000000-0000-4000-8000-0000000000a4", { kind: "address", subtype: "utility_bill", issuingCountry: null, issuedOn: "2026-10-20" }),
  ],
  namesOnRecord: { account: "Chidi Okeke", application: null },
  identityName: "OKEKE CHIDI EMMANUEL",
  payoutNameCheck: { match: true, reason: "every part of the shorter name found in the longer", holder: "CHIDI E OKEKE", onRecord: "OKEKE CHIDI EMMANUEL" },
});

export const STOP_SUBJECT = subject(STOP_ID, {
  displayName: "Tolu Bello (example)",
  documents: [
    doc("00000000-0000-4000-8000-0000000000b2", { subtype: "nin_card", isResubmission: true }),
    doc("00000000-0000-4000-8000-0000000000b3", { kind: "selfie", subtype: null, issuingCountry: null }),
  ],
  namesOnRecord: { account: "Tolu Bello", application: null },
  payoutNameCheck: { match: false, reason: "a part of the shorter name is missing from the longer", holder: "ADAOBI NWOSU", onRecord: "Tolu Bello" },
});

export const DOWN_SUBJECT = subject(DOWN_ID, {
  displayName: "Amina Yusuf (example)",
  documents: [
    doc("00000000-0000-4000-8000-0000000000c2", { subtype: "drivers_licence", backMedia: "image" }),
    doc("00000000-0000-4000-8000-0000000000c3", { kind: "selfie", subtype: null, issuingCountry: null }),
  ],
  namesOnRecord: { account: "Amina Yusuf", application: null },
});

function documentsOf(view: KycSubjectView): SubjectDocument[] {
  return view.documents.map((d) => ({
    id: d.id,
    kind: d.kind,
    subtype: d.subtype,
    storagePath: `${view.userId}/${d.id}.jpg`,
    backStoragePath: d.backMedia ? `${view.userId}/${d.id}-back.jpg` : null,
    uploadedAt: d.uploadedAt,
  }));
}

/** A database and a bucket that answer as a healthy one would for a person with nothing wrong. */
function healthyPort(view: KycSubjectView, files: (path: string) => Uint8Array): CrossCheckPort {
  return {
    documents: async () => documentsOf(view),
    download: async (path) => files(path),
    greyPixels: async (bytes) => Array.from({ length: 72 }, (_, i) => (bytes.length * (i + 7)) % 256),
    saveFingerprints: async () => "saved",
    ownersOfFiles: async () => ({ state: "ok", value: [] }),
    otherPictures: async () => ({ state: "ok", value: [] }),
    numberHashes: async () => ({ state: "ok", value: ["a".repeat(64)] }),
    ownersOfNumbers: async () => [],
    phoneConfirmed: async () => true,
    accountCreatedAt: async () => "2026-09-02T09:00:00Z",
    refusedBefore: async () => 0,
  };
}

const PLAIN = (path: string) => jpeg({ width: 1920, height: path.includes("back") ? 1081 : 1080 });

async function report(port: CrossCheckPort, userId: string): Promise<CrossCheckReport> {
  return { state: "ok", findings: await readCrossChecks(port, userId, { now: PREVIEW_NOW, dHash }) };
}

/** Nothing wrong: every line fine. */
export function cleanReport(): Promise<CrossCheckReport> {
  return report(healthyPort(CLEAN_SUBJECT, PLAIN), CLEAN_ID);
}

/** The ID number on another account, the front image saved by an editing app, the selfie a screenshot. */
export function stopReport(): Promise<CrossCheckReport> {
  const edited = jpeg({ exif: { software: "Adobe Photoshop 25.1 (Windows)" } });
  const screenshot = png({ width: 1080, height: 2400 });
  const files = (path: string) => (path.includes("b2") ? edited : screenshot);
  return report(
    {
      ...healthyPort(STOP_SUBJECT, files),
      ownersOfNumbers: async () => [OTHER_ACCOUNT],
      ownersOfFiles: async () => ({ state: "ok", value: [{ sha256: sha256Hex(screenshot), ownerId: OTHER_ACCOUNT }] }),
      phoneConfirmed: async () => false,
      accountCreatedAt: async () => "2026-11-14T08:00:00Z",
      refusedBefore: async () => 2,
    },
    STOP_ID,
  );
}

/** The comparison tables not in the database yet, one file unreachable, and two reads failing. */
export function downReport(): Promise<CrossCheckReport> {
  const fail = async () => {
    throw new Error("unreachable");
  };
  return report(
    {
      ...healthyPort(DOWN_SUBJECT, PLAIN),
      download: async (path) => (path.includes("back") ? null : PLAIN(path)),
      saveFingerprints: async () => "unavailable",
      numberHashes: async () => ({ state: "unavailable" }),
      phoneConfirmed: fail,
      refusedBefore: fail,
    },
    DOWN_ID,
  );
}
