import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { documentOf, mandateOf, stageOf, stateOf, termsOf } from "@/lib/offers/map";
import type { OfferEvent, OfferVersion, Side } from "@/lib/offers/types";
import type { AdminDeal, AdminOfferRow, OffersOverview } from "./model";

/**
 * READS FOR THE OFFERS AND DEALS DESK. Each is an audited definer function
 * called as the signed-in staff member (the database checks the agreements
 * scope and the console's second factor, and writes the view to the audit
 * log). `null` means "could not be read": the desk says so in words and never
 * draws zeros it did not read. A buyer's identity data and the private
 * messages are not in any of these answers.
 */

export type DeskRead = { overview: OffersOverview; rows: AdminOfferRow[] };

type J = Record<string, unknown>;
type Caller = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

async function call(supabase: SupabaseClient<Database>, fn: string, args: Record<string, unknown>): Promise<J | null> {
  const { data, error } = await (supabase as unknown as Caller).rpc(fn, args);
  if (error || !data) return null;
  const answer = data as J;
  return answer.status === "ok" ? answer : null;
}

function rowOf(r: J): AdminOfferRow {
  const pref = r.payment_preference;
  return {
    id: String(r.id),
    reference: String(r.reference ?? ""),
    listingId: String(r.listing_id),
    listingTitle: String(r.listing_title ?? "Property"),
    buyerName: String(r.buyer_name ?? "A member"),
    sellerName: String(r.seller_name ?? "A member"),
    agentName: null,
    askingMinor: num(r.asking_minor),
    amountMinor: num(r.amount_minor),
    state: stateOf(r.status),
    stage: stageOf(r.stage),
    version: num(r.version) || 1,
    paymentPreference: pref === "mortgage" || pref === "instalment" ? pref : "cash",
    submittedAt: String(r.submitted_at ?? r.updated_at ?? ""),
    lastActivityAt: String(r.updated_at ?? ""),
    expiresAt: str(r.expires_at),
    disputed: r.disputed === true,
    caseId: null,
    mandateHeld: r.mandate_live === true,
  };
}

export async function readOffersDesk(supabase: SupabaseClient<Database>): Promise<DeskRead | null> {
  const [list, metrics] = await Promise.all([
    call(supabase, "admin_sale_offers_list", { p_state: null, p_limit: 200 }),
    call(supabase, "admin_sale_offers_metrics", {}),
  ]);
  if (!list || !metrics) return null;
  const rows = (Array.isArray(list.rows) ? (list.rows as J[]) : []).map(rowOf);
  const agreed = num(metrics.agreed);
  const declined = num(metrics.declined);
  return {
    rows,
    overview: {
      windowDays: 7,
      counts: {
        submitted: num(metrics.submitted),
        new: num(metrics.new_7d),
        awaiting_seller: num(metrics.awaiting_seller),
        negotiating: num(metrics.negotiating),
        agreed,
        withdrawn: num(metrics.withdrawn),
        expired: num(metrics.expired),
        completed: num(metrics.completed),
        disputed: num(metrics.disputed),
      },
      medianResponseHours: metrics.median_response_hours == null ? null : num(metrics.median_response_hours),
      acceptance: agreed + declined > 0 ? { agreed, answered: agreed + declined } : null,
    },
  };
}

export async function readAdminDeal(supabase: SupabaseClient<Database>, offerId: string): Promise<AdminDeal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return null;
  const d = await call(supabase, "admin_sale_offer_detail", { p_agreement: offerId });
  if (!d) return null;
  const o = (d.offer ?? {}) as J;
  const row = rowOf({ ...o, mandate_live: o.mandate_live });
  const versions: OfferVersion[] = ((Array.isArray(d.versions) ? d.versions : []) as J[]).map((v) => {
    const terms = termsOf(v.terms);
    return { version: num(v.version), amountMinor: num(v.amount_minor), terms, proposedBy: terms.proposedBy, at: String(v.at ?? ""), changes: [], buyerConfirmed: false, sellerConfirmed: false };
  });
  const events: OfferEvent[] = ((Array.isArray(d.events) ? d.events : []) as J[]).map((e, i) => ({
    id: `${offerId}-${i}`,
    at: String(e.at),
    actor: (e.actor === "system" ? "system" : "seller") as Side | "system",
    actorName: e.actor === "system" ? null : str(e.actor),
    action: String(e.action),
    note: str(e.note),
    version: num(e.version),
  }));
  return {
    row,
    versions,
    events,
    documents: ((Array.isArray(d.documents) ? d.documents : []) as J[]).map(documentOf),
    mandate: mandateOf(o.mandate),
    buyerEligible: d.buyer_eligible === true,
  };
}
