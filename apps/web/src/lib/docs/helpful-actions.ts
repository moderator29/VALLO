"use server";

import { fileSupportTicket } from "@/lib/support/actions";
import { resolveSession } from "@/lib/actions/session";

/**
 * "WAS THIS HELPFUL", the no-vote, written to the support desk.
 *
 * The door is the ordinary support ticket (`fileSupportTicket`), so a "no"
 * lands in the same queue staff already work, with a VAL-SUP reference the
 * reader can quote. It needs a signed-in account because a ticket needs
 * somewhere to reply to; a signed-out reader is shown the contact form
 * instead and nothing is pretended. A "yes" is not sent anywhere: it would
 * be a count nobody reads, and the page says only thanks.
 */

export type HelpfulResult =
  | { ok: true; reference: string }
  | { ok: false; reason: "signed-out" | "failed"; message: string };

/** A document address, kept to a plain path so a ticket never carries a foreign link. */
function cleanPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (!/^[A-Za-z0-9/_\-#.[\]]{1,200}$/.test(path)) return null;
  return path;
}

export async function reportPageNotHelpful(input: { path: string; title: string; note: string }): Promise<HelpfulResult> {
  const path = cleanPath(input.path);
  if (!path) return { ok: false, reason: "failed", message: "That page address was not recognised." };
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return {
      ok: false,
      reason: "signed-out",
      message: "Sign in to send this to the support desk, or use the contact form.",
    };
  }
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 120);
  const note = input.note.replace(/\s+/g, " ").trim().slice(0, 1500);
  const body = `Documentation feedback. Page: ${path} (${title}).\n\n${note || "No note left. The reader marked the page as not helpful."}`;
  const filed = await fileSupportTicket({ topic: "other", kind: "problem", body });
  if (!filed.ok) return { ok: false, reason: "failed", message: filed.error };
  return { ok: true, reference: filed.data.reference };
}
