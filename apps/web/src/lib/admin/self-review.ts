import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NOBODY DECIDES THEIR OWN CASE (founder's audit brief, section 2).
 *
 * The desks that read a whole row before deciding (listings, applications,
 * businesses, documents, rungs, agreements) refuse their own case already.
 * These are the subjects of the desks that decided by id alone: a report, a
 * message flag, a disputed no-show. Each answer is the people the item is
 * about; the desk refuses when the operator is one of them. The database
 * holds the same rule where it can see the caller (pending migration
 * 20261021104441 and 20261021104453, nobody_decides_their_own_case).
 *
 * A read that fails answers null, and the desk stops on null: an unproven
 * subject is not proof the operator is a stranger to it.
 */

type Loose = SupabaseClient;
type Row = Record<string, unknown> | null;

const asId = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

async function one(client: Loose, table: string, columns: string, id: string): Promise<Row | undefined> {
  const { data, error } = await client.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) return undefined;
  return (data as Row) ?? null;
}

async function agentUsers(client: Loose, agentIds: (string | null)[]): Promise<string[] | null> {
  const ids = agentIds.filter((a): a is string => !!a);
  if (ids.length === 0) return [];
  const { data, error } = await client.from("agents").select("user_id").in("id", ids);
  if (error) return null;
  return ((data ?? []) as { user_id: unknown }[]).map((r) => asId(r.user_id)).filter((u): u is string => !!u);
}

async function businessOwner(client: Loose, businessId: string | null): Promise<string[] | null> {
  if (!businessId) return [];
  const row = await one(client, "businesses", "owner_id", businessId);
  if (row === undefined) return null;
  const owner = asId(row?.owner_id);
  return owner ? [owner] : [];
}

/** The people a conversation is between. */
async function conversationParties(client: Loose, conversationId: string | null): Promise<string[] | null> {
  if (!conversationId) return [];
  const row = await one(client, "conversations", "guest_id, agent_id", conversationId);
  if (row === undefined) return null;
  return [asId(row?.guest_id), asId(row?.agent_id)].filter((u): u is string => !!u);
}

/** The people one message is about: its sender and both sides of its thread. */
export async function messageSubjects(client: Loose, messageId: string): Promise<string[] | null> {
  const row = await one(client, "messages", "sender_id, conversation_id", messageId);
  if (row === undefined) return null;
  if (!row) return [];
  const parties = await conversationParties(client, asId(row.conversation_id));
  if (!parties) return null;
  return [asId(row.sender_id), ...parties].filter((u): u is string => !!u);
}

/**
 * The people a report is about, by its `target_type` (lower case, as every
 * writer spells it now; upper-case rows from before B-7a read the same).
 * An unknown kind answers [] so a new kind is never refused by accident; the
 * reporter is added by the caller.
 */
export async function reportSubjects(client: Loose, targetType: string, targetId: string): Promise<string[] | null> {
  const kind = targetType.toLowerCase();
  switch (kind) {
    case "user":
    case "profile":
    case "social_profile":
      return [targetId];
    case "message":
      return messageSubjects(client, targetId);
    case "conversation":
      return conversationParties(client, targetId);
    case "post":
    case "story":
    case "story_comment": {
      const table = kind === "post" ? "posts" : kind === "story" ? "stories" : "story_comments";
      const row = await one(client, table, "author_id", targetId);
      if (row === undefined) return null;
      const author = asId(row?.author_id);
      return author ? [author] : [];
    }
    case "listing": {
      const row = await one(client, "listings", "agent_id, assigned_agent_id", targetId);
      if (row === undefined) return null;
      if (!row) return [];
      return agentUsers(client, [asId(row.agent_id), asId(row.assigned_agent_id)]);
    }
    case "review": {
      const row = await one(client, "reviews", "author_id", targetId);
      if (row === undefined) return null;
      const author = asId(row?.author_id);
      return author ? [author] : [];
    }
    case "business": {
      /* The id is a business or one of its stays (STORE-P2-01). */
      const direct = await businessOwner(client, targetId);
      if (direct === null) return null;
      if (direct.length > 0) return direct;
      const stay = await one(client, "accommodations", "business_id", targetId);
      if (stay === undefined) return null;
      return businessOwner(client, asId(stay?.business_id));
    }
    case "event": {
      const row = await one(client, "events", "host_id", targetId);
      if (row === undefined) return null;
      const host = asId(row?.host_id);
      return host ? [host] : [];
    }
    default:
      return [];
  }
}

/**
 * What the desk does next: go on, refuse the operator's own case, or stop
 * because the subjects could not be read (the desk's own "try again").
 */
export function ownCaseVerdict(operatorId: string, subjects: readonly string[] | null): "clear" | "own" | "unknown" {
  if (subjects === null) return "unknown";
  return subjects.includes(operatorId) ? "own" : "clear";
}

export const OWN_CASE_REFUSAL =
  "You are part of this, so somebody else has to decide it. Leave it for another reviewer. Nothing was changed.";
