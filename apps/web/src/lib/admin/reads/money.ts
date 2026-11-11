import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/database.types";
import { requireAdmin } from "../guard";
import type { AdminRead } from "../queries";
import { reconciliationFromAudit, rentFromWhole, type RentChargeLike } from "./money-derive";
import type { ReconciliationHealth, RentCharges } from "./money-types";

/**
 * THE MONEY DESK'S READS, under the founder's reads rule of 22
 * September: select and aggregate only, through the admin's own RLS-bound
 * client from `requireAdmin()`, never the service role. `transactions`,
 * `rent_payments`, `profiles` and `audit_log` all
 * publish their rows to the two admin roles by policy, checked live.
 *
 * NO CAP THAT MAKES A TOTAL LIE. PostgREST aggregates are not enabled on this
 * project, so a sum has to be taken over rows. Every sum here is taken over
 * EVERY row: `readEvery` pages through the table in chunks until it runs out,
 * and the count it reaches is checked against an exact `count` of the same
 * table. Past `READ_CEILING` rows it stops and says so (`complete: false`),
 * and the desk draws that as an incomplete figure rather than as a total.
 *
 * Money is integer kobo throughout. The formatter at the edge divides.
 */

type Client = SupabaseClient<Database>;

const UNAVAILABLE = { state: "unavailable" } as const;
const CHUNK = 1000;

/** Rows a desk will page through before it admits it has not seen them all. */
export const READ_CEILING = 50_000;

/**
 * Every row a query returns, in chunks, up to the ceiling. Null on any error,
 * because half a ledger summed is a wrong number, not a smaller one.
 *
 * `complete` IS MEASURED AGAINST THE WINDOW ASKED FOR, NOT AGAINST `CHUNK`.
 * The last window before a ceiling that is not a whole number of chunks is
 * shorter than `CHUNK`: with `ceiling = 2500` the third window is rows 2000
 * to 2499, five hundred of them. A full five hundred rows means the table had
 * at least 2500 and the read stopped at the ceiling with more behind it;
 * comparing that against `CHUNK` instead called it a short page and reported
 * `complete: true`, which is a desk drawing a partial sum as a total. Every
 * caller today passes the default ceiling, a whole number of chunks, so no
 * figure on the money desk has ever been wrong this way. The next caller to
 * pass a round number like 2500 would have been.
 */
export async function readEvery<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ceiling = READ_CEILING,
): Promise<{ rows: T[]; complete: boolean } | null> {
  const rows: T[] = [];
  for (let from = 0; from < ceiling; from += CHUNK) {
    const to = Math.min(from + CHUNK, ceiling) - 1;
    const asked = to - from + 1;
    const { data, error } = await page(from, to);
    if (error) return null;
    const got = data ?? [];
    rows.push(...got);
    if (got.length < asked) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** An exact row count, without the rows. Null on error. */
export async function exactCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

const DAY_MS = 86_400_000;

/**
 * Every reconciliation run in the last `days`, read from where the job writes
 * its history: `audit_log` rows with action `wallet.reconciliation.run`
 * (`app/api/paystack/reconcile/route.ts`). Readable by the admin roles under
 * `audit_log_admin_select`.
 *
 * `lastReply` stays null: the job's last HTTP reply and verdict are in
 * `private.reconciliation_watch`, which no admin-callable read reaches. That
 * is a request in the scope file, because it needs a migration.
 */
export async function getReconciliationHealth(
  days = 7,
  now = Date.now(),
): Promise<AdminRead<ReconciliationHealth>> {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") return UNAVAILABLE;
  const db: Client = access.supabase;
  try {
    const since = new Date(now - days * DAY_MS).toISOString();
    const [runs, latestClean] = await Promise.all([
      readEvery<{ created_at: string; metadata: unknown }>((from, to) =>
        db
          .from("audit_log")
          .select("created_at, metadata")
          .in("action", ["payment.reconciliation.run", "wallet.reconciliation.run"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      /* The last clean run may be older than the window, and "none in seven
         days" must not read as "never". */
      db
        .from("audit_log")
        .select("created_at")
        .in("action", ["payment.reconciliation.run", "wallet.reconciliation.run"])
        .eq("metadata->>outcome", "clean")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!runs || latestClean.error) return UNAVAILABLE;
    const health = reconciliationFromAudit(
      runs.rows.map((r) => ({ createdAt: r.created_at, metadata: r.metadata })),
      days,
    );
    if (!health.lastCleanAt && latestClean.data) health.lastCleanAt = latestClean.data.created_at;
    if (!health.lastRunAt) {
      const { data: last } = await db
        .from("audit_log")
        .select("created_at")
        .in("action", ["payment.reconciliation.run", "wallet.reconciliation.run"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) health.lastRunAt = last.created_at;
    }
    return { state: "ok", data: health };
  } catch {
    return UNAVAILABLE;
  }
}

/** Ids per `in (...)` filter, so a long list never makes an over-long URL. */
const IN_CHUNK = 200;

/**
 * TENANCY CHARGES, `rent_payments`, the one money path no desk showed.
 *
 * Every row, checked against an exact count, under `rent_payments_admin_select`
 * (read live: admin and super_admin). A charge carries no status of its own;
 * it rides a `bookings` row, so every carrying booking's status is read
 * (`bookings_admin_all`) and every SUCCESSFUL transaction against those
 * bookings (`transactions_admin_select`). `rentFromWhole` turns that into
 * exact counts by state. Titles and tenant names are read only for the rows
 * the panel prints. Select only; nothing here writes.
 */
export async function getRentCharges(latest = 6): Promise<AdminRead<RentCharges>> {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") return UNAVAILABLE;
  const db: Client = access.supabase;
  try {
    const [total, charges] = await Promise.all([
      exactCount(db.from("rent_payments").select("id", { count: "exact", head: true })),
      readEvery<{
        id: string;
        booking_id: string;
        listing_id: string;
        tenant_id: string;
        move_in: string;
        rent_period: string;
        total_minor: number;
        currency: string;
        created_at: string;
      }>((from, to) =>
        db
          .from("rent_payments")
          .select("id, booking_id, listing_id, tenant_id, move_in, rent_period, total_minor, currency, created_at")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    if (total === null || !charges) return UNAVAILABLE;

    const bookingIds = [...new Set(charges.rows.map((c) => c.booking_id))];
    const statusOf = new Map<string, string>();
    const paid = new Set<string>();
    for (let i = 0; i < bookingIds.length; i += IN_CHUNK) {
      const ids = bookingIds.slice(i, i + IN_CHUNK);
      const [bookings, settled] = await Promise.all([
        db.from("bookings").select("id, status").in("id", ids),
        db.from("transactions").select("booking_id").eq("status", "SUCCESSFUL").in("booking_id", ids),
      ]);
      if (bookings.error || settled.error) return UNAVAILABLE;
      for (const b of bookings.data ?? []) statusOf.set(b.id, b.status);
      for (const t of settled.data ?? []) if (t.booking_id) paid.add(t.booking_id);
    }

    const like: RentChargeLike[] = charges.rows.map((c) => ({
      id: c.id,
      bookingId: c.booking_id,
      moveIn: c.move_in,
      rentPeriod: c.rent_period,
      totalMinor: c.total_minor,
      currency: c.currency,
      createdAt: c.created_at,
      bookingStatus: statusOf.get(c.booking_id) ?? null,
      paid: paid.has(c.booking_id),
    }));
    const out = rentFromWhole(like, total, charges.complete, latest);

    const byId = new Map(charges.rows.map((c) => [c.id, c]));
    const listingIds = [...new Set(out.latest.map((r) => byId.get(r.id)?.listing_id).filter((x): x is string => Boolean(x)))];
    const tenantIds = [...new Set(out.latest.map((r) => byId.get(r.id)?.tenant_id).filter((x): x is string => Boolean(x)))];
    const [titles, people] = await Promise.all([
      listingIds.length ? db.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [], error: null }),
      tenantIds.length ? db.from("profiles").select("id, display_name").in("id", tenantIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const titleOf = new Map((titles.data ?? []).map((l: { id: string; title: string | null }) => [l.id, l.title]));
    const nameOf = new Map((people.data ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    return {
      state: "ok",
      data: {
        ...out,
        latest: out.latest.map((r) => {
          const row = byId.get(r.id);
          return {
            ...r,
            listingTitle: (row && titleOf.get(row.listing_id)) ?? null,
            tenantName: (row && nameOf.get(row.tenant_id)) ?? null,
            tenantId: row?.tenant_id ?? null,
          };
        }),
      },
    };
  } catch {
    return UNAVAILABLE;
  }
}
