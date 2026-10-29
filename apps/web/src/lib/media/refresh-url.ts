"use server";

import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { parseSignedLink } from "./signed-link";

/**
 * A FRESH LINK FOR A MEDIA FILE WHOSE SIGNED LINK RAN OUT (29 October 2026).
 *
 * Signed links last an hour. A listing page left open, or one the service
 * worker kept, plays a video whose link has expired: the player says "could
 * not be played" for a clip that is fine. `SafeVideo` calls this once, with
 * the link it has, and gets a new one.
 *
 * The link is only ever READ for its bucket and path. The new one is signed
 * under the CALLER'S OWN session, so the storage rules decide whether this
 * person may see that file: asking for somebody else's private file yields
 * nothing, exactly as it would have the first time. Only the buckets that
 * serve media to the app are accepted, and only a link on this project's own
 * storage host, so the action cannot be used to sign an arbitrary address.
 */

export async function refreshMediaUrl(input: { url: string }): Promise<ActionResult<{ url: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (typeof input?.url !== "string" || input.url.length > 2048) return fail("That link could not be refreshed.");
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const parsed = parseSignedLink(input.url, projectUrl);
  if (!parsed) return fail("That link could not be refreshed.");
  const { data, error } = await session.supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 3600);
  if (error || !data?.signedUrl) return fail("That link could not be refreshed.");
  return ok({ url: data.signedUrl });
}
