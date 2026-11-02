import "server-only";

import { resolveSession } from "@/lib/actions/session";

/**
 * The signed-in person's open request for one more photo (a selfie holding
 * their ID), or null. Read through their own session: the table's policy lets
 * a person read only their own requests.
 */
export type OpenVerificationRequest = { id: string; message: string; requestedAt: string };

export async function readOpenVerificationRequest(): Promise<OpenVerificationRequest | null> {
  try {
    const session = await resolveSession();
    if (session.state !== "signed-in") return null;
    const { data, error } = await (session.supabase as unknown as {
      from(t: string): {
        select(c: string): {
          eq(c: string, v: string): {
            eq(c: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
          };
        };
      };
    })
      .from("verification_requests")
      .select("id, message, requested_at")
      .eq("subject_id", session.user.id)
      .eq("status", "open")
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: string; message: string; requested_at: string };
    return { id: row.id, message: row.message, requestedAt: row.requested_at };
  } catch {
    return null;
  }
}
