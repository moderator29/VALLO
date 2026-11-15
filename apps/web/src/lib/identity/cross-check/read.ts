import "server-only";

import { createHash } from "node:crypto";

import { MATCH_MAX_BITS, hamming } from "@/lib/photo-hash/dhash";
import { IMAGE_SIGNAL_BYTES, imageFindings, readImageSignals } from "./image-signals";
import { couldNotRun, finding, notAvailableYet, orderFindings, otherAccounts, type Finding, type FindingLink } from "./signals";

/**
 * THE CROSS-CHECKS THAT NEED THE DATABASE, FOR ONE PERSON (15 November 2026).
 *
 * Six questions, each answered from what Vallo already holds, at no cost and
 * without anything leaving the platform:
 *
 *   1. Is the same ID NUMBER on another account? Numbers are never stored,
 *      only keyed hashes (`number-hash.ts`), so hashes are compared.
 *   2. Is the same document FILE on another account? Exact copies, by the
 *      SHA-256 of the file.
 *   3. Is a very similar PICTURE on another account (the same card
 *      photographed or edited again)? By perceptual hash, the one
 *      `lib/photo-hash` uses for listing photographs.
 *   4. What does each of their own files say about how it was saved
 *      (`image-signals.ts`, from the first 256 KB)?
 *   5. Is their phone number confirmed, and how old is the account?
 *   6. How many of their ID or selfie photos were refused before?
 *
 * NOTHING HERE DOWNLOADS ANOTHER PERSON'S DOCUMENT. Only this person's own
 * files are read from storage. Their fingerprints are kept in
 * `kyc_document_fingerprints` (the pending SQL of 15 November 2026) the first
 * time a reviewer opens them, and compared with the fingerprints kept the
 * same way for everybody reviewed before. Until that SQL has run, checks 2
 * and 3 say "not available yet" and everything else still works.
 *
 * WHAT A FINDING ABOUT ANOTHER ACCOUNT SAYS. How many, and a link to each
 * account's admin record. Never a name, a number or a picture: the record has
 * its own door, which refuses staff who may not open it.
 *
 * EVERY CHECK FAILS SOFT. Each runs in its own try, and one that cannot run
 * says so in its own line. A reviewer is never blocked by this file.
 *
 * The database sits behind `CrossCheckPort`, so every path here is tested
 * with a stub (`read.test.ts`); `supabase-port.ts` is the real one.
 */

export type SubjectDocument = {
  id: string;
  /** identity, selfie, address, business. */
  kind: string;
  subtype: string | null;
  storagePath: string;
  backStoragePath: string | null;
  uploadedAt: string;
};

export type Fingerprint = {
  documentId: string;
  side: "front" | "back";
  ownerId: string;
  kind: string;
  /** SHA-256 of the whole file, hex. */
  sha256: string;
  /** The 64-bit difference hash as 16 hex characters, or null for a file that is not a readable picture. */
  dhash: string | null;
  byteSize: number;
};

/** `unavailable` means the table behind the answer is not in the database yet. */
export type Answer<T> = { state: "ok"; value: T } | { state: "unavailable" };

export type CrossCheckPort = {
  /** This person's own documents, newest first. Throws when the read fails. */
  documents(subjectId: string): Promise<SubjectDocument[]>;
  /** One of their files from the private bucket, or null when it cannot be reached. */
  download(path: string): Promise<Uint8Array | null>;
  /** The 9 by 8 grey pixels the difference hash reads. Throws for a file that is not a picture. */
  greyPixels(bytes: Uint8Array): Promise<ArrayLike<number>>;
  saveFingerprints(rows: Fingerprint[]): Promise<"saved" | "unavailable" | "failed">;
  /** Other accounts holding a file with one of these SHA-256 values. */
  ownersOfFiles(sha256s: string[], subjectId: string): Promise<Answer<{ sha256: string; ownerId: string }[]>>;
  /** Picture hashes of the same kinds kept for other accounts, newest first, capped. */
  otherPictures(kinds: string[], subjectId: string): Promise<Answer<{ ownerId: string; kind: string; dhash: string }[]>>;
  /** The keyed hashes of ID numbers recorded for this person. */
  numberHashes(subjectId: string): Promise<Answer<string[]>>;
  /** Other accounts recorded with any of these keyed hashes. */
  ownersOfNumbers(hashes: string[], subjectId: string): Promise<string[]>;
  phoneConfirmed(subjectId: string): Promise<boolean>;
  accountCreatedAt(subjectId: string): Promise<string | null>;
  /** How many of their ID or selfie documents were refused. */
  refusedBefore(subjectId: string): Promise<number>;
};

/** How many other accounts a finding links to; more than this are counted, not listed. */
export const MAX_LINKS = 5;

/** The admin record of another account. The page itself refuses staff who may not open it. */
export function accountLinks(ownerIds: readonly string[]): FindingLink[] {
  return ownerIds.slice(0, MAX_LINKS).map((id, index) => ({
    href: `/admin/people/${id}`,
    label: ownerIds.length === 1 ? "Open the other account" : `Open other account ${index + 1}`,
  }));
}

/** The finding for an ID number, from the other accounts recorded with it. Shared with the compare action. */
export function numberFinding(otherOwners: readonly string[]): Finding {
  const owners = [...new Set(otherOwners)];
  if (owners.length === 0) {
    return finding(
      "id_number.shared",
      "ok",
      "This ID number is on no other account",
      "Compared with the numbers recorded on Vallo so far. It tells you the number is not reused here, not that the number is real.",
    );
  }
  return finding(
    "id_number.shared",
    "stop",
    `This ID number is on ${otherAccounts(owners.length)}`,
    "One ID belongs to one person. Do not approve, do not tell the member, and escalate to Trust and Safety.",
    accountLinks(owners),
  );
}

type FileSlot = { slot: string; label: string; expectsPhoto: boolean; documentId: string; side: "front" | "back"; kind: string; path: string };

function newest(documents: readonly SubjectDocument[], kind: string): SubjectDocument | null {
  return documents.filter((doc) => doc.kind === kind).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0] ?? null;
}

/** The files the desk is deciding on: the newest ID (both sides), selfie and proof of address. */
export function currentFiles(documents: readonly SubjectDocument[]): FileSlot[] {
  const out: FileSlot[] = [];
  const id = newest(documents, "identity");
  if (id) {
    out.push({ slot: "front", label: "The front image", expectsPhoto: true, documentId: id.id, side: "front", kind: "identity", path: id.storagePath });
    if (id.backStoragePath) {
      out.push({ slot: "back", label: "The back image", expectsPhoto: true, documentId: id.id, side: "back", kind: "identity", path: id.backStoragePath });
    }
  }
  const selfie = newest(documents, "selfie");
  if (selfie) out.push({ slot: "selfie", label: "The selfie", expectsPhoto: true, documentId: selfie.id, side: "front", kind: "selfie", path: selfie.storagePath });
  const address = newest(documents, "address");
  if (address) out.push({ slot: "address", label: "The proof of address", expectsPhoto: false, documentId: address.id, side: "front", kind: "address", path: address.storagePath });
  return out;
}

function extensionOf(path: string): string | null {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? null : path.slice(dot + 1);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A 64-bit hash as 16 hex characters, the form the fingerprint table keeps. */
export function hashToHex(hash: bigint): string {
  return BigInt.asUintN(64, hash).toString(16).padStart(16, "0");
}

export function hexToHash(hex: string): bigint | null {
  return /^[0-9a-f]{16}$/.test(hex) ? BigInt(`0x${hex}`) : null;
}

/** Pictures compared for likeness: an ID and a selfie. A bill or a statement is text, and all of those look alike. */
const PICTURE_KINDS = ["identity", "selfie"];

function daysBetween(fromIso: string, now: Date): number | null {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return null;
  return Math.max(0, Math.floor((now.getTime() - from) / 86_400_000));
}

export type ReadOptions = {
  now: Date;
  /** The difference hash of 72 grey pixels. Passed in so this file needs no image library. */
  dHash(grey: ArrayLike<number>): bigint;
};

/**
 * Every database cross-check for one person, worst first. Never throws.
 */
export async function readCrossChecks(port: CrossCheckPort, subjectId: string, options: ReadOptions): Promise<Finding[]> {
  const out: Finding[] = [];
  const [files, account] = await Promise.all([fileChecks(port, subjectId, options), accountChecks(port, subjectId, options.now)]);
  out.push(...files, ...(await numberCheck(port, subjectId)), ...account);
  return orderFindings(out);
}

/* -------------------------------------------------- 1. the ID number */

async function numberCheck(port: CrossCheckPort, subjectId: string): Promise<Finding[]> {
  try {
    const own = await port.numberHashes(subjectId);
    if (own.state === "unavailable") return [notAvailableYet("id_number.shared", "the same ID number on another account")];
    if (own.value.length === 0) {
      return [
        {
          key: "id_number.shared",
          level: "look",
          notRun: true,
          title: "The ID number has not been compared with other accounts yet",
          detail: "Type the number printed on the ID into the box below. Only a scrambled form of it is kept, to spot the same number on another account.",
        },
      ];
    }
    return [numberFinding(await port.ownersOfNumbers(own.value, subjectId))];
  } catch {
    return [couldNotRun("id_number.shared", "the same ID number on another account")];
  }
}

/* -------------------------------------- 2, 3 and 4. their own files */

type Loaded = FileSlot & { bytes: Uint8Array; sha256: string; dhash: string | null };

async function fileChecks(port: CrossCheckPort, subjectId: string, options: ReadOptions): Promise<Finding[]> {
  let slots: FileSlot[];
  try {
    slots = currentFiles(await port.documents(subjectId));
  } catch {
    return [couldNotRun("file.read", "their document files")];
  }
  if (slots.length === 0) return [];

  const out: Finding[] = [];
  const loaded: Loaded[] = [];
  for (const slot of slots) {
    let bytes: Uint8Array | null = null;
    try {
      bytes = await port.download(slot.path);
    } catch {
      bytes = null;
    }
    if (!bytes || bytes.length === 0) {
      out.push(couldNotRun(`file.${slot.slot}.read`, `${slot.label.toLowerCase()} could not be read from storage`));
      continue;
    }
    try {
      const signals = readImageSignals(bytes.length > IMAGE_SIGNAL_BYTES ? bytes.subarray(0, IMAGE_SIGNAL_BYTES) : bytes);
      out.push(...imageFindings({ slot: slot.slot, label: slot.label, expectsPhoto: slot.expectsPhoto, extension: extensionOf(slot.path) }, signals));
    } catch {
      out.push(couldNotRun(`file.${slot.slot}.signals`, `how ${slot.label.toLowerCase()} was saved`));
    }
    let dhash: string | null = null;
    if (PICTURE_KINDS.includes(slot.kind)) {
      try {
        dhash = hashToHex(options.dHash(await port.greyPixels(bytes)));
      } catch {
        dhash = null;
      }
    }
    try {
      loaded.push({ ...slot, bytes, sha256: sha256Hex(bytes), dhash });
    } catch {
      /* A file that cannot be hashed is compared with nothing; its own line above still stands. */
    }
  }
  if (loaded.length === 0) return out;

  /* Kept first, so the next person reviewed is compared with these. A failed
     save costs later comparisons, never this one. */
  let saved: "saved" | "unavailable" | "failed" = "failed";
  try {
    saved = await port.saveFingerprints(
      loaded.map((file) => ({
        documentId: file.documentId,
        side: file.side,
        ownerId: subjectId,
        kind: file.kind,
        sha256: file.sha256,
        dhash: file.dhash,
        byteSize: file.bytes.length,
      })),
    );
  } catch {
    saved = "failed";
  }

  const exactOwners = new Set<string>();
  out.push(await sameFileCheck(port, subjectId, loaded, saved, exactOwners));
  out.push(await similarPictureCheck(port, subjectId, loaded, saved, exactOwners));
  return out;
}

async function sameFileCheck(
  port: CrossCheckPort,
  subjectId: string,
  loaded: readonly Loaded[],
  saved: "saved" | "unavailable" | "failed",
  exactOwners: Set<string>,
): Promise<Finding> {
  const what = "the same file on another account";
  if (saved === "unavailable") return notAvailableYet("file.same", what);
  try {
    const answer = await port.ownersOfFiles([...new Set(loaded.map((file) => file.sha256))], subjectId);
    if (answer.state === "unavailable") return notAvailableYet("file.same", what);
    const hits = answer.value.filter((row) => row.ownerId !== subjectId);
    for (const row of hits) exactOwners.add(row.ownerId);
    if (hits.length === 0) {
      return finding(
        "file.same",
        "ok",
        "None of their files is on another account",
        "Compared, byte for byte, with the files of people reviewed since this comparison was switched on. Files from before then are not all included.",
      );
    }
    const which = loaded.filter((file) => hits.some((row) => row.sha256 === file.sha256)).map((file) => file.label.toLowerCase());
    return finding(
      "file.same",
      "stop",
      `The same file is on ${otherAccounts(exactOwners.size)}`,
      `An exact copy of ${which.join(" and ")} was sent from another account, so one of them did not take the photo. Do not approve, do not tell the member, and escalate to Trust and Safety.`,
      accountLinks([...exactOwners]),
    );
  } catch {
    return couldNotRun("file.same", what);
  }
}

async function similarPictureCheck(
  port: CrossCheckPort,
  subjectId: string,
  loaded: readonly Loaded[],
  saved: "saved" | "unavailable" | "failed",
  exactOwners: ReadonlySet<string>,
): Promise<Finding> {
  const what = "a very similar picture on another account";
  if (saved === "unavailable") return notAvailableYet("picture.similar", what);
  const pictures = loaded.flatMap((file) => {
    const hash = file.dhash ? hexToHash(file.dhash) : null;
    return hash === null ? [] : [{ file, hash }];
  });
  if (pictures.length === 0) return couldNotRun("picture.similar", what);
  try {
    const answer = await port.otherPictures([...new Set(pictures.map((p) => p.file.kind))], subjectId);
    if (answer.state === "unavailable") return notAvailableYet("picture.similar", what);
    const owners = new Set<string>();
    const which = new Set<string>();
    for (const row of answer.value) {
      /* An exact copy is already its own, louder line. */
      if (row.ownerId === subjectId || exactOwners.has(row.ownerId)) continue;
      const theirs = hexToHash(row.dhash);
      if (theirs === null) continue;
      for (const mine of pictures) {
        if (mine.file.kind === row.kind && hamming(mine.hash, theirs) <= MATCH_MAX_BITS) {
          owners.add(row.ownerId);
          which.add(mine.file.label.toLowerCase());
        }
      }
    }
    if (owners.size === 0) {
      return finding(
        "picture.similar",
        "ok",
        "No picture very like theirs is on another account",
        "Their ID and selfie were compared, by overall look, with those of people reviewed since this comparison was switched on.",
      );
    }
    return finding(
      "picture.similar",
      "look",
      `A picture very like theirs is on ${otherAccounts(owners.size)}`,
      `It resembles ${[...which].join(" and ")}. It may be the same card or face photographed again, or two cards of the same kind that look alike to this comparison. Open the other account and compare the two by eye before you decide.`,
      accountLinks([...owners]),
    );
  } catch {
    return couldNotRun("picture.similar", what);
  }
}

/* --------------------------------------------- 5 and 6. the account */

async function accountChecks(port: CrossCheckPort, subjectId: string, now: Date): Promise<Finding[]> {
  const [phone, created, refused] = await Promise.all([
    port.phoneConfirmed(subjectId).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    port.accountCreatedAt(subjectId).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    port.refusedBefore(subjectId).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
  ]);
  const out: Finding[] = [];

  if (!phone.ok) out.push(couldNotRun("account.phone", "whether their phone number is confirmed"));
  else if (phone.value) out.push(finding("account.phone", "ok", "Their phone number is confirmed", "They proved they hold the number with a code sent to it."));
  else out.push(finding("account.phone", "look", "Their phone number is not confirmed", "An account with no confirmed phone is easier to throw away. Not a reason to refuse by itself."));

  const days = created.ok && created.value ? daysBetween(created.value, now) : null;
  if (!created.ok || days === null) out.push(couldNotRun("account.age", "how old the account is"));
  else {
    const age = days === 0 ? "The account was opened today" : days === 1 ? "The account was opened yesterday" : `The account is ${days} days old`;
    out.push(finding("account.age", "ok", age, "A new account is normal for a new lister. It matters more when something else here looks wrong."));
  }

  if (!refused.ok) out.push(couldNotRun("account.refused", "how many of their photos were refused before"));
  else if (refused.value === 0) out.push(finding("account.refused", "ok", "No ID or selfie from this account was refused before", "This is their first try, or every earlier one was accepted."));
  else {
    out.push(
      finding(
        "account.refused",
        "look",
        refused.value === 1 ? "1 ID or selfie photo from this account was refused before" : `${refused.value} ID or selfie photos from this account were refused before`,
        "Read why in the documents below. A blurry photo sent again is ordinary; a different ID each time is not.",
      ),
    );
  }
  return out;
}
