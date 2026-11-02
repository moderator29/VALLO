import { namesMatch } from "../name-match";
import type { DojahVerification } from "./client";

/**
 * WHAT A DOJAH EASYONBOARD RESULT SAYS, READ ONCE (webhooks-signatures,
 * get-verification, verification-statuses).
 *
 * The same shape arrives two ways: the signed `kyc_widget` webhook, and
 * GET /api/v1/kyc/verification. Both go through `readVerification`, so the
 * desk, the decision and the stored summary never disagree about a field.
 *
 * WHAT IS KEPT AND WHAT IS DROPPED. The government number (NIN or BVN) comes
 * back so it can be HMACed at once and dropped (`nin.ts`): only `idNumber`
 * carries it, and the caller never stores it. Names, date of birth, scores and
 * step messages are kept for the reviewer. File links expire in about an hour
 * and are copied into private storage by the webhook, never stored as links.
 */

export type DojahLifecycle = "Ongoing" | "Pending" | "Completed" | "Failed" | "Abandoned";

export type ReadVerification = {
  /** Dojah's reference, DJ-... */
  dojahReference: string | null;
  /** Ours, from `metadata.vallo_ref` (the check row's id), set when the flow was opened. */
  valloRef: string | null;
  lifecycle: DojahLifecycle | null;
  /** The top-level `status`: the session as a whole succeeded. */
  overall: boolean;
  idType: string | null;
  /** NIN or BVN digits, for the HMAC only. Never stored, never logged. */
  idNumber: string | null;
  governmentName: string | null;
  governmentDob: string | null;
  selfie: { ok: boolean; liveness: number | null; match: number | null; message: string | null } | null;
  document: { ok: boolean; type: string | null; message: string | null } | null;
  governmentOk: boolean | null;
  amlOk: boolean | null;
  country: string | null;
  proxy: boolean | null;
  files: { selfie: string | null; idFront: string | null; idBack: string | null; report: string | null };
  dashboardUrl: string | null;
  message: string | null;
};

const LIFECYCLES: readonly DojahLifecycle[] = ["Ongoing", "Pending", "Completed", "Failed", "Abandoned"];

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function url(v: unknown): string | null {
  const s = str(v);
  return s && /^https:\/\//.test(s) ? s : null;
}

/** First non-empty of several spellings: NIMC records arrive with both `first_name` and `firstname`. */
function pick(record: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = str(record[key]);
    if (value) return value;
  }
  return null;
}

function fullName(record: Record<string, unknown> | null): string | null {
  const first = pick(record, "first_name", "firstname");
  const middle = pick(record, "middle_name", "middlename");
  const last = pick(record, "last_name", "surname");
  const name = [first, middle, last].filter(Boolean).join(" ");
  return name || null;
}

/** The government record inside `data.government_data.data`: `nin.entity` or `bvn.entity`. */
function governmentRecord(data: Record<string, unknown> | null): { record: Record<string, unknown> | null; kind: "NIN" | "BVN" | null } {
  const gov = obj(obj(data?.government_data)?.data);
  for (const kind of ["nin", "bvn"] as const) {
    const holder = obj(gov?.[kind]);
    const record = obj(holder?.entity) ?? holder;
    if (record && Object.keys(record).length > 0) return { record, kind: kind.toUpperCase() as "NIN" | "BVN" };
  }
  return { record: null, kind: null };
}

export function readVerification(input: unknown): ReadVerification | null {
  const top = obj(input) as (DojahVerification & Record<string, unknown>) | null;
  if (!top) return null;
  const data = obj(top.data);
  const metadata = obj(top.metadata);
  const lifecycleRaw = str(top.verification_status);
  const lifecycle = LIFECYCLES.find((l) => l.toLowerCase() === lifecycleRaw?.toLowerCase()) ?? null;

  const { record: gov, kind } = governmentRecord(data);
  const govStep = obj(data?.government_data);
  const selfieStep = obj(data?.selfie);
  const selfieData = obj(selfieStep?.data);
  const idStep = obj(data?.id);
  const idData = obj(obj(idStep?.data)?.id_data);
  const ip = obj(metadata?.ipinfo);

  const idType = str(top.id_type) ?? kind;
  const govNumber = pick(gov, kind === "BVN" ? "bvn" : "nin");
  const idNumber = (govNumber && /^\d{11}$/.test(govNumber) ? govNumber : null) ??
    ((idType === "NIN" || idType === "BVN") && /^\d{11}$/.test(str(top.value) ?? "") ? str(top.value) : null);

  return {
    dojahReference: str(top.reference_id),
    valloRef: str(metadata?.vallo_ref),
    lifecycle,
    overall: top.status === true,
    idType,
    idNumber,
    governmentName: fullName(gov),
    governmentDob: pick(gov, "date_of_birth", "birthdate"),
    selfie: selfieStep
      ? {
          ok: selfieStep.status === true,
          liveness: num(selfieData?.liveness_score),
          match: num(selfieData?.match_score),
          message: str(selfieStep.message),
        }
      : null,
    document: idStep ? { ok: idStep.status === true, type: pick(idData, "document_type"), message: str(idStep.message) } : null,
    governmentOk: govStep ? govStep.status === true : null,
    amlOk: bool(obj(top.aml)?.status),
    country: str(ip?.country),
    proxy: bool(ip?.proxy),
    files: {
      selfie: url(top.selfie_url) ?? url(selfieData?.selfie_url),
      idFront: url(top.id_url),
      idBack: url(top.back_url),
      report: url(top.verification_pdf),
    },
    dashboardUrl: url(top.verification_url),
    message: str(top.message),
  };
}

/* ----------------------------------------------------------------- deciding */

/**
 * WHAT VALLO DOES WITH A RESULT. The rule the vNIN check already follows:
 * a machine may PASS a clean result, and never refuses one. Everything that is
 * not clean goes to the KYC desk with the reasons written out, because a
 * broken NIMC record, an old ID photo or bad light is a question for a person.
 *
 *   waiting    Ongoing or Pending: another event is coming.
 *   abandoned  the person left the flow: invite them back, record nothing.
 *   retry      Dojah could not complete it (Failed): they may try again, and
 *              the desk sees the attempt.
 *   passed     Completed, every step passed, the government name matches the
 *              name the person gave Vallo, and the face matched the record.
 *   review     Completed but something is not clean. The reasons say what.
 */
export type DojahVerdict =
  | { kind: "waiting" }
  | { kind: "abandoned" }
  | { kind: "retry"; reasons: string[] }
  | { kind: "passed"; reasons: string[] }
  | { kind: "review"; reasons: string[] };

/** The face score below which a person reads the result, whatever Dojah's own flag said. */
export const SELFIE_MATCH_FLOOR = 80;

export function decideVerification(read: ReadVerification, expectedName: string): DojahVerdict {
  if (read.lifecycle === null || read.lifecycle === "Ongoing" || read.lifecycle === "Pending") return { kind: "waiting" };
  if (read.lifecycle === "Abandoned") return { kind: "abandoned" };
  if (read.lifecycle === "Failed") return { kind: "retry", reasons: [read.message ?? "Dojah could not complete the check."] };

  const reasons: string[] = [];
  const problems: string[] = [];
  if (!read.overall) problems.push("Dojah marked the session as not successful.");
  if (read.governmentOk !== true || !read.governmentName) problems.push("No government record came back.");
  if (!read.selfie) problems.push("No selfie step in the result.");
  else if (!read.selfie.ok) problems.push(`Selfie: ${read.selfie.message ?? "not passed"}.`);
  else if (read.selfie.match !== null && read.selfie.match < SELFIE_MATCH_FLOOR) {
    problems.push(`Face match ${read.selfie.match} is under ${SELFIE_MATCH_FLOOR}.`);
  }
  if (read.document && !read.document.ok) problems.push(`ID document: ${read.document.message ?? "not passed"}.`);
  if (read.proxy === true) problems.push("The session came through a proxy or VPN.");

  if (read.governmentName) {
    const expected = expectedName.trim();
    if (!expected) problems.push("No name on the Vallo account to compare with.");
    else {
      const match = namesMatch(read.governmentName, expected);
      if (match.match) reasons.push(`Name check: ${match.reason}.`);
      else problems.push(`Government name ${read.governmentName} against Vallo name ${expected}: ${match.reason}.`);
    }
  }
  if (read.selfie?.ok && read.selfie.match !== null) reasons.push(`Face match ${read.selfie.match}.`);

  return problems.length === 0 ? { kind: "passed", reasons } : { kind: "review", reasons: [...problems, ...reasons] };
}
