"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";

import { NOTICE_TOPICS, type NoticeTopic } from "./model";

const schema = z.object({
  topic: z.enum(NOTICE_TOPICS, { message: "That reminder could not be found." }),
  enabled: z.boolean({ message: "Choose on or off." }),
});

const REMINDER_SAVE_FAILED = "That change did not save. Try again.";

/**
 * Switch one reminder on or off for the signed-in person. Own row only: the
 * table's policies hold the user id to the caller, and so does this insert.
 */
export async function setReminderPreference(
  input: { topic: NoticeTopic; enabled: boolean },
): Promise<ActionResult<{ topic: NoticeTopic; enabled: boolean }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const db = session.supabase as unknown as SupabaseClient;
  try {
    const { error } = await db.from("notice_preferences").upsert(
      {
        user_id: session.user.id,
        topic: parsed.data.topic,
        enabled: parsed.data.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic" },
    );
    if (error) return fail(REMINDER_SAVE_FAILED);
  } catch {
    return fail(REMINDER_SAVE_FAILED);
  }

  revalidatePath("/settings/notifications/reminders");
  return ok({ topic: parsed.data.topic, enabled: parsed.data.enabled });
}
