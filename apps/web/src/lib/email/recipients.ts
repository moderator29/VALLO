import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { settingsSwitchIsOff } from "../notify/in-app";
import type { Database } from "../supabase/database.types";

/**
 * Recipient resolution for transactional email.
 *
 * The rule this file exists to enforce: an address is either the signed-in
 * user's own, taken from their session, or it was read from the database by
 * the service role. Nothing else is ever emailed. There is no path here that
 * accepts an address from a client.
 *
 * Every function is quiet on failure and returns null. A missing service key,
 * a missing profile, an agent whose auth user has been deleted: all of them
 * mean "no email for this party", never an exception, because every caller is
 * a best-effort side effect of an action that has already committed.
 */

type AdminClient = SupabaseClient<Database>;

export type Contact = {
  email: string;
  /** Their display name, when we have one worth greeting them by. */
  name: string | null;
};

/**
 * The switches on /settings, as the send path sees them.
 *
 * They map onto profiles.settings.notifications one for one, which is what
 * makes the promise on that card checkable: turn Bookings off and no booking
 * email is sent, because the recipient cannot be resolved for that channel at
 * all. Enforcing it here rather than at each send site is deliberate. There
 * are nine send sites and there will be more, and a rule that has to be
 * remembered at every one of them is a rule that will be forgotten at one.
 */
export type EmailChannel = "bookings" | "messages" | "wallet" | "marketing";

/**
 * Has this person asked not to hear about this?
 *
 * Reads through whatever client is passed: the service role when we are
 * emailing a third party, the caller's own RLS-bound client when we are
 * emailing them about something they just did. Only an explicit false
 * silences. A missing row, a missing key, a malformed document or an
 * unreachable database all mean "they never said no", and the mail goes: the
 * failure direction for a transactional email is to send it.
 */
export async function emailMuted(
  client: SupabaseClient<Database>,
  userId: string,
  channel: EmailChannel,
): Promise<boolean> {
  try {
    const { data } = await client
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .maybeSingle();
    /* The same reading the in-app door uses (lib/notify/in-app): only an
       explicit false silences. */
    return settingsSwitchIsOff(data?.settings, channel);
  } catch {
    return false;
  }
}

/**
 * The signed-in user's own contact details, when they still want mail on this
 * channel. The async twin of contactFromSession, for the sends that go to the
 * person who just performed the action.
 */
export async function contactForSelf(
  client: SupabaseClient<Database>,
  user: User,
  channel: EmailChannel,
): Promise<Contact | null> {
  if (await emailMuted(client, user.id, channel)) return null;
  return contactFromSession(user);
}

/**
 * The service-role client, or null when the service key is absent. Callers
 * that cannot resolve a third party's address then skip that email quietly
 * rather than failing.
 */
export function adminOrNull(): AdminClient | null {
  if ((process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length === 0) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** The signed-in user's own contact details, straight off their session. */
export function contactFromSession(user: User): Contact | null {
  const email = (user.email ?? "").trim();
  if (email.length === 0) return null;
  const metadataName = user.user_metadata["full_name"] as string | undefined;
  const name = (metadataName ?? "").trim();
  return { email, name: name.length > 0 ? name : null };
}

/** A profile display name, or null. Used to greet a party by name. */
async function displayName(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const name = (data?.display_name ?? "").trim();
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/**
 * Any user's contact details by auth id. profiles carries no email column by
 * design, so the address comes from the GoTrue admin API with the service key,
 * and the greeting name from profiles.
 */
export async function contactForUser(
  admin: AdminClient,
  userId: string,
  /** When given, a person who has switched this channel off resolves to null. */
  channel?: EmailChannel,
): Promise<Contact | null> {
  const resolved = await resolveContact(admin, userId, channel);
  return resolved.kind === "ok" ? resolved.contact : null;
}

/**
 * Why there is no address, when that matters to the caller.
 *
 * MEASURED, 13 November 2026, project uccixoonmbhrnyczyigt. Five of the
 * eighty-five rows ever written to `public.email_outbox` are DROPPED, and four
 * of them carry the one reason string `no contact for recipient`. That string
 * is the whole of what the queue knows, and it stands for four different
 * conditions with four different right answers:
 *
 *   the person switched this channel off      terminal, and correct
 *   their auth record carries no address      terminal, and correct
 *   the account is gone                       terminal, and correct
 *   GoTrue could not be reached just then     TRANSIENT, and dropping it
 *                                             throws the letter away
 *
 * `contactForUser` collapses all four into null by design, because its nine
 * other callers are best-effort sends that have nothing better to do with the
 * difference. The drain does: it holds a durable row it is allowed to put back.
 * Under the old reading, a GoTrue blip during one drain pass permanently
 * DROPPED every row in that batch, and the column would have said the
 * recipients had no address. So the reason is resolved once, here, where the
 * reads happen, and the queue decides what to do with it.
 */
export type ContactResolution =
  | { kind: "ok"; contact: Contact }
  /** They have switched this channel off on /settings. Terminal. */
  | { kind: "muted" }
  /** The auth record has no address, or there is no auth record. Terminal. */
  | { kind: "no-address" }
  /** The directory could not be read. Transient: ask again later. */
  | { kind: "unreachable" };

/**
 * The address and the reason, for a caller that can act on the reason.
 *
 * The one thing worth being exact about: an error FROM GoTrue and an empty
 * address are told apart, which `contactForUser` could not do. A 500 or a
 * network failure is `unreachable`; a successful read with no address on the
 * record, or no record at all, is `no-address`.
 */
export async function resolveContact(
  admin: AdminClient,
  userId: string,
  channel?: EmailChannel,
): Promise<ContactResolution> {
  if (channel) {
    /* `emailMuted` already fails open, so an unreadable profile is not a mute
       and the mail still goes. */
    if (await emailMuted(admin, userId, channel)) return { kind: "muted" };
  }
  let found: { email: string } | null;
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return { kind: "unreachable" };
    const email = (data?.user?.email ?? "").trim();
    found = email.length > 0 ? { email } : null;
  } catch {
    /* The client threw rather than answering, which is the same condition as
       an error on the response and never a statement about the person. */
    return { kind: "unreachable" };
  }
  if (!found) return { kind: "no-address" };
  return { kind: "ok", contact: { email: found.email, name: await displayName(admin, userId) } };
}

/**
 * The agent behind a listing, as an email recipient. listings.agent_id points
 * at public.agents, whose user_id is the auth user, so the address is one hop
 * further than it looks. The agent's own display_name is preferred over their
 * profile name, because that is the name they trade under.
 */
export async function contactForAgent(
  admin: AdminClient,
  agentId: string,
  /** When given, a host who has switched this channel off resolves to null. */
  channel?: EmailChannel,
): Promise<Contact | null> {
  try {
    const { data: agent } = await admin
      .from("agents")
      .select("user_id, display_name")
      .eq("id", agentId)
      .maybeSingle();
    if (!agent) return null;

    const contact = await contactForUser(admin, agent.user_id, channel);
    if (!contact) return null;

    const trading = (agent.display_name ?? "").trim();
    return trading.length > 0 ? { email: contact.email, name: trading } : contact;
  } catch {
    return null;
  }
}
