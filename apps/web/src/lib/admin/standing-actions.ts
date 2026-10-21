"use server";

/**
 * Granting standing by hand, and taking it back.
 *
 * top_contributor is the one badge on this platform a person awards rather
 * than a trigger. `badges.manual_only` says so and, since the people, places
 * and standing migration, the database enforces it: a manual badge whose
 * granted_by is null is refused with RM021, so a grant always names the admin
 * who made it and nothing can quietly award one from code.
 *
 * That is also what makes the surface honest. `user_badges.granted_by` being
 * null is the platform's definition of earned, so a badge with a name against
 * it is shown as granted, with the grantor and the reason, rather than being
 * presented as something the holder won.
 *
 * The write goes through the admin's own RLS-bound client (user_badges_admin_write
 * re-checks the role in Postgres), and only the audit row uses the service
 * role, because the audit log takes no client writes by design.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { createAdminClient } from "../supabase/admin";
import { writeAudit } from "./audit";
import { adminRefusal, requireAdmin } from "./guard";

const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was changed. Please try again.";

const SELF_GRANT = "You cannot grant a badge to yourself. Ask another admin.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const grantSchema = z.object({
  /** Who is receiving it. A handle, because nobody knows anybody's uuid. */
  handle: z
    .string()
    .trim()
    .min(2, "Enter the member's handle, without the @.")
    .max(40)
    .transform((value) => value.replace(/^@/, "").toLowerCase()),
  badgeCode: z.string().trim().min(1, "Choose which badge to grant."),
  reason: z
    .string()
    .trim()
    .min(10, "Say why, in a sentence. This is the record of the decision.")
    .max(500, "Keep the reason under 500 characters."),
});

const revokeSchema = z.object({
  userId: z.string().refine((v) => UUID_RE.test(v), "That member could not be identified."),
  badgeCode: z.string().trim().min(1),
});

export type GrantReceipt = { handle: string; badgeCode: string };

export async function grantStandingBadge(
  _prev: ActionResult<GrantReceipt> | null,
  formData: FormData,
): Promise<ActionResult<GrantReceipt>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(grantSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { handle, badgeCode, reason } = parsed.data;

  try {
    // The badge must be one that is granted by hand. Anything else is earned,
    // and awarding it here would make the earned ones meaningless.
    const { data: badge } = await access.supabase
      .from("badges")
      .select("code, manual_only, name")
      .eq("code", badgeCode)
      .maybeSingle();
    if (!badge)
      return fail("That badge does not exist.", {
        badgeCode: "No badge carries that code. Reload the console to see the ones that do.",
      });
    if (!badge.manual_only) {
      return fail(
        `${badge.name} is earned, not granted. Awarding it by hand would make every earned one worth less.`,
        { badgeCode: "This badge is earned automatically." },
      );
    }

    const { data: identity } = await access.supabase
      .from("social_profiles")
      .select("user_id, handle")
      .eq("handle", handle)
      .maybeSingle();
    if (!identity) {
      return fail("No member has that handle. Check the spelling and try again.", {
        handle: "We could not find that handle.",
      });
    }
    /* Nobody awards themselves. A granted badge says another person vouched. */
    if (identity.user_id === access.user.id) {
      return fail(SELF_GRANT, { handle: SELF_GRANT });
    }

    const { error } = await access.supabase.from("user_badges").upsert(
      {
        user_id: identity.user_id,
        badge_code: badgeCode,
        granted_by: access.user.id,
        reason,
        revoked_at: null,
        revoked_by: null,
      },
      { onConflict: "user_id,badge_code" },
    );

    if (error) {
      // RM021 is the database refusing a manual badge with nobody's name on
      // it. If it ever surfaces here it means granted_by did not reach the
      // insert, which is our bug and not the operator's.
      if (error.code === "RM021") {
        return fail(
          "That badge has to name the person granting it, and this grant did not carry your account. Nothing was awarded. Please tell engineering.",
        );
      }
      return fail(SERVICE_DOWN);
    }

    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "badge.grant",
      entityType: "user_badge",
      entityId: `${identity.user_id}:${badgeCode}`,
      detail: { handle, badgeCode, reason },
    });

    revalidatePath("/admin/standing");
    return ok({ handle, badgeCode });
  } catch {
    return fail(SERVICE_DOWN);
  }
}

/**
 * Take a granted badge back.
 *
 * Revoking rather than deleting, because the record of the decision and of its
 * reversal is the point: user_badges_select hides a revoked badge from
 * everybody except its holder and the console.
 */
export async function revokeStandingBadge(
  _prev: ActionResult<{ userId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(revokeSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { userId, badgeCode } = parsed.data;

  try {
    const { error } = await access.supabase
      .from("user_badges")
      .update({ revoked_at: new Date().toISOString(), revoked_by: access.user.id })
      .eq("user_id", userId)
      .eq("badge_code", badgeCode);
    if (error) return fail(SERVICE_DOWN);

    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "badge.revoke",
      entityType: "user_badge",
      entityId: `${userId}:${badgeCode}`,
      detail: { badgeCode },
    });

    revalidatePath("/admin/standing");
    return ok({ userId });
  } catch {
    return fail(SERVICE_DOWN);
  }
}
