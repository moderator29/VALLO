import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./guard";

/**
 * THE DOJAH CHECKS ON THE KYC DESK. Read with the service role after
 * `requireAdmin("kyc_review")`: the table has no staff policy, on purpose,
 * because it holds the NIN / BVN hashes. Those are never selected here.
 */

export type IdentityCheckView = {
  id: string;
  subjectId: string;
  name: string | null;
  status: string;
  environment: string;
  dojahReference: string | null;
  idType: string | null;
  legalName: string | null;
  dateOfBirth: string | null;
  selfieMatch: number | null;
  liveness: number | null;
  documentType: string | null;
  country: string | null;
  proxy: boolean | null;
  reasons: string[];
  files: Partial<Record<"selfie" | "idFront" | "idBack" | "report", string>>;
  dashboardUrl: string | null;
  aml: { match_status?: string | null; risk_level?: string | null; total_results?: number; error?: string; results?: Array<{ name?: string | null; source_type?: string | null }> } | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** The name the person gave Vallo, for the reviewer to compare. */
  valloName: string | null;
};

export type IdentityChecksRead = { state: "ok"; waiting: IdentityCheckView[]; decided: IdentityCheckView[] } | { state: "unavailable" };

const COLUMNS =
  "id, subject_id, status, environment, dojah_reference, id_type, legal_name, date_of_birth, selfie_match, liveness, document_type, country, proxy, reasons, files, dashboard_url, aml, decision_note, decided_at, created_at, updated_at";

type Row = Record<string, unknown>;

export async function getIdentityChecks(): Promise<IdentityChecksRead> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return { state: "unavailable" };
  try {
    const admin = createAdminClient();
    const loose = admin as unknown as {
      from(t: string): {
        select(c: string): {
          in(c: string, v: string[]): {
            order(c: string, o: { ascending: boolean }): { limit(n: number): Promise<{ data: Row[] | null; error: unknown }> };
          };
        };
      };
    };
    const [open, done] = await Promise.all([
      loose.from("identity_checks").select(COLUMNS).in("status", ["review", "retry", "waiting"]).order("created_at", { ascending: true }).limit(60),
      loose.from("identity_checks").select(COLUMNS).in("status", ["approved", "refused", "passed"]).order("updated_at", { ascending: false }).limit(12),
    ]);
    if (open.error || done.error) return { state: "unavailable" };
    const rows = [...(open.data ?? []), ...(done.data ?? [])];
    const ids = [...new Set(rows.map((r) => String(r.subject_id)))];
    const names = new Map<string, string | null>();
    const applied = new Map<string, string | null>();
    if (ids.length > 0) {
      const people = await (admin as unknown as {
        from(t: string): { select(c: string): { in(c: string, v: string[]): Promise<{ data: Row[] | null }> } };
      })
        .from("profiles")
        .select("id, display_name, first_name, surname")
        .in("id", ids);
      for (const p of people.data ?? []) {
        const legal = [p.first_name, p.surname].map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean).join(" ");
        names.set(String(p.id), typeof p.display_name === "string" ? p.display_name : legal || null);
        applied.set(String(p.id), legal || null);
      }
      const apps = await (admin as unknown as {
        from(t: string): { select(c: string): { in(c: string, v: string[]): Promise<{ data: Row[] | null }> } };
      })
        .from("agent_applications")
        .select("user_id, full_name, created_at")
        .in("user_id", ids);
      const newest = new Map<string, { at: string; name: string }>();
      for (const a of apps.data ?? []) {
        const name = typeof a.full_name === "string" ? a.full_name.trim() : "";
        const at = String(a.created_at ?? "");
        const key = String(a.user_id);
        if (name && (!newest.has(key) || newest.get(key)!.at < at)) newest.set(key, { at, name });
      }
      for (const [key, value] of newest) applied.set(key, value.name);
    }
    const view = (r: Row): IdentityCheckView => ({
      id: String(r.id),
      subjectId: String(r.subject_id),
      name: names.get(String(r.subject_id)) ?? null,
      status: String(r.status),
      environment: String(r.environment),
      dojahReference: (r.dojah_reference as string | null) ?? null,
      idType: (r.id_type as string | null) ?? null,
      legalName: (r.legal_name as string | null) ?? null,
      dateOfBirth: (r.date_of_birth as string | null) ?? null,
      selfieMatch: r.selfie_match === null || r.selfie_match === undefined ? null : Number(r.selfie_match),
      liveness: r.liveness === null || r.liveness === undefined ? null : Number(r.liveness),
      documentType: (r.document_type as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      proxy: typeof r.proxy === "boolean" ? r.proxy : null,
      reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
      files: (r.files && typeof r.files === "object" ? r.files : {}) as IdentityCheckView["files"],
      dashboardUrl: (r.dashboard_url as string | null) ?? null,
      aml: (r.aml as IdentityCheckView["aml"]) ?? null,
      decisionNote: (r.decision_note as string | null) ?? null,
      decidedAt: (r.decided_at as string | null) ?? null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      valloName: applied.get(String(r.subject_id)) ?? null,
    });
    return { state: "ok", waiting: (open.data ?? []).map(view), decided: (done.data ?? []).map(view) };
  } catch {
    return { state: "unavailable" };
  }
}
