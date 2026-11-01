import { z } from "zod";
import { readPersonBadges } from "@/lib/trust/badge-tier";
import { callerOf, NOT_SIGNED_IN, when } from "./private-common";
import { defineTool } from "./types";

type Row = Record<string, unknown>;
type Q = {
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
  auth: { getUser: () => PromiseLike<{ data: { user: { created_at?: string } | null } }> };
};

/**
 * ONLY what the member could read about themselves, and only the safe part:
 * a display name, a handle, a verification tier, whether a phone is confirmed
 * (yes or no, never the number), and when they joined. Never an email, a phone
 * number, a password, a passcode, a token or anybody else's data.
 */
export const getAccountSummaryTool = defineTool({
  name: "get_account_summary",
  description:
    "Read a short, safe summary of the person's own account: display name, handle, verification tier, whether their phone is confirmed (yes or no) and when they joined. Never their email or phone number. Read only.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "account_info",
  workspaces: ["consumer"],
  async run(ctx) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const db = who.supabase as Q;
    try {
      const [{ data: sp }, { data: phone }, auth] = await Promise.all([
        db.from("social_profiles").select("handle, display_label").eq("user_id", who.userId).maybeSingle(),
        db.from("confirmed_phones").select("user_id").eq("user_id", who.userId).maybeSingle(),
        db.auth.getUser(),
      ]);
      const badges = await readPersonBadges(who.supabase as Parameters<typeof readPersonBadges>[0], [who.userId]);
      const profile = (sp ?? {}) as Row;
      const tier = badges.get(who.userId) ?? "none";
      const rows = [
        { label: "Name", value: String(profile.display_label ?? "Not set") },
        { label: "Handle", value: profile.handle ? `@${String(profile.handle)}` : "Not claimed yet" },
        { label: "Verification", value: tier === "none" ? "No mark yet" : tier },
        { label: "Phone confirmed", value: phone ? "Yes" : "No" },
        ...(auth.data.user?.created_at ? [{ label: "Member since", value: when(auth.data.user.created_at) }] : []),
      ];
      return { data: { rows }, events: [{ type: "summary", title: "Your account", rows }] };
    } catch {
      return { data: { error: "Your account summary could not be read just now." } };
    }
  },
});
