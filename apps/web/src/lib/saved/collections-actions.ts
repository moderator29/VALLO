"use server";

/**
 * Saved collections: create a list, delete a list, put a saved thing in or take
 * it out. Every write runs under the member's own RLS-bound client, so the
 * database decides whose list it is (`saved_collections_owner_all`). Nothing
 * but async functions is exported from here; the pure half is `./collections`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { SAVED_PLACE_KINDS } from "./db";
import { cleanCollectionName, COLLECTION_LIMIT } from "./collections";

type Loose = {
  from(table: string): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: unknown; error: { code?: string } | null }> } } & PromiseLike<{ error: { code?: string } | null }>;
    delete(): { eq(col: string, v: string): { eq(col: string, v: string): { eq(col: string, v: string): PromiseLike<{ error: unknown }> } & PromiseLike<{ error: unknown }> } & PromiseLike<{ error: unknown }> };
  };
};

const DOWN = "We could not update your lists just now. Please try again in a moment.";

async function member() {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, error: NOT_CONFIGURED_MESSAGE } as const;
  if (session.state === "signed-out") return { ok: false, error: SIGNED_OUT_MESSAGE } as const;
  return { ok: true, db: session.supabase as unknown as Loose, userId: session.user.id } as const;
}

export async function createCollection(input: { name: string }): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = validate(z.object({ name: z.string().max(200) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const name = cleanCollectionName(parsed.data.name);
  if (!name) return fail("Give the list a name.");
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { data, error } = await who.db.from("saved_collections").insert({ user_id: who.userId, name }).select("id, name").single();
  if (error || !data) {
    if (error?.code === "23505") return fail("You already have a list with that name.");
    if (error?.code === "P0001") return fail(`You can keep up to ${COLLECTION_LIMIT} lists. Delete one to make a new one.`);
    return fail(DOWN);
  }
  revalidatePath("/saved");
  return ok(data as { id: string; name: string });
}

export async function deleteCollection(input: { id: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ id: z.uuid() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { error } = await who.db.from("saved_collections").delete().eq("id", parsed.data.id).eq("user_id", who.userId);
  if (error) return fail(DOWN);
  revalidatePath("/saved");
  return ok(null);
}

export async function setInCollection(input: {
  collectionId: string;
  kind: string;
  id: string;
  on: boolean;
}): Promise<ActionResult<null>> {
  const parsed = validate(
    z.object({ collectionId: z.uuid(), kind: z.enum(SAVED_PLACE_KINDS), id: z.uuid(), on: z.boolean() }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { collectionId, kind, id, on } = parsed.data;
  if (on) {
    const { error } = await who.db
      .from("saved_collection_items")
      .insert({ collection_id: collectionId, kind, target_id: id });
    // 23505: already in the list (another tab). The intent is satisfied.
    if (error && error.code !== "23505") return fail(DOWN);
  } else {
    const { error } = await who.db
      .from("saved_collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("kind", kind)
      .eq("target_id", id);
    if (error) return fail(DOWN);
  }
  revalidatePath("/saved");
  return ok(null);
}
