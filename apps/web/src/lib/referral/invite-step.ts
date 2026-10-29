import "server-only";

import { createClient } from "@/lib/supabase/server";

export type InviteStep = "phone" | "setup" | "email";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * The invited member's own next step toward counting for the person who
 * invited them (`public.my_invite_step`, 27 October 2026): null when they were
 * not invited, already count, or the read failed. A failed read is "nothing to
 * show", never a blocking error: this is a nudge, not a gate.
 */
export async function myInviteStep(): Promise<InviteStep | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase.rpc as unknown as Rpc)("my_invite_step");
    if (error) return null;
    return data === "phone" || data === "setup" || data === "email" ? data : null;
  } catch {
    return null;
  }
}
