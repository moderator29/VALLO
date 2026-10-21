"use server";

/**
 * Claiming a handle, and editing the profile behind it.
 *
 * The write goes through the person's OWN row level security bound client.
 * `social_profiles_insert_self` and `social_profiles_update_self` decide that
 * the row is theirs, and neither rule is restated here, because a rule enforced
 * in two places drifts in one of them.
 *
 * Three things the database does that this file deliberately does not:
 *
 *   The handle trigger normalises, checks the charset, refuses a reserved word
 *   or anything resembling an official Vallo name, and refuses a handle
 *   released inside the last 90 days. It raises RM001, RM002 and RM003, each
 *   with a sentence already written for a person to read, so this file maps the
 *   code to the field and passes the sentence straight through rather than
 *   inventing a second copy of the rule.
 *
 *   The scanner holds a bio or link carrying a ten digit run or payment
 *   language, setting bio_status to HELD before the row is ever visible. This
 *   file reads the resulting status back and hands it to the surface so the
 *   author is told honestly. It never sets that column itself.
 *
 *   The counters are maintained by triggers. Nothing here touches
 *   follower_count, following_count or post_count.
 */

import { pathInOwnFolder } from "@/lib/security/own-folder";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  resolveSession,
  SIGNED_OUT_MESSAGE,
} from "../actions/session";
import { consume, subjectForUser } from "../security/rate-limit";
import {
  socialProfileInputSchema,
  type BioStatus,
  type SocialProfileSaved,
} from "./profiles-schema";
import { SOCIAL_OFF_MESSAGE, isSocialEnabled } from "./flag";

/* ------------------------------------------------------------------ limits */

/**
 * A handle may be changed once every 30 days.
 *
 * A well known handle should not be able to churn: the database locks a
 * released handle for 90 days precisely so it cannot be sniped, and a person
 * who could rename themselves daily would be a moving target for anyone trying
 * to report them. The first claim is not metered because there is nothing to
 * churn yet; every change after it is.
 */
const HANDLE_CLAIM_LIMIT = 1;
const HANDLE_CLAIM_WINDOW_SECONDS = 30 * 24 * 60 * 60;

/** Ordinary edits, generous but not unbounded. */
const PROFILE_UPDATE_LIMIT = 20;
const PROFILE_UPDATE_WINDOW_SECONDS = 24 * 60 * 60;

const SERVICE_DOWN_MESSAGE =
  "We could not save your profile just then. Nothing you typed was lost, please try again in a moment.";

/* ------------------------------------------------------------- the action */

export async function saveSocialProfile(
  _prev: ActionResult<SocialProfileSaved> | null,
  formData: FormData,
): Promise<ActionResult<SocialProfileSaved>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(socialProfileInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const input = parsed.data;
  const { supabase, user } = session;

  const { data: existing, error: readError } = await supabase
    .from("social_profiles")
    .select("handle")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN_MESSAGE);

  const isClaim = existing === null;
  const handleChanged = existing !== null && existing.handle !== input.handle;

  /* The taken case is pre-flighted rather than left to the unique index. It is
     by far the most common reason a claim fails, and catching it here means a
     refusal does not spend the 30 day change allowance below. */
  if (isClaim || handleChanged) {
    const { data: holder } = await supabase
      .from("social_profiles")
      .select("user_id")
      .eq("handle", input.handle)
      .maybeSingle();
    if (holder && holder.user_id !== user.id) {
      return fail("That handle is taken.", {
        handle: "Somebody already holds that handle. Please choose another one.",
      });
    }
  }

  /* Ordinary edits are metered per day for everyone, claim or not. */
  const editVerdict = await consume({
    bucket: "social_profile_update",
    subject: subjectForUser(user.id),
    limit: PROFILE_UPDATE_LIMIT,
    windowSeconds: PROFILE_UPDATE_WINDOW_SECONDS,
  });
  if (!editVerdict.allowed) {
    return fail(
      `You have edited your profile ${PROFILE_UPDATE_LIMIT} times today. You can edit it again ${editVerdict.retryIn}.`,
    );
  }

  /* A change is checked before the write, because the person still holds their
     current handle and a refusal costs them nothing. A first claim cannot be a
     repeat by definition, so it is recorded after the write instead, where a
     database refusal cannot spend an allowance the person never used. */
  if (handleChanged) {
    const verdict = await consume({
      bucket: "social_handle_claim",
      subject: subjectForUser(user.id),
      limit: HANDLE_CLAIM_LIMIT,
      windowSeconds: HANDLE_CLAIM_WINDOW_SECONDS,
    });
    if (!verdict.allowed) {
      return fail("Your handle was changed recently.", {
        handle: `A handle can be changed once every 30 days. You can change it again ${verdict.retryIn}.`,
      });
    }
  }

  const row = {
    handle: input.handle,
    bio: input.bio.length > 0 ? input.bio : null,
    pronouns: input.pronouns.length > 0 ? input.pronouns : null,
    link: input.link.length > 0 ? input.link : null,
    contact_policy: input.contactPolicy,
    pidgin_ok: input.pidginOk,
    home_area_id: input.homeAreaId,
  };

  const written = isClaim
    ? await supabase
        .from("social_profiles")
        .insert({ user_id: user.id, ...row })
        .select("handle, bio_status")
        .single()
    : await supabase
        .from("social_profiles")
        .update(row)
        .eq("user_id", user.id)
        .select("handle, bio_status")
        .single();

  if (written.error || !written.data) {
    return fail(...describeWriteFailure(written.error));
  }

  if (isClaim) {
    /* Recorded, never consulted here: the next change is what this allowance
       is for. Awaited rather than left floating, because a promise a server
       action does not wait for may never run. The limiter fails open, so an
       outage can never stop a person taking their own name. */
    await consume({
      bucket: "social_handle_claim",
      subject: subjectForUser(user.id),
      limit: HANDLE_CLAIM_LIMIT,
      windowSeconds: HANDLE_CLAIM_WINDOW_SECONDS,
    });
  }

  const handle = written.data.handle;
  const bioStatus = (written.data.bio_status as BioStatus) ?? "LIVE";

  revalidatePath(`/u/${handle}`);
  revalidatePath(`/u/${handle}/edit`);
  if (existing && existing.handle !== handle) revalidatePath(`/u/${existing.handle}`);

  return ok({ handle, bioStatus, claimed: isClaim });
}

/* ---------------------------------------------------------------- the cover */

/**
 * Point a profile at a cover object, or take the cover away.
 *
 * The upload itself happens in the browser, straight into the public
 * `social-covers` bucket, where storage policy already restricts a write to the
 * caller's own `<uid>/` folder. What this action does is the part storage
 * cannot: it decides that the path a client is asking us to REMEMBER is one
 * that client is entitled to.
 *
 * That check matters more than it looks. `cover_path` is plain text rendered
 * into a public URL, so without it a crafted call could point somebody's cover
 * at any object in the bucket, including another person's. The first path
 * segment must be the caller's own user id, so it cannot.
 */
const coverPathSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i,
    "That photo could not be filed. Please try again.",
  );

export async function setSocialCover(input: {
  storagePath: string | null;
}): Promise<ActionResult<{ coverPath: string | null }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { supabase, user } = session;

  let coverPath: string | null = null;
  if (input.storagePath !== null) {
    const parsed = coverPathSchema.safeParse(input.storagePath);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That photo could not be filed.");
    }
    if (!pathInOwnFolder(user.id, parsed.data)) {
      return fail("That photo does not belong to this account. Choose one you uploaded yourself.");
    }
    coverPath = parsed.data;
  }

  const verdict = await consume({
    bucket: "social_profile_update",
    subject: subjectForUser(user.id),
    limit: PROFILE_UPDATE_LIMIT,
    windowSeconds: PROFILE_UPDATE_WINDOW_SECONDS,
  });
  if (!verdict.allowed) {
    return fail(
      `You have changed your profile ${PROFILE_UPDATE_LIMIT} times today. You can change it again ${verdict.retryIn}.`,
    );
  }

  const { data, error } = await supabase
    .from("social_profiles")
    .update({ cover_path: coverPath })
    .eq("user_id", user.id)
    .select("handle, cover_path")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return fail("Claim your handle first, then a cover has somewhere to live.");
    }
    return fail(SERVICE_DOWN_MESSAGE);
  }

  revalidatePath(`/u/${data.handle}`);
  revalidatePath(`/u/${data.handle}/edit`);

  return ok({ coverPath: data.cover_path });
}

/**
 * Turn a write failure into the one true sentence for it.
 *
 * The handle trigger's messages are already written for a person, so they are
 * passed through untouched and attached to the field that caused them. Anything
 * unrecognised degrades to a sentence that says what happened and what to do
 * next, never a raw code.
 */
function describeWriteFailure(
  error: { code?: string; message?: string } | null,
): [string, Record<string, string>?] {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  // RM004 is the content scanner (SEC-05) refusing a handle on the
  // objectionable-content list; its message is written for a person too.
  if (code === "RM001" || code === "RM002" || code === "RM003" || code === "RM004") {
    return ["That handle will not work.", { handle: message }];
  }
  if (code === "23505") {
    return [
      "That handle is taken.",
      { handle: "Somebody already holds that handle. Please choose another one." },
    ];
  }
  if (code === "23514") {
    /* A check constraint the form should have caught first. Name the field when
       the constraint says which one it is, so the person is not left hunting. */
    if (message.includes("bio")) return ["Please check your bio.", { bio: "That bio is too long." }];
    if (message.includes("pronouns")) {
      return ["Please check your pronouns.", { pronouns: "That is too long." }];
    }
    if (message.includes("link")) return ["Please check your link.", { link: "That link is too long." }];
    if (message.includes("handle")) {
      return ["That handle will not work.", { handle: "Letters, numbers and underscores only." }];
    }
    return ["Please check the highlighted fields and try again."];
  }
  if (code === "23503" || code === "22P02") {
    /* The home area foreign key, or a value that is not a uuid at all. Both
       mean the same thing to a person: that place is not one we know. */
    return [
      "Please choose a place that is open.",
      { homeAreaId: "That place is not open. Pick one from the list." },
    ];
  }
  if (code === "42501") {
    return ["This profile cannot be saved from this account."];
  }
  return [SERVICE_DOWN_MESSAGE];
}
