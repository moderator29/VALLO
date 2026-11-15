"use server";

import { writeAudit } from "@/lib/admin/audit";
import { adminRefusal, requireAdmin } from "@/lib/admin/guard";
import { dHash } from "@/lib/photo-hash/dhash";
import { greyPixels } from "@/lib/photo-hash/hash-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idNumberShape, isIdNumberKind, type IdNumberKind } from "./formats";
import { idNumberHmac, idNumberKey } from "./number-hash";
import { numberFinding, readCrossChecks } from "./read";
import { countFindings, notAvailableYet, type Finding } from "./signals";
import { supabasePort, type LooseClient, type SupabasePort } from "./supabase-port";

/**
 * THE TWO SERVER CALLS BEHIND THE CROSS-CHECKS PANEL (15 November 2026).
 *
 * Both sit behind the `kyc_review` door, both refuse a reviewer's own
 * account, and both write one audit row that carries counts and ids only:
 * never an ID number, its hash, a name or anything read from a document.
 *
 *   runCrossChecks      reads this person's own files and the comparison
 *                       tables, and answers with findings. Called when a
 *                       reviewer opens a person, so the documents of the
 *                       whole queue are not read on every page load.
 *   compareIdNumber     takes the number a reviewer typed from the document,
 *                       turns it into a keyed hash on the server, keeps only
 *                       the hash, and says whether another account carries
 *                       the same one. The number is used once and dropped.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OWN_ACCOUNT = "This is your own account, so somebody else has to review it.";

export type CrossCheckReport =
  | { state: "ok"; findings: Finding[] }
  /** The caller may not run the checks; `message` says why in plain words. */
  | { state: "refused"; message: string }
  /** The checks could not start at all. The panel says so and the reviewer carries on. */
  | { state: "failed" };

function port(): SupabasePort {
  return supabasePort(createAdminClient() as unknown as LooseClient, { greyPixels });
}

export async function runCrossChecks(subjectId: string): Promise<CrossCheckReport> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return { state: "refused", message: adminRefusal(access) };
  if (typeof subjectId !== "string" || !UUID.test(subjectId)) return { state: "failed" };
  if (subjectId === access.user.id) return { state: "refused", message: OWN_ACCOUNT };

  try {
    const findings = await readCrossChecks(port(), subjectId, { now: new Date(), dHash });
    const counts = countFindings(findings);
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "kyc.cross_checks.run",
      entityType: "user",
      entityId: subjectId,
      detail: { stop: counts.stop, look: counts.look, not_run: counts.notRun },
    });
    return { state: "ok", findings };
  } catch {
    return { state: "failed" };
  }
}

export type CompareIdNumberResult = { ok: true; findings: Finding[] } | { ok: false; error: string };

const NOT_SET_UP = "Comparing ID numbers is not set up on this server yet. Nothing was saved. Carry on with the other checks.";
const COULD_NOT = "That number could not be compared just now. Nothing was saved. Try again in a moment.";

export async function compareIdNumber(input: { documentId: string; kind: string; number: string }): Promise<CompareIdNumberResult> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return { ok: false, error: adminRefusal(access) };

  const documentId = typeof input?.documentId === "string" ? input.documentId : "";
  if (!UUID.test(documentId) || !isIdNumberKind(input?.kind)) return { ok: false, error: "We could not identify that document. Reload the page and try again." };
  const kind: IdNumberKind = input.kind;
  const shape = idNumberShape(kind, typeof input.number === "string" ? input.number : "");
  if (shape.shape === "empty" || shape.normalised.length < 5 || shape.normalised.length > 30) {
    return { ok: false, error: "Type the number as it is printed on the document." };
  }

  const key = idNumberKey();
  if (!key) return { ok: false, error: NOT_SET_UP };

  try {
    const db = port();
    const owner = await db.documentOwner(documentId);
    if (!owner || owner.kind !== "identity" || !owner.ownerId) return { ok: false, error: "That document is no longer here. Reload the page." };
    if (owner.ownerId === access.user.id) return { ok: false, error: OWN_ACCOUNT };

    const hmac = idNumberHmac(kind, shape.normalised, key);
    const saved = await db.saveNumber({ documentId, ownerId: owner.ownerId, kind, hmac, recordedBy: access.user.id });

    const findings: Finding[] = [];
    /* Without the table, only a NIN or a BVN has anything to be compared
       with: the hashes the vNIN and selfie-check routes record. */
    if (saved === "unavailable" && kind !== "nin" && kind !== "bvn") {
      findings.push(notAvailableYet("id_number.shared", "the same ID number on another account"));
    } else {
      findings.push(numberFinding(await db.ownersOfNumbers([hmac], owner.ownerId)));
      if (saved !== "saved") {
        findings.push(notAvailableYet("id_number.kept", "keeping this number's scrambled form, so later accounts are compared with it"));
      }
    }

    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "kyc.id_number.compared",
      entityType: "agent_documents",
      entityId: documentId,
      detail: { id_type: kind, kept: saved === "saved", shared: findings.some((item) => item.level === "stop") },
    });
    return { ok: true, findings };
  } catch {
    return { ok: false, error: COULD_NOT };
  }
}
