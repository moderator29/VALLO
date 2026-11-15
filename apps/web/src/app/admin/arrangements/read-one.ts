import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toOpsRow, type ArrangementOpsRow } from "./read";

/**
 * ONE ARRANGEMENT'S RECORD, for the dispute desk (BUILD 7.11): the row as
 * the list shows it, who pays and who is paid, and the arrangement's own
 * event trail, oldest first, which carries each side's statement and every
 * report the provider made. Read-only; the door is finance, as for the list.
 */
export type ArrangementEvent = {
  id: string;
  at: string | null;
  from: string | null;
  to: string;
  source: string;
  refused: boolean;
  providerState: string | null;
  /** What the event carried, as short lines a person can read. */
  notes: string[];
};

export type ArrangementRecordRead =
  | { state: "ok"; row: ArrangementOpsRow; agreementId: string | null; payerName: string | null; listerName: string | null; events: ArrangementEvent[] }
  | { state: "forbidden" }
  | { state: "not_found" }
  | { state: "unavailable" };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v : null);

/** The words of an event's detail a decision is made on. Anything else in it is the machine's. */
export function eventNotes(detail: unknown): string[] {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return [];
  const d = detail as Record<string, unknown>;
  const notes: string[] = [];
  const statement = str(d.statement);
  if (statement) notes.push(`${str(d.opened_by) === "lister" ? "The lister" : "The payer"} said: ${statement}`);
  const reason = str(d.reason);
  if (reason) notes.push(`Staff reason: ${reason}`);
  if (d.payer_reported_transfer === true) notes.push("The payer said the transfer was made.");
  if (str(d.release_refused)) notes.push("The partner refused the release instruction.");
  if (str(d.refund_refused)) notes.push("The partner refused the refund instruction.");
  if (str(d.partial_of)) notes.push(`The partner reported only part of the amount as ${str(d.partial_of)}.`);
  const payout = str(d.payout);
  if (payout) notes.push(`The partner reported the transfer to the lister's bank as ${payout}.`);
  if (str(d.refused)) notes.push(`Not recorded: ${String(d.refused).replace(/_/g, " ")}.`);
  return notes;
}

export async function readArrangementRecord(id: string): Promise<ArrangementRecordRead> {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") return { state: "forbidden" };
  let service: SupabaseClient;
  try {
    service = createAdminClient() as unknown as SupabaseClient;
  } catch {
    return { state: "unavailable" };
  }
  try {
    const { data, error } = await service.from("provider_arrangements").select("*").eq("id", id).maybeSingle();
    if (error) return { state: "unavailable" };
    const raw = (data ?? null) as Record<string, unknown> | null;
    const row = raw ? toOpsRow(raw) : null;
    if (!raw || !row) return { state: "not_found" };
    const people = [str(raw.buyer_user_id), str(raw.seller_user_id)].filter((v): v is string => v !== null);
    const [events, profiles] = await Promise.all([
      service
        .from("provider_arrangement_events")
        .select("id, from_status, to_status, source, provider_state, refused, detail, observed_at")
        .eq("arrangement_id", id)
        .order("observed_at", { ascending: true })
        .limit(200),
      service.from("profiles").select("id, display_name").in("id", people),
    ]);
    if (events.error) return { state: "unavailable" };
    const names = new Map(((profiles.data ?? []) as Record<string, unknown>[]).map((p) => [p.id, str(p.display_name)]));
    return {
      state: "ok",
      row,
      agreementId: str(raw.agreement_id),
      payerName: names.get(raw.buyer_user_id) ?? null,
      listerName: names.get(raw.seller_user_id) ?? null,
      events: ((events.data ?? []) as Record<string, unknown>[]).map((e) => ({
        id: String(e.id),
        at: str(e.observed_at),
        from: str(e.from_status),
        to: str(e.to_status) ?? "unknown",
        source: str(e.source) ?? "unknown",
        refused: e.refused === true,
        providerState: str(e.provider_state),
        notes: eventNotes(e.detail),
      })),
    };
  } catch {
    return { state: "unavailable" };
  }
}
