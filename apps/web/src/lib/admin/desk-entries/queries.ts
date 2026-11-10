import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import { cleanFields, isEntryDesk, isEntryStatus, kindDef, type Entry, type EntryDesk } from "./model";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type Row = {
  id: string; desk: string; kind: string; title: string; body: string | null; status: string; due_on: string | null; link_url: string | null;
  subject_user: string | null; fields: unknown; review_note: string | null; approved_by: string | null; approved_at: string | null;
  owner_id: string | null; created_by: string | null; created_at: string; updated_at: string;
};

export const ENTRY_SELECT =
  "id, desk, kind, title, body, status, due_on, link_url, subject_user, fields, review_note, approved_by, approved_at, owner_id, created_by, created_at, updated_at";

export function entryFromRow(r: Row): Entry | null {
  const def = kindDef(r.kind);
  if (!def || !isEntryDesk(r.desk) || def.desk !== r.desk) return null;
  return {
    id: r.id,
    desk: r.desk,
    kind: r.kind,
    title: r.title,
    body: r.body ?? "",
    status: isEntryStatus(r.status) ? r.status : "open",
    dueOn: r.due_on,
    linkUrl: r.link_url,
    subjectUser: r.subject_user,
    fields: cleanFields(def, r.fields),
    reviewNote: r.review_note,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    ownerId: r.owner_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Every entry of one desk, newest first (a row of a kind the code does not know is left out). */
export async function readEntries(db: SupabaseClient, desk: EntryDesk): Promise<DeskRead<Entry[]>> {
  const { data, error } = await db.from("staff_desk_entries").select(ENTRY_SELECT).eq("desk", desk).order("created_at", { ascending: false }).limit(1000);
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    await reportReadFault("read.admin.desk-entries", ...faults(error));
    return { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as Row[]).map(entryFromRow).filter((e): e is Entry => e !== null) };
}

export type Person = { id: string; name: string };

/** Names for a set of ids (display name only), for "about" and "made by" lines. */
export async function readNames(db: SupabaseClient, ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((v): v is string => !!v))];
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  const { data } = await db.from("profiles").select("id, display_name, first_name").in("id", wanted);
  for (const p of (data ?? []) as { id: string; display_name: string | null; first_name: string | null }[]) {
    const name = (p.display_name ?? p.first_name ?? "").trim();
    if (name) out.set(p.id, name);
  }
  return out;
}

/** Everyone with a live support grant: the people a coaching note can be about. */
export async function readSupportAgents(db: SupabaseClient): Promise<Person[]> {
  const { data, error } = await db.from("staff_grants").select("user_id").is("revoked_at", null).contains("scopes", ["support"]).limit(200);
  if (error || !data) return [];
  const ids = (data as { user_id: string }[]).map((r) => r.user_id);
  const names = await readNames(db, ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? "A colleague" })).sort((a, b) => a.name.localeCompare(b.name));
}
