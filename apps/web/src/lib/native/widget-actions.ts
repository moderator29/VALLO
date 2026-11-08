"use server";

import { createHash, randomBytes } from "node:crypto";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { getAdminClient } from "@/lib/supabase/service";

/**
 * THE WIDGET'S DEVICE-BOUND TOKEN. V-98.
 *
 * Minted by the signed-in app on the phone and handed straight to the native
 * side (`lib/native/widget.ts`); only its SHA-256 is stored
 * (`public.widget_tokens`). It can do one thing: ask `/api/plans/next` for
 * the next commitment at area level. At most three live per account (the
 * oldest is revoked), ninety days each, and every one is revoked by
 * `revokeWidgetTokens` on sign-out.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

export async function mintWidgetToken(label: unknown): Promise<ActionResult<{ token: string; id: string }>> {
  const session = await resolveSession();
  const admin = getAdminClient() as Loose;
  if (session.state !== "signed-in" || !admin) return fail("Could not mint the widget token");
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const name = typeof label === "string" ? label.trim().slice(0, 40) || null : null;
  try {
    const { data: made, error } = await admin
      .from("widget_tokens")
      .insert({ user_id: session.user.id, token_hash: hash, label: name })
      .select("id")
      .single();
    if (error || !made) return fail("Could not mint the widget token");
    /* Three live at most: a fourth phone retires the oldest. */
    const { data } = await admin
      .from("widget_tokens")
      .select("id")
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    const extra = Array.isArray(data) ? (data as { id: string }[]).slice(3).map((r) => r.id) : [];
    if (extra.length > 0) await admin.from("widget_tokens").update({ revoked_at: new Date().toISOString() }).in("id", extra);
    return ok({ token, id: (made as { id: string }).id });
  } catch {
    return fail("Could not mint the widget token");
  }
}

/**
 * Is the token this phone's widget holds still good? The widget's own 401 is
 * seen by the native side, not here, so the app asks on start: revoked (sign
 * out everywhere, a hold, a deletion request), expired or unknown means the
 * widget is dead, and the app clears its marker and mints afresh. Null when
 * it cannot be read, which changes nothing.
 */
export async function widgetTokenLive(id: unknown): Promise<boolean | null> {
  const session = await resolveSession();
  const admin = getAdminClient() as Loose;
  if (session.state !== "signed-in" || !admin || typeof id !== "string" || id.length > 64) return null;
  try {
    const { data, error } = await admin
      .from("widget_tokens")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) return null;
    return data !== null;
  } catch {
    return null;
  }
}

export async function revokeWidgetTokens(): Promise<void> {
  const session = await resolveSession();
  const admin = getAdminClient() as Loose;
  if (session.state !== "signed-in" || !admin) return;
  try {
    await admin
      .from("widget_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .is("revoked_at", null);
  } catch {
    /* Best effort; each token still expires in ninety days. */
  }
}
