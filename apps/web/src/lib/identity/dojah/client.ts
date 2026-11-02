import type { DojahConfig } from "./config";

/**
 * THE DOJAH REST CLIENT. Server only: the secret key never leaves the server.
 *
 * Every answer is one of a small set of outcomes, mapped from the status codes
 * Dojah documents (errors-status-codes): a caller decides on "not_found" or
 * "wallet" without reading HTTP. Nothing here logs a request or a response:
 * both carry NINs, BVNs, names and photographs.
 */

export type DojahFetch = (url: string, init: RequestInit) => Promise<Response>;

export type DojahFailure =
  /** 400: the identifier was malformed. The person can correct it. */
  | "invalid"
  /** 401 / 403: our keys are wrong or the product is not on the account. */
  | "unauthorised"
  /** 402: the Dojah wallet is empty. Stop, alert, do not retry. */
  | "wallet"
  /** 404: no record for that identifier. */
  | "not_found"
  /** 424 / 5xx / 408 / timeout: NIMC, NIBSS or CAC did not answer. Retry later. */
  | "upstream"
  /** 429: slow down. */
  | "rate_limited"
  /** Anything else, including a body that was not JSON. */
  | "failed";

export type DojahResult<T> = { ok: true; entity: T } | { ok: false; reason: DojahFailure; status: number };

export const DOJAH_TIMEOUT_MS = 20_000;

export function failureFor(status: number): DojahFailure {
  if (status === 400) return "invalid";
  if (status === 401 || status === 403) return "unauthorised";
  if (status === 402) return "wallet";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 424 || status >= 500) return "upstream";
  return "failed";
}

/** Retrying is worth it only for these (the docs' retry table). */
export function retryable(reason: DojahFailure): boolean {
  return reason === "upstream" || reason === "rate_limited";
}

function headers(config: DojahConfig, json: boolean): Record<string, string> {
  const h: Record<string, string> = { Authorization: config.secretKey, AppId: config.appId, Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function call<T>(
  config: DojahConfig,
  path: string,
  init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown },
  doFetch: DojahFetch,
  timeoutMs: number,
): Promise<DojahResult<T>> {
  const url = new URL(path, config.baseUrl);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(url.toString(), {
      method: init.method,
      headers: headers(config, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: failureFor(response.status), status: response.status };
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: "failed", status: response.status };
    }
    /* REST answers wrap the record in `entity`; the verification endpoint does not. */
    const entity = json && typeof json === "object" && "entity" in json ? (json as { entity: unknown }).entity : json;
    if (entity === null || entity === undefined) return { ok: false, reason: "not_found", status: response.status };
    return { ok: true, entity: entity as T };
  } catch {
    return { ok: false, reason: "upstream", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export type DojahClient = ReturnType<typeof dojahClient>;

export function dojahClient(config: DojahConfig, doFetch: DojahFetch = fetch, timeoutMs = DOJAH_TIMEOUT_MS) {
  const get = <T>(path: string, query: Record<string, string>) => call<T>(config, path, { method: "GET", query }, doFetch, timeoutMs);
  const post = <T>(path: string, body: unknown) => call<T>(config, path, { method: "POST", body }, doFetch, timeoutMs);
  return {
    environment: config.environment,

    /** GET /api/v1/kyc/verification: the full EasyOnboard result, by Dojah's reference (DJ-...). */
    verification: (referenceId: string) => get<DojahVerification>("/api/v1/kyc/verification", { reference_id: referenceId }),

    /** GET /api/v1/kyc/vnin: a virtual NIN (the V-49 path already built behind `IdentityProvider`). */
    vnin: (vnin: string) => get<DojahNinRecord>("/api/v1/kyc/vnin", { vnin }),

    /** GET /api/v1/kyc/cac/advance: a company with its directors and shareholders. */
    cacAdvance: (rcNumber: string, companyType: CacCompanyType) =>
      get<DojahCacRecord>("/api/v1/kyc/cac/advance", { rc_number: rcNumber, company_type: companyType }),

    /** POST /api/v2/aml/screening: PEP, sanctions, warnings, adverse media. */
    aml: (input: AmlInput) =>
      post<DojahAmlRecord>("/api/v2/aml/screening", {
        schema: input.schema,
        unique_reference: input.reference,
        properties: {
          names: input.name,
          ...(input.dateOfBirth ? { date_of_birth: input.dateOfBirth } : {}),
          ...(input.nationality ? { nationality: input.nationality } : {}),
          id_number: "",
        },
        screening_options: { pep_check: true, sanction: true, adverse_media_check: true, watchlists: [] },
      }),

    /** GET /api/v1/general/account: the name on a Nigerian bank account (payout name match). */
    resolveNuban: (accountNumber: string, bankCode: string) =>
      get<{ account_number: string; account_name: string }>("/api/v1/general/account", {
        account_number: accountNumber,
        bank_code: bankCode,
      }),
  };
}

/* ------------------------------------------------------------------ shapes */
/* Only the fields Vallo reads. Dojah adds fields freely; nothing breaks. */

export type CacCompanyType =
  | "BUSINESS_NAME"
  | "COMPANY"
  | "INCORPORATED_TRUSTEES"
  | "LIMITED_PARTNERSHIP"
  | "LIMITED_LIABILITY_PARTNERSHIP";

export type DojahNinRecord = {
  nin?: string;
  first_name?: string;
  firstname?: string;
  middle_name?: string;
  middlename?: string;
  last_name?: string;
  surname?: string;
  date_of_birth?: string;
  birthdate?: string;
};

export type DojahCacRecord = {
  company_name?: string;
  rc_number?: string;
  status?: string;
  type_of_company?: string;
  date_of_registration?: string;
  address?: string;
  state?: string;
  city?: string;
  lga?: string;
  affiliates?: Array<{
    first_name?: string;
    last_name?: string;
    affiliate_type?: string;
    nationality?: string;
  }>;
};

export type AmlInput = {
  schema: "individual" | "organization";
  name: string;
  dateOfBirth?: string;
  nationality?: string;
  /** Our own opaque reference. Never a NIN, BVN or phone. */
  reference: string;
};

export type DojahAmlRecord = {
  risk_level?: string;
  match_status?: string;
  total_results?: number;
  results?: Array<{ name?: string; source_type?: string; match_strength?: string; country?: string }>;
};

export type DojahStep = { status?: boolean; message?: string; data?: unknown };

export type DojahVerification = {
  reference_id?: string;
  status?: boolean;
  verification_status?: string;
  verification_type?: string;
  verification_mode?: string;
  id_type?: string;
  message?: string;
  verification_url?: string;
  selfie_url?: string;
  id_url?: string;
  back_url?: string;
  aml?: { status?: boolean };
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  widget_id?: string;
};
