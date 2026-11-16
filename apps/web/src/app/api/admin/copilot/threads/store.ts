import "server-only";
import { requireConsole } from "@/lib/admin/guard";
import { isMissingRelation } from "@/lib/admin/copilot/act";

/**
 * The copilot history routes' shared door: the console door first, then the
 * person's OWN session client, so the table's owner-only policies decide what
 * is read and written (`copilot_threads_2026-11-16.sql`). The table is not in
 * the generated types until it is applied, hence the narrow shape below.
 */

type Res = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
type Query = {
  select: (cols: string) => Query & Res;
  insert: (row: Record<string, unknown>) => Query & Res;
  update: (row: Record<string, unknown>) => Query & Res;
  delete: () => Query & Res;
  eq: (col: string, v: string) => Query & Res;
  order: (col: string, o: { ascending: boolean }) => Query & Res;
  limit: (n: number) => Query & Res;
  maybeSingle: () => Res;
  single: () => Res;
};
export type ThreadsTable = { from: (t: "copilot_threads") => Query };

export type ThreadsDoor = { ok: true; db: ThreadsTable; userId: string } | { ok: false; status: number; message: string };

export async function threadsDoor(): Promise<ThreadsDoor> {
  const door = await requireConsole();
  if (door.state !== "console") return { ok: false, status: door.state === "unconfigured" ? 503 : 403, message: "Sign in to the console again to see your conversations." };
  return { ok: true, db: door.supabase as unknown as ThreadsTable, userId: door.user.id };
}

/** True when the history table has not been created on this database yet. */
export const notSetUp = (error: { code?: string; message?: string } | null | undefined): boolean => isMissingRelation(error);

export const NOT_SET_UP_BODY = { ok: false, state: "not_set_up", message: "Saved history is not switched on for this console yet. This conversation is kept until you close the browser." } as const;
export const NO_STORE = { "cache-control": "no-store" } as const;
