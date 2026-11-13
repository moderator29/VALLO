"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { createAdminClient } from "../supabase/admin";
import { getLocale } from "../locale";
import { writeAudit } from "./audit";
import { requireAdmin, type AdminAccess } from "./guard";

/**
 * Taking, releasing and bulk decisions are open to anybody holding one of the
 * queue scopes, not only moderation: a listings reviewer claims listings. Each
 * per-item action and database function checks that item's own scope again.
 */
async function requireOperator(): Promise<AdminAccess> {
  let last: AdminAccess = { state: "not-admin" };
  for (const scope of ["moderation", "listing_approval", "kyc_review", "support"] as const) {
    last = await requireAdmin(scope);
    if (last.state === "admin") return last;
  }
  return last;
}
import { reviewAgentApplication, reviewListing, setTicketStatus } from "./actions";
import { claimIsLive, probablyNotAPerson, readItemKey, readViewFilters, viewHref, type QueueKind } from "./queue-desk";

/**
 * THE QUEUE DESK'S VERBS. V-89.
 *
 * Take and release write through `queue_take` / `queue_release`, which check
 * the operator role in the database and write their own audit rows. The bulk
 * verbs call the SAME per-item actions the desks use (so a bulk approve is
 * exactly N single approves, with every guard those carry), and add one
 * `queue.bulk` audit row per item sharing one `batch_id`, so a batch can be
 * read back as one decision. A verb that does not apply to a kind (approving
 * a support ticket) is skipped and counted, never forced.
 */

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

function back(formData: FormData, extra: Record<string, string> = {}): string {
  const filters = readViewFilters({
    tab: formData.get("tab") ?? undefined,
    q: formData.get("q") ?? undefined,
    lane: formData.get("lane") ?? undefined,
  });
  const href = viewHref(filters);
  const params = new URLSearchParams(extra).toString();
  return params ? `${href}${href.includes("?") ? "&" : "?"}${params}` : href;
}

export async function takeRow(formData: FormData): Promise<void> {
  const access = await requireOperator();
  if (access.state !== "admin") redirect("/admin");
  const item = readItemKey(formData.get("item"));
  let outcome = "failed";
  if (item) {
    const { data, error } = await (access.userClient as unknown as Rpc).rpc("queue_take", { p_kind: item.kind, p_item: item.id });
    const status = (data as { status?: string } | null)?.status;
    outcome = !error && status === "ok" ? "taken" : status === "taken" ? "held" : "failed";
  }
  revalidatePath("/admin/queue");
  redirect(back(formData, { claim: outcome }));
}

export async function releaseRow(formData: FormData): Promise<void> {
  const access = await requireOperator();
  if (access.state !== "admin") redirect("/admin");
  const item = readItemKey(formData.get("item"));
  if (item) await (access.userClient as unknown as Rpc).rpc("queue_release", { p_kind: item.kind, p_item: item.id });
  revalidatePath("/admin/queue");
  redirect(back(formData, { claim: "released" }));
}

const VERBS = ["approve", "send_back", "assign", "take", "close_spam"] as const;
type Verb = (typeof VERBS)[number];

export async function bulkAct(formData: FormData): Promise<void> {
  const access = await requireOperator();
  if (access.state !== "admin") redirect("/admin");

  const verbRaw = formData.get("verb");
  const verb = (VERBS as readonly string[]).includes(String(verbRaw)) ? (verbRaw as Verb) : null;
  const items = formData
    .getAll("item")
    .map(readItemKey)
    .filter((x): x is { kind: QueueKind; id: string } => x !== null)
    .slice(0, 50);
  if (!verb || items.length === 0) redirect(back(formData, { bulk: "none" }));

  const reasons = getDictionary(await getLocale()).platform.queueDesk.sendBackReasons;
  const reasonKey = String(formData.get("reason") ?? "");
  /* A reason belongs to a kind: "the photos" is a listing's, "the documents" an application's. */
  const reasonFor = (kind: QueueKind): string | null =>
    kind === "listing" || kind === "application" ? ((reasons[kind] as Record<string, string>)[reasonKey] ?? null) : null;
  const assignee = String(formData.get("to") ?? "");
  const batchId = randomUUID();
  /* The claim doors decide on auth.uid(), so they are called with the
     operator's own client, never the service client a scoped staff member's
     reads use. */
  const rpc = access.userClient as unknown as Rpc;

  /* Another operator's live claim is theirs: bulk skips it and says so. */
  const { data: claimRows, error: claimError } = await (access.supabase as unknown as {
    from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: unknown; error: unknown }> } };
  })
    .from("queue_claims")
    .select("kind, item_id, claimed_by, touched_at")
    .in("item_id", items.map((i) => i.id));
  const heldByOther = new Set(
    (Array.isArray(claimRows) ? (claimRows as { kind: string; item_id: string; claimed_by: string; touched_at: string }[]) : [])
      .filter((c) => c.claimed_by !== access.user.id && claimIsLive(c.touched_at, Date.now()))
      .map((c) => `${c.kind}:${c.item_id}`),
  );
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    let outcome: "done" | "skipped" | "failed" = "skipped";
    const reason = reasonFor(item.kind);
    try {
      /* Claims unreadable: nobody can say whose a row is, so only "take" (which the database checks) goes ahead. */
      if ((claimError || heldByOther.has(`${item.kind}:${item.id}`)) && verb !== "take") {
        outcome = "skipped";
      } else if (verb === "take" || verb === "assign") {
        if (verb === "assign" && !/^[0-9a-f-]{36}$/i.test(assignee)) {
          outcome = "failed";
        } else {
          const { data, error } =
            verb === "take"
              ? await rpc.rpc("queue_take", { p_kind: item.kind, p_item: item.id, p_batch: batchId })
              : await rpc.rpc("queue_assign", { p_kind: item.kind, p_item: item.id, p_to: assignee, p_batch: batchId });
          outcome = !error && (data as { status?: string } | null)?.status === "ok" ? "done" : "failed";
        }
      } else if (verb === "approve" || verb === "send_back") {
        if (verb === "send_back" && !reason) {
          outcome = "failed";
        } else if (item.kind === "listing") {
          const r = await reviewListing({ listingId: item.id, decision: verb === "approve" ? "approve" : "request_changes", notes: reason ?? undefined });
          outcome = r.ok ? "done" : "failed";
        } else if (item.kind === "application") {
          const r = await reviewAgentApplication({
            applicationId: item.id,
            decision: verb === "approve" ? "approve" : "request_changes",
            notes: reason ?? undefined,
          });
          outcome = r.ok ? "done" : "failed";
        }
      } else if (verb === "close_spam" && item.kind === "ticket") {
        /* The lane is a read-time guess; the server checks it again before closing anything. */
        const { data: ticket } = await (access.supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown }> } };
          };
        })
          .from("support_tickets")
          .select("user_id, body, topic")
          .eq("id", item.id)
          .maybeSingle();
        const row = ticket as { user_id: string | null; body: string; topic: string | null } | null;
        if (row && probablyNotAPerson({ hasAccount: row.user_id !== null, body: row.body, topic: row.topic })) {
          const r = await setTicketStatus({
            ticketId: item.id,
            status: "closed",
            note: "Closed in bulk as probably not a person: no account, and a link or domain pitch.",
          });
          outcome = r.ok ? "done" : "failed";
        }
      }
    } catch {
      outcome = "failed";
    }
    if (outcome === "done") done += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;

    /* take and assign write their own row, with the batch id, in the database. */
    if (verb !== "take" && verb !== "assign" && outcome !== "skipped") {
      try {
        await writeAudit(createAdminClient(), {
          actorId: access.user.id,
          action: "queue.bulk",
          entityType: item.kind,
          entityId: item.id,
          detail: { batch_id: batchId, verb, outcome, reason_key: verb === "send_back" ? reasonKey : null },
        });
      } catch {
        /* No service key: the per-item action's own audit row still stands. */
      }
    }
  }

  catalogueChanged();
  revalidatePath("/admin/queue");
  redirect(back(formData, { bulk: `${done}-${skipped}-${failed}` }));
}

export async function saveView(formData: FormData): Promise<void> {
  const access = await requireOperator();
  if (access.state !== "admin") redirect("/admin");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const filters = readViewFilters({ tab: formData.get("tab"), q: formData.get("q"), lane: formData.get("lane") });
  if (name.length > 0) {
    await (access.supabase as unknown as { from: (t: string) => { insert: (row: unknown) => PromiseLike<unknown> } })
      .from("admin_saved_views")
      .insert({ owner: access.user.id, name, filters, shared: formData.get("shared") === "on" });
  }
  revalidatePath("/admin/queue");
  redirect(back(formData, { view: name.length > 0 ? "saved" : "unnamed" }));
}

export async function deleteView(formData: FormData): Promise<void> {
  const access = await requireOperator();
  if (access.state !== "admin") redirect("/admin");
  const id = String(formData.get("id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    await (access.supabase as unknown as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => PromiseLike<unknown> } } };
    })
      .from("admin_saved_views")
      .delete()
      .eq("id", id)
      .eq("owner", access.user.id);
  }
  revalidatePath("/admin/queue");
  redirect(back(formData));
}
