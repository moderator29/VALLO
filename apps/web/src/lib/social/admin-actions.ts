"use server";

/*
 * **Deliberately not behind the `social` flag.**
 *
 * Every other social action refuses while Around is paused. These do not, and
 * that is the point: the most likely reason the switch was ever thrown is that
 * something needs moderating, and a kill switch that also disables the people
 * who can fix the thing it was thrown for is a kill switch nobody dares use.
 * Approving a place, hiding a post and deciding a moderator application all
 * keep working, and they are admin-gated in the database regardless.
 */

/**
 * The console's hands on Around.
 *
 * Two owner rulings live here and nowhere else, so this is the only file that
 * can grant either of them:
 *
 *   A place proposed by a person becomes public only when an admin says so.
 *   A member becomes a moderator only when an admin says so.
 *
 * Neither can happen from a member-facing screen. The `areas` insert policy
 * pins a new row to PROPOSED, and the `area_members` insert policy pins a new
 * row to MEMBER, so the promotion in both cases has to come through an admin
 * policy. That is deliberate: a role that a screen could grant is a role that a
 * bug could grant.
 *
 * Same two-client split the rest of the console already uses. The record being
 * decided is written through the admin's own RLS-bound client so Postgres
 * re-checks the role on every mutation. The service role does only the three
 * things no user-bound client may do: append to the append-only audit log,
 * write a notification into somebody else's row, and set a role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { writeAudit } from "../admin/audit";
import { adminRefusal, requireAdmin } from "../admin/guard";
import { createAdminClient } from "../supabase/admin";
import { writeInAppNotice } from "../notify/in-app";

/**
 * Both Around surfaces.
 *
 * `/around` is the feed, stitched from the places somebody is in, and
 * `/around/settings` is the directory that prints those same places with a Joined
 * control beside them. Anything that changes a membership or a place's status
 * changes both, and revalidating only `/around` was the whole answer for
 * exactly as long as `/around` WAS the directory.
 */
function revalidateAround(): void {
  revalidatePath("/around");
  revalidatePath("/around/settings");
}


const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was changed. Please try again.";
const GONE = "That record is no longer there. Refresh the queue to see the current state.";

const decideAreaSchema = z.object({
  areaId: z.string().uuid(),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(400).optional().or(z.literal("")),
});

const decideModeratorSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["APPROVE", "DECLINE"]),
  note: z.string().trim().max(400).optional().or(z.literal("")),
});

const pauseAreaSchema = z.object({
  areaId: z.string().uuid(),
  paused: z.boolean(),
  note: z.string().trim().max(400).optional().or(z.literal("")),
});

/**
 * Open a place, or decline it.
 *
 * Approving stamps `opened_at`, which the `areas_opened_chk` constraint
 * requires for ACTIVE, so a place cannot go live without a recorded moment it
 * did. Declining keeps the row rather than deleting it, so the proposer gets a
 * real answer and we do not lose the fact that somebody asked for that place:
 * three separate people asking for Gwagwalada is a signal worth keeping.
 */
export async function decideArea(input: {
  areaId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(decideAreaSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { areaId, decision, note } = parsed.data;

  const { data: area, error: readError } = await access.supabase
    .from("areas")
    .select("id, slug, name, city, status, created_by")
    .eq("id", areaId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!area) return fail(GONE);
  if (area.status !== "PROPOSED") {
    return fail("That place has already been decided. Refresh the queue.");
  }
  /* Nobody decides their own case: a place you proposed waits for another admin. */
  if (area.created_by === access.user.id) {
    return fail("You proposed this place, so another admin has to decide it. Nothing was changed.");
  }

  const approving = decision === "APPROVE";
  const { error: updateError } = await access.supabase
    .from("areas")
    .update({
      status: approving ? "ACTIVE" : "REJECTED",
      opened_at: approving ? new Date().toISOString() : null,
      decided_at: new Date().toISOString(),
      decided_by: access.user.id,
      decision_note: note && note.length > 0 ? note : null,
    })
    .eq("id", area.id)
    .eq("status", "PROPOSED");
  if (updateError) return fail(SERVICE_DOWN);

  try {
    const admin = createAdminClient();

    // Tell the person who asked. They took the trouble to suggest a place; a
    // decision they have to go looking for is not a decision they received.
    if (area.created_by) {
      await writeInAppNotice(admin, {
        user_id: area.created_by,
        kind: "system",
        title: approving
          ? `${area.name} is open on Around`
          : `We could not open ${area.name}`,
        body: approving
          ? "The place you suggested is live. You are the first one in."
          : note && note.length > 0
            ? note
            : "Thank you for suggesting it. You can suggest another at any time.",
        /* A declined suggestion is printed under "We came back to you" on the
           directory, so that is where the notification has to land. `/around`
           is the feed now and would open on a screen the decision is not on. */
        href: approving ? `/around/${area.slug}` : "/around/settings",
      });
    }

    // The proposer joins their own place automatically on approval. Asking
    // somebody to join the room they asked us to build would be absurd.
    if (approving && area.created_by) {
      await admin
        .from("area_members")
        .insert({ area_id: area.id, user_id: area.created_by, role: "MEMBER" });
    }

    await writeAudit(admin, {
      actorId: access.user.id,
      action: approving ? "area.approve" : "area.reject",
      entityType: "area",
      entityId: area.id,
      detail: {
        before_status: area.status,
        after_status: approving ? "ACTIVE" : "REJECTED",
        slug: area.slug,
        city: area.city,
        proposed_by: area.created_by,
        note: note && note.length > 0 ? note : null,
      },
    });
  } catch {
    // The decision itself has committed. A missing log line or notification is
    // a gap; a rolled-back approval would be a lie.
  }

  revalidatePath("/admin/social");
  revalidateAround();
  return ok(null);
}

/**
 * Approve or decline somebody who asked to look after a place.
 *
 * Approving sets `area_members.role = 'MODERATOR'`, which the residency check
 * constraint requires a source and a timestamp for, so the grant is recorded
 * as ADMIN rather than pretending the person earned residency some other way.
 *
 * What this does NOT grant, and the notification says so out loud: the ability
 * to delete a post. A moderator can hide one while a person reviews it. Removal
 * stays with the platform and is always audited.
 */
export async function decideModeratorApplication(input: {
  applicationId: string;
  decision: "APPROVE" | "DECLINE";
  note?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(decideModeratorSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { applicationId, decision, note } = parsed.data;

  const { data: application, error: readError } = await access.supabase
    .from("area_moderator_applications")
    .select("id, area_id, user_id, status, areas(name, slug)")
    .eq("id", applicationId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!application) return fail(GONE);
  if (application.status !== "PENDING") {
    return fail("That application has already been decided. Refresh the queue.");
  }
  /* Nobody makes themselves a moderator. */
  if (application.user_id === access.user.id) {
    return fail("This is your own application, so another admin has to decide it. Nothing was changed.");
  }

  const approving = decision === "APPROVE";
  const area = application.areas as unknown as { name: string; slug: string } | null;

  const { error: updateError } = await access.supabase
    .from("area_moderator_applications")
    .update({
      status: approving ? "APPROVED" : "DECLINED",
      decided_at: new Date().toISOString(),
      decided_by: access.user.id,
      decision_note: note && note.length > 0 ? note : null,
    })
    .eq("id", application.id)
    .eq("status", "PENDING");
  if (updateError) return fail(SERVICE_DOWN);

  if (approving) {
    // The role write goes through the admin's own client too: area_members has
    // an admin-write policy, so Postgres re-checks the role rather than taking
    // this action's word for it.
    const { error: roleError } = await access.supabase
      .from("area_members")
      .upsert(
        {
          area_id: application.area_id,
          user_id: application.user_id,
          role: "MODERATOR",
          residency_source: "ADMIN",
          residency_verified_at: new Date().toISOString(),
        },
        { onConflict: "area_id,user_id" },
      );
    if (roleError) {
      // The application says approved and the role did not land. Say so rather
      // than reporting a success the person will not experience.
      return fail(
        "The application was approved but the role did not save. Try approving again.",
      );
    }
  }

  try {
    const admin = createAdminClient();
    await writeInAppNotice(admin, {
      user_id: application.user_id,
      kind: "system",
      title: approving
        ? `You look after ${area?.name ?? "a place"} now`
        : `About ${area?.name ?? "that place"}`,
      body: approving
        ? "You can hide a post while somebody reviews it. You cannot delete anybody's post, and nobody expects you to be available at 2am."
        : note && note.length > 0
          ? note
          : "Thank you for offering. We are not adding anyone to this place right now.",
      href: area?.slug ? `/around/${area.slug}` : "/around",
    });

    await writeAudit(admin, {
      actorId: access.user.id,
      action: approving ? "area_moderator.approve" : "area_moderator.decline",
      entityType: "area_moderator_application",
      entityId: application.id,
      detail: {
        before_status: application.status,
        after_status: approving ? "APPROVED" : "DECLINED",
        area_id: application.area_id,
        subject_id: application.user_id,
        note: note && note.length > 0 ? note : null,
      },
    });
  } catch {
    // Same reasoning as decideArea.
  }

  revalidatePath("/admin/social");
  revalidateAround();
  return ok(null);
}

/**
 * Pause a place, or bring it back. Pausing never deletes anything and the
 * member-facing copy says so, because a place that vanishes reads as a place
 * that was censored.
 */
export async function setAreaPaused(input: {
  areaId: string;
  paused: boolean;
  note?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(pauseAreaSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { areaId, paused, note } = parsed.data;

  const { data: area, error: readError } = await access.supabase
    .from("areas")
    .select("id, slug, status")
    .eq("id", areaId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!area) return fail(GONE);
  if (!["ACTIVE", "PAUSED"].includes(area.status)) {
    return fail("Only an open place can be paused.");
  }

  const { error: updateError } = await access.supabase
    .from("areas")
    .update({
      status: paused ? "PAUSED" : "ACTIVE",
      decision_note: note && note.length > 0 ? note : null,
      decided_at: new Date().toISOString(),
      decided_by: access.user.id,
    })
    .eq("id", area.id);
  if (updateError) return fail(SERVICE_DOWN);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: paused ? "area.pause" : "area.resume",
      entityType: "area",
      entityId: area.id,
      detail: {
        before_status: area.status,
        after_status: paused ? "PAUSED" : "ACTIVE",
        slug: area.slug,
        note: note && note.length > 0 ? note : null,
      },
    });
  } catch {
    // Best effort, as above.
  }

  revalidatePath("/admin/social");
  revalidatePath(`/around/${area.slug}`);
  return ok(null);
}
