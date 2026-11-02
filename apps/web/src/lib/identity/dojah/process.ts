import type { DojahAmlRecord, DojahResult } from "./client";
import { decideVerification, readVerification, type DojahVerdict, type ReadVerification } from "./result";

/**
 * ONE DOJAH RESULT, FROM SIGNED PAYLOAD TO RECORDED DECISION. Every effect is
 * injected, so the whole path is proven with fakes (process.test.ts); the
 * webhook route wires the real ones.
 *
 *   read  ->  find our check by metadata.vallo_ref  ->  decide (machine may
 *   pass, never refuse)  ->  AML screen a result about to pass  ->  copy the
 *   files out of Dojah's hour-long links  ->  hash the NIN / BVN and drop it
 *   ->  record_dojah_check
 */

export type CheckRow = { id: string; subject_id: string; status: string };

export type ProcessDeps = {
  loadCheck(id: string): Promise<CheckRow | null>;
  /** The name the person gave Vallo: the application's full name, else the profile's. */
  expectedName(subjectId: string): Promise<string>;
  /** Null when AML screening is not switched on. */
  aml: ((name: string, dob: string | null, reference: string) => Promise<DojahResult<DojahAmlRecord>>) | null;
  /** Copies one Dojah file link into private storage; answers the storage path, or null. */
  copyFile(url: string, path: string): Promise<string | null>;
  hmac: { nin(n: string): string; bvn(n: string): string } | null;
  record(args: Record<string, unknown>): Promise<string>;
};

export type ProcessOutcome =
  | { kind: "ignored"; reason: "unreadable" | "no_reference" | "unknown_check" | "already_decided" }
  | { kind: "recorded"; status: string; verdict: DojahVerdict["kind"] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIDED = new Set(["approved", "refused", "passed"]);

/** Clean is "No Match" and nothing else. Anything a list returned is for a person. */
export function amlClear(record: DojahAmlRecord): boolean {
  const status = (record.match_status ?? "").trim().toLowerCase();
  return status === "no match" || (status === "" && (record.total_results ?? 0) === 0 && (record.results?.length ?? 0) === 0);
}

function extensionOf(url: string, fallback: string): string {
  const match = /\.(jpe?g|png|webp|pdf)(?:\?|$)/i.exec(url);
  return match?.[1] ? match[1].toLowerCase().replace("jpeg", "jpg") : fallback;
}

export async function processDojahResult(deps: ProcessDeps, body: unknown): Promise<ProcessOutcome> {
  const read = readVerification(body);
  if (!read) return { kind: "ignored", reason: "unreadable" };
  if (!read.valloRef || !UUID.test(read.valloRef)) return { kind: "ignored", reason: "no_reference" };
  const check = await deps.loadCheck(read.valloRef);
  if (!check) return { kind: "ignored", reason: "unknown_check" };
  if (DECIDED.has(check.status)) return { kind: "ignored", reason: "already_decided" };

  let verdict = decideVerification(read, await deps.expectedName(check.subject_id));
  const reasons = "reasons" in verdict ? [...verdict.reasons] : [];

  let aml: Record<string, unknown> | null = null;
  if ((verdict.kind === "passed" || verdict.kind === "review") && deps.aml && read.governmentName) {
    const screened = await deps.aml(read.governmentName, read.governmentDob, check.id);
    if (screened.ok) {
      aml = {
        match_status: screened.entity.match_status ?? null,
        risk_level: screened.entity.risk_level ?? null,
        total_results: screened.entity.total_results ?? 0,
        results: (screened.entity.results ?? []).slice(0, 10).map((r) => ({
          name: r.name ?? null,
          source_type: r.source_type ?? null,
          match_strength: r.match_strength ?? null,
          country: r.country ?? null,
        })),
      };
      if (!amlClear(screened.entity)) reasons.unshift(`AML screening: ${screened.entity.match_status ?? "results returned"}.`);
    } else {
      aml = { error: screened.reason };
      reasons.unshift("AML screening did not run, so a person should look.");
    }
    if (reasons.some((r) => r.startsWith("AML screening"))) verdict = { kind: "review", reasons };
  }

  /* The NIN or BVN: hashed now, dropped now. No key, no machine pass. */
  let ninHash: string | null = null;
  let bvnHash: string | null = null;
  if (read.idNumber) {
    if (deps.hmac) {
      if (read.idType === "BVN") bvnHash = deps.hmac.bvn(read.idNumber);
      else ninHash = deps.hmac.nin(read.idNumber);
    } else if (verdict.kind === "passed") {
      reasons.unshift("The identity number could not be hashed (VALLO_NIN_HMAC_KEY missing), so a person should look.");
      verdict = { kind: "review", reasons };
    }
  }

  const files = await copyFiles(deps, read, check);

  const status =
    verdict.kind === "waiting" ? "waiting" : verdict.kind === "abandoned" ? "abandoned" : verdict.kind === "retry" ? "retry" : verdict.kind;
  const result = await deps.record({
    p_check: check.id,
    p_status: status,
    p_dojah_reference: read.dojahReference,
    p_id_type: read.idType,
    p_legal_name: read.governmentName,
    p_date_of_birth: read.governmentDob,
    p_nin_hmac: ninHash,
    p_bvn_hmac: bvnHash,
    p_selfie_match: read.selfie?.match ?? null,
    p_liveness: read.selfie?.liveness ?? null,
    p_document_type: read.document?.type ?? null,
    p_country: read.country,
    p_proxy: read.proxy,
    p_reasons: verdict.kind === "passed" || verdict.kind === "review" || verdict.kind === "retry" ? reasons : [],
    p_files: files,
    p_dashboard_url: read.dashboardUrl,
    p_aml: aml,
    p_summary: {
      lifecycle: read.lifecycle,
      overall: read.overall,
      government_ok: read.governmentOk,
      selfie: read.selfie,
      document: read.document,
      aml_flag: read.amlOk,
      message: read.message,
    },
  });
  if (result === "decided") return { kind: "ignored", reason: "already_decided" };
  return { kind: "recorded", status: result, verdict: verdict.kind };
}

async function copyFiles(deps: ProcessDeps, read: ReadVerification, check: CheckRow): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const base = `${check.subject_id}/${check.id}`;
  const wanted: Array<[keyof ReadVerification["files"], string, string]> = [
    ["selfie", "selfie", "jpg"],
    ["idFront", "id-front", "jpg"],
    ["idBack", "id-back", "jpg"],
    ["report", "report", "pdf"],
  ];
  for (const [key, name, fallback] of wanted) {
    const url = read.files[key];
    if (!url) continue;
    try {
      const path = await deps.copyFile(url, `${base}/${name}.${extensionOf(url, fallback)}`);
      if (path) out[key] = path;
    } catch {
      /* A file that would not copy is not a reason to lose the result. */
    }
  }
  return out;
}
