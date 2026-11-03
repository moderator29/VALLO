"use server";

import { z } from "zod";
import { resolveSession } from "@/lib/actions/session";
import { getListingRepository } from "@/lib/listings/repository";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { nextSeen, seenKeys, type SeenRow } from "./activity";

/**
 * Note one listing the member opened, for "Picked for you" (see `activity.ts`).
 *
 * Only when the DATABASE says the assistant is on and Saved preferences are
 * granted (`ai_assistant_can`, asked directly so a member who has not granted
 * it is not logged as a refusal for merely opening a page). Off or revoked,
 * nothing is written. Never says anything back but whether it noted it.
 *
 * "use server": async exports only.
 */

type Db = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  from: (t: string) => {
    select: (c: string) => { eq: (c: string, v: string) => { like: (c: string, p: string) => PromiseLike<{ data: unknown; error: unknown }> } };
    upsert: (row: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: unknown }>;
  };
};

export async function recordAssistantOpen(input: unknown): Promise<{ recorded: boolean }> {
  const parsed = z.object({ listingId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { recorded: false };
  const session = await resolveSession();
  if (session.state !== "signed-in") return { recorded: false };
  const db = session.supabase as unknown as Db;
  try {
    const { data: can } = await db.rpc("ai_assistant_can", { p_permission: "saved_prefs" });
    if (can !== true) return { recorded: false };
    const pace = await consume({ bucket: "assistant_activity", subject: subjectForUser(session.user.id), limit: 60, windowSeconds: 3_600 });
    if (!pace.allowed) return { recorded: false };
    const l = await getListingRepository().byId(parsed.data.listingId);
    if (!l || l.isDemo) return { recorded: false };
    const { data } = await db.from("ai_learned_preferences").select("key, weight, updated_at").eq("user_id", session.user.id).like("key", "seen:%");
    const existing: SeenRow[] = (Array.isArray(data) ? data : []).map((r) => {
      const row = r as { key: unknown; weight: unknown; updated_at: unknown };
      return { key: String(row.key), weight: Number(row.weight) || 0, updatedAt: Date.parse(String(row.updated_at)) || 0 };
    });
    const now = Date.now();
    let wrote = false;
    for (const key of seenKeys({ kind: l.kind, area: l.area, city: l.city, bedrooms: l.bedrooms, priceMinor: l.priceMinor })) {
      const next = nextSeen(key, existing, now);
      if (!next) continue;
      const [dimension, ...rest] = key.slice("seen:".length).split(":");
      const { error } = await db.from("ai_learned_preferences").upsert(
        {
          user_id: session.user.id,
          key: next.key,
          value: { dimension, value: rest.join(":"), from: "opened" },
          source: "activity",
          weight: next.weight,
          updated_at: new Date(now).toISOString(),
        },
        { onConflict: "user_id,key" },
      );
      if (!error) {
        wrote = true;
        existing.push({ key: next.key, weight: next.weight, updatedAt: now });
      }
    }
    return { recorded: wrote };
  } catch {
    return { recorded: false };
  }
}
