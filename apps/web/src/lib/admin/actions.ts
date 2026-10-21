"use server";

/**
 * Every hand the admin console has.
 *
 * Two clients, on purpose. The record being decided is written through the
 * admin's own RLS-bound client, so Postgres itself re-checks the role on every
 * mutation and a stolen action call gets nowhere. The service-role client is
 * used only for the three things no user-bound client may do: append to the
 * append-only audit log, write a notification into someone else's row, and
 * grant a role. That split means an admin's power is exactly the power their
 * policies give them, plus the narrow, named extras above.
 *
 * Every mutation writes an audit row carrying the actor, the target and the
 * before and after status. Notifications are inserted directly where no
 * database trigger already covers the event; the support reply is the
 * exception, because notify_support_reply fires on insert and telling the owner
 * twice would be worse than not telling them at all.
 */

import { composeReviewNote, isReviewReasonCode } from "./review-reasons";
import { revalidatePath } from "next/cache";
import { eddGateMessage, isEddGateRefusal } from "../compliance/gate";
import { ARRIVAL_DECLARATION_NEEDED, arrivalChargesDeclared } from "../stays/arrival-gate";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { createAdminClient } from "../supabase/admin";
import { OWN_CASE_REFUSAL, messageSubjects, ownCaseVerdict, reportSubjects } from "./self-review";
import { writeAudit, type AuditDetail } from "./audit";
import { adminRefusal, requireAdmin } from "./guard";
import { announce } from "../notify/junction";
import {
  agentApplicationApproved,
  agentApplicationNeedsMore,
  agentApplicationRejected,
  listingApproved,
  listingChangesRequested,
  listingPassedReview,
  listingRejected,
} from "../email/messages";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
/* ONE VOCABULARY, READ HERE TOO. The three doors narrow onto the two person
   values in exactly one place and this is a caller of it, not a second copy. */
import { personRoleFrom } from "../supply/roles";
import { sideOf } from "../agent/role-lock";
import { CLOSED_LISTING_MESSAGE, isClosedListingRefusal } from "../landlord/closed";
import { isRateAgreementRefusal } from "../pricing/rate-agreement";
import { withDone } from "../ui/success-moments";
import { MANDATE_NEEDED_MESSAGE, isMandateRefusal } from "../compliance/beneficial-ownership";
import {
  acknowledgeRiskAlertSchema,
  replySupportTicketSchema,
  resolveReportSchema,
  resolveRiskAlertSchema,
  reviewAgentApplicationSchema,
  reviewListingSchema,
  reviewMessageFlagSchema,
  setTicketStatusSchema,
  toggleFeatureFlagSchema,
} from "./schema";

const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was changed. Please try again.";

const GONE = "That record is no longer there. Refresh the queue to see the current state.";
/**
 * The database refuses a decision on an item somebody else has claimed
 * (`private.decision_respects_claim`); its sentence is the one to show.
 */
function claimRefusal(error: { code?: string; message?: string } | null): string | null {
  return error?.code === "42501" && (error.message ?? "").includes("claimed") ? error.message! : null;
}

/** Two reviewers on one item: the other decision landed first. */
const DECIDED_ELSEWHERE = "Somebody else decided this a moment ago. Refresh the queue to see the current state.";

/** ------------------------------------------------------------ message flags */

export async function reviewMessageFlag(input: {
  flagId: string;
  resolution: "cleared" | "escalated";
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("moderation");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(reviewMessageFlagSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { flagId, resolution } = parsed.data;

  const { data: flag, error: readError } = await access.supabase
    .from("message_flags")
    .select("id, status, reason, message_id")
    .eq("id", flagId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!flag) return fail(GONE);
  if (flag.status === "reviewed") {
    return fail("This flag has already been reviewed. Refresh the queue to see the current state.");
  }
  /* Nobody clears a flag on their own words or their own thread. */
  const flagCase = ownCaseVerdict(access.user.id, await messageSubjects(access.supabase, flag.message_id));
  if (flagCase === "unknown") return fail(SERVICE_DOWN);
  if (flagCase === "own") return fail(OWN_CASE_REFUSAL);

  const { error: updateError } = await access.supabase
    .from("message_flags")
    .update({ status: "reviewed", reviewed_by: access.user.id })
    .eq("id", flag.id)
    .eq("status", "open");
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);

  try {
    const admin = createAdminClient();

    // Escalating is a real second step, not a label: it opens a risk alert so
    // the conversation stays on an operations surface after the flag closes.
    if (resolution === "escalated") {
      await admin.from("risk_alerts").insert({
        severity: "high",
        status: "open",
        title:
          flag.reason === "account_number"
            ? "Account number shared in a conversation"
            : "Payment talk in a conversation",
        description:
          "Escalated from the message flag queue. Review the conversation and the parties involved.",
        entity_type: "message",
        entity_id: flag.message_id,
      });
    }

    await writeAudit(admin, {
      actorId: access.user.id,
      action: "message_flag.review",
      entityType: "message_flag",
      entityId: flag.id,
      detail: {
        before_status: flag.status,
        after_status: "reviewed",
        reason: flag.reason,
        resolution,
        message_id: flag.message_id,
      },
    });
  } catch {
    // The flag is genuinely reviewed either way.
  }

  revalidatePath("/admin/queue");
  revalidatePath("/admin");
  return ok(null);
}

/** -------------------------------------------------------------- risk alerts */

export async function resolveRiskAlert(input: {
  alertId: string;
  notes?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(resolveRiskAlertSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: alert, error: readError } = await access.supabase
    .from("risk_alerts")
    .select("id, status, severity, title")
    .eq("id", parsed.data.alertId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!alert) return fail(GONE);
  if (alert.status === "resolved") return fail("This alert is already resolved.");

  const { error: updateError } = await access.supabase
    .from("risk_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      // Named, not anonymous. The audit log has always held the actor; putting
      // it on the row itself is what lets the queue answer "who signed this
      // off" without a second lookup nobody performs.
      resolved_by: access.user.id,
    })
    .eq("id", alert.id)
    .eq("status", "open");
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "risk_alert.resolve",
      entityType: "risk_alert",
      entityId: alert.id,
      detail: {
        before_status: alert.status,
        after_status: "resolved",
        severity: alert.severity,
        title: alert.title,
        notes: parsed.data.notes ?? null,
      },
    });
  } catch {
    // Best effort.
  }

  revalidatePath("/admin/alerts");
  revalidatePath("/admin");
  return ok(null);
}

/**
 * C13: "I HAVE THIS". The first person to take an open alert puts their name
 * on it, so two people do not chase the same fault and nobody assumes the
 * other one has it. Behind the same admin check as resolving, written through
 * the admin's own RLS-bound client (the existing admin-only policy), audited.
 * The database stamps the time and refuses a name that is not the caller's.
 *
 * The columns arrived with 20260930122539_c13_alert_acknowledged_by_and_skipped_runs.sql;
 * should they ever be missing the answer says so plainly rather than failing
 * silently.
 */
export async function acknowledgeRiskAlert(input: { alertId: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(acknowledgeRiskAlertSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: alert, error: readError } = await access.supabase
    .from("risk_alerts")
    .select("id, status, severity, title")
    .eq("id", parsed.data.alertId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!alert) return fail(GONE);
  if (alert.status !== "open") return fail("This alert is already resolved.");

  /* `is null` makes the first taker win: a second click, or a second person,
     changes nothing and is told somebody has it. The database guard holds
     the same rule for any other writer. */
  const { data: taken, error: updateError } = await access.supabase
    .from("risk_alerts")
    .update({ acknowledged_by: access.user.id, acknowledged_at: new Date().toISOString() })
    .eq("id", alert.id)
    .eq("status", "open")
    .is("acknowledged_by", null)
    .select("id");
  if (updateError) {
    if (updateError.code === "42703" || updateError.code === "PGRST204") {
      return fail("Acknowledging is not switched on yet. Nothing was changed.");
    }
    return fail(claimRefusal(updateError) ?? SERVICE_DOWN);
  }
  if (!Array.isArray(taken) || taken.length === 0) {
    return fail("Somebody has already taken this alert. Refresh the queue to see who.");
  }

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "risk_alert.acknowledge",
      entityType: "risk_alert",
      entityId: alert.id,
      detail: { status: alert.status, severity: alert.severity, title: alert.title },
    });
  } catch {
    // Best effort; the name is on the row either way.
  }

  revalidatePath("/admin/alerts");
  revalidatePath("/admin");
  return ok(null);
}

/** ------------------------------------------------------------------ reports */

export async function resolveReport(input: {
  reportId: string;
  decision: "reviewing" | "resolved" | "dismissed";
  notes?: string;
  /** V-89: a line the reporter sees; staff notes never reach them. */
  reporterNote?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("moderation");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(resolveReportSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { reportId, decision } = parsed.data;
  /* Dismissing a report is a decision that nothing was wrong; it always
     carries the reason, for the audit trail and the next reviewer. */
  if (decision === "dismissed" && (parsed.data.notes ?? "").trim().length < 8) {
    return fail("Say why this report is dismissed, in at least eight characters.", {
      notes: "Write the reason for dismissing it.",
    });
  }

  const { data: report, error: readError } = await access.supabase
    .from("reports")
    .select("id, status, target_type, target_id, reason, reporter_id")
    .eq("id", reportId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!report) return fail(GONE);
  if (report.status === decision) return fail("This report already sits in that state.");
  if (report.status === "resolved" || report.status === "dismissed" || (report.status as string) === "withdrawn") {
    return fail("This report has already been closed. Refresh the queue to see the current state.");
  }
  /* Nobody decides a report they filed or one about them or their own words. */
  const subjects = await reportSubjects(access.supabase, report.target_type, report.target_id);
  const reportCase = ownCaseVerdict(access.user.id, subjects ? [...subjects, report.reporter_id] : null);
  if (reportCase === "unknown") return fail(SERVICE_DOWN);
  if (reportCase === "own") return fail(OWN_CASE_REFUSAL);

  const closing = decision === "resolved" || decision === "dismissed";
  const { data: movedReport, error: updateError } = await access.supabase
    .from("reports")
    .update({
      status: decision,
      resolved_at: closing ? new Date().toISOString() : null,
      // Picking a report up counts as much as closing it: the name goes on the
      // row either way, so an item sitting in review is visibly somebody's.
      resolved_by: access.user.id,
    })
    .eq("id", report.id)
    .eq("status", report.status)
    .select("id");
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);
  if (!movedReport || movedReport.length === 0) return fail(DECIDED_ELSEWHERE);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "report.review",
      entityType: "report",
      entityId: report.id,
      detail: {
        before_status: report.status,
        after_status: decision,
        target_type: report.target_type,
        target_id: report.target_id,
        notes: parsed.data.notes ?? null,
        /* V-89: read by public.my_reports() and nothing else of this row. */
        reporter_note: parsed.data.reporterNote && parsed.data.reporterNote.length > 0 ? parsed.data.reporterNote : null,
      },
    });
  } catch {
    // Best effort.
  }

  revalidatePath("/admin/queue");
  revalidatePath("/admin");
  return ok(null);
}

/** ------------------------------------------------------- agent applications */

export async function reviewAgentApplication(input: {
  applicationId: string;
  decision: "approve" | "reject" | "request_changes";
  notes?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(reviewAgentApplicationSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { applicationId, decision } = parsed.data;
  /* An empty note is no note. The sheet sends "" when nothing was typed, and
     "" slipped past every `?? fallback` below: a refusal reached the
     applicant as a notification with an empty body and an email whose reason
     was blank. */
  const notes = parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null;

  if (decision === "request_changes" && notes === null) {
    return fail("Tell the applicant what to change.", {
      notes: "Write the change you need before sending it back.",
    });
  }
  /* A refusal always says why, as a listing refusal already does: the
     applicant reads it word for word on their application, and it is the only
     explanation they get. The sheet said so and then let it be left blank. */
  if (decision === "reject" && (notes === null || notes.length < 8)) {
    return fail("Say why this application is not approved, in at least eight characters. The applicant reads it.", {
      notes: "Write the reason for the refusal.",
    });
  }

  const { data: application, error: readError } = await access.supabase
    .from("agent_applications")
    /* `supply_role` IS READ HERE AND IT NEVER WAS. It has been written by the
       three registration forms since `20260922170000` and read by nothing that
       decides anything: two grep hits in the whole tree and both in the file
       that writes it. So an approved OWNER became an "agent" row and the role
       was discarded at the door. See the upsert below. */
    .select("id, user_id, status, reference, full_name, type, supply_role, reviewer_id, reviewed_at, review_notes")
    .eq("id", applicationId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!application) return fail(GONE);

  /* Nobody decides their own application, whatever their access. */
  if (application.user_id === access.user.id) {
    return fail("You cannot decide your own application. Leave it for another reviewer.");
  }

  const decidable = ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"];
  if (!decidable.includes(application.status)) {
    return fail(
      application.status === "DRAFT"
        ? "This application has not been submitted yet, so there is nothing to decide."
        : "This application has already been decided. Refresh the queue to see the current state.",
    );
  }

  /* ONE ACCOUNT, ONE SIDE (`lib/agent/role-lock.ts`). Approval never
     overwrites a live agents row, so approving an agent application on an
     owner's account said "approved" while the role stayed owner. It is
     refused before anything is written, and the reviewer is told why. */
  if (decision === "approve") {
    const { data: existing } = await access.supabase
      .from("agents")
      .select("role")
      .eq("user_id", application.user_id)
      .maybeSingle();
    const held = (existing as { role?: string | null } | null)?.role ?? null;
    if (held !== null && sideOf(held) !== sideOf(application.supply_role)) {
      return fail(
        `This account is already ${sideOf(held) === "owner" ? "an owner's" : "an agent's"} account, and one account holds one side. Refuse this application with that reason; the person can apply from a separate account.`,
      );
    }
  }

  const nextStatus =
    decision === "approve" ? "APPROVED" : decision === "reject" ? "REJECTED" : "MORE_INFO_REQUIRED";

  /* Compare and set: the write lands only on the status that was read, so two
     reviewers deciding at once cannot both win and both notify. */
  const { data: decidedRows, error: updateError } = await access.supabase
    .from("agent_applications")
    .update({
      status: nextStatus,
      reviewer_id: access.user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq("id", application.id)
    .eq("status", application.status)
    .select("id");
  /* V-90: an application matching an identity stopped for fraud is decided by
     a senior reviewer; the database says which identity and when. */
  if (updateError && updateError.code === "42501" && (updateError.message ?? "").includes("senior reviewer")) {
    return fail(updateError.message);
  }
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);
  if (!decidedRows || decidedRows.length === 0) return fail(DECIDED_ELSEWHERE);

  /*
   * APPROVAL IS THREE WRITES AND THE APPLICANT IS TOLD ONLY WHEN ALL THREE
   * LANDED. supabase-js reports a failed write in `error` rather than
   * throwing, so an unchecked upsert that failed left the application saying
   * APPROVED and the email saying "Agent Mode is open" to a person with no
   * agent row and no role, whom `requireAgent` then refuses. Either failure
   * puts the application back exactly as it was read, so the decision can be
   * taken again, and nothing is announced.
   */
  if (decision === "approve") {
    let sideEffectsFailed = false;
    try {
      const admin = createAdminClient();
      /* Read first, so a failure below can tell a row this approval created,
         which it takes back, from a live profile it must leave alone. */
      const { data: priorAgent, error: priorError } = await admin
        .from("agents")
        .select("id")
        .eq("user_id", application.user_id)
        .maybeSingle();
      if (priorError) throw priorError;
      /*
       * The approved agent profile. on conflict do nothing, so re-running an
       * approval never duplicates a person or overwrites their live profile.
       *
       * `verified` IS NOT WRITTEN HERE, AND THAT IS RULE 12 RATHER THAN A
       * TIDY-UP. Approval opens Agent Mode. It is not a check of anybody: at
       * this moment `verification_tier` is 0 and not one document has been
       * looked at. This upsert used to set `verified: true` in the same
       * breath, which lit the tick in every message thread and the badge on
       * the social profile while every listing behind them correctly showed
       * none, because the listing surfaces read the KYC ladder through
       * `agent_badges`. A reader weighing whether to send a deposit saw the
       * tick in the thread and not on the listing and could not tell which
       * screen was lying.
       *
       * The column is now derived from the tier by `private.derive_agent_badge`
       * and held there by `agents_verified_means_identity_chk`, so writing it
       * from here would be overwritten anyway. It is left out so the code says
       * what the schema says: the badge is earned on the ladder at
       * `/admin/verification`, one rung at a time, by a named member of staff.
       */
      /*
       * THE ROLE REACHES THE ROW, AND UNTIL TODAY IT DID NOT.
       *
       * `personRoleFrom` is the single narrowing of the three doors onto the
       * two person values: owner stays owner, and both agent and firm become
       * agent, because a firm is an ORGANISATION and the person running one is
       * an agent with a firm behind them. The narrowing lives in
       * `lib/supply/roles.ts` rather than here so a second caller cannot do it
       * differently from the first.
       *
       * `type` IS STILL WRITTEN AND IS STILL NOT THE ROLE. It is
       * individual|business, it has never meant owner|agent, five surfaces
       * read it, and migration 1 of Track G marks it deprecated rather than
       * dropping it. Both columns are written for as long as both are read.
       */
      const { error: agentError } = await admin.from("agents").upsert(
        {
          user_id: application.user_id,
          application_id: application.id,
          display_name: application.full_name ?? "Vallo agent",
          type: application.type,
          role: personRoleFrom(application.supply_role),
          status: "APPROVED",
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

      if (agentError) throw agentError;

      // The role grant. user_roles is super-admin-only under RLS by design, so
      // this is one of the three named service-role privileges.
      const { error: roleError } = await admin
        .from("user_roles")
        .upsert(
          { user_id: application.user_id, role: "agent" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (roleError) {
        /* The agents row alone is what `requireAgent` reads, so a row left
           behind by a rolled-back approval would open listing to somebody
           whose application says it was not approved. */
        if (!priorAgent) {
          await admin
            .from("agents")
            .delete()
            .eq("user_id", application.user_id)
            .eq("application_id", application.id);
        }
        sideEffectsFailed = true;
      }
    } catch {
      sideEffectsFailed = true;
    }
    if (sideEffectsFailed) {
      await access.supabase
        .from("agent_applications")
        .update({
          status: application.status,
          reviewer_id: application.reviewer_id,
          reviewed_at: application.reviewed_at,
          review_notes: application.review_notes,
        })
        .eq("id", application.id);
      return fail(
        "The approval did not go through: Agent Mode could not be opened for this person. The application is back in the queue as it was. Try again.",
      );
    }
  }

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  /*
   * THE AUDIT ROW FIRST, THEN THE ANNOUNCEMENT. Both used to sit in one try
   * with the announcement first, so anything the announcement threw skipped
   * the audit row and a committed decision left no trail. `writeAudit` never
   * throws: it retries once and raises a critical alert when it cannot write.
   */
  if (admin) {
    const detail: AuditDetail = {
      before_status: application.status,
      after_status: nextStatus,
      decision,
      reference: application.reference,
      applicant_id: application.user_id,
      notes,
    };
    await writeAudit(admin, {
      actorId: access.user.id,
      action: "agent_application.review",
      entityType: "agent_application",
      entityId: application.id,
      detail,
    });
  }

  /* What the person filed, in their words: the three registration forms file
     an owner, an agent or a firm registration, and only the older six step
     form is an "agent application". An owner was told their agent
     application was approved. */
  const filed =
    application.supply_role === "owner"
      ? "owner registration"
      : application.supply_role === "agent"
        ? "agent registration"
        : application.supply_role === "firm"
          ? "firm registration"
          : "agent application";

  try {
    if (!admin) throw new Error("no service client");

    const notice =
      decision === "approve"
        ? {
            /* It says what actually happened. "Verified" is a word this
               product may only use about somebody a person here has checked,
               and at this instant nobody has: the ladder is at tier 0 and the
               verification queue has not seen a document. The body already
               said the true thing; the title now does too. */
            title: `Your ${filed} is approved`,
            body: "Your agent workspace is open, so you can list your first property. Verification is a separate step and you can start it from your dashboard.",
          }
        : decision === "reject"
          ? {
              title: `Your ${filed} was not approved`,
              body: notes ?? "Open your application to read the reviewer's note.",
            }
          : {
              title: `Your ${filed} needs more information`,
              body: notes ?? "Open your application to see what the reviewer needs.",
            };

    /*
     * THE SAME JUNCTION, ON THE REGISTRATION SIDE. Three decisions, three
     * builders, none of which existed: the registration half of the catalogue
     * was empty, so an applicant approved at eleven in the morning learnt
     * about it only by opening the app.
     */
    await announce(admin, {
      recipient: { kind: "user", userId: application.user_id },
      notice: {
        kind: "agent",
        title: notice.title,
        body: notice.body,
        /* The application lives under the profile now: it is a fact about your
           own account, not a page in the public marketing site.
           `/agents/status` still redirects, but a notification written today
           should carry the real address rather than lean on a compatibility
           hop. */
        href: "/profile/application",
      },
      email: (contact) =>
        decision === "approve"
          ? agentApplicationApproved({
              name: contact.name,
              reference: application.reference,
            })
          : decision === "reject"
            ? agentApplicationRejected({
                name: contact.name,
                reference: application.reference,
                reason:
                  notes ?? "The reviewer left no note. Contact support with your reference and a person will explain.",
              })
            : agentApplicationNeedsMore({
                name: contact.name,
                reference: application.reference,
                reason:
                  notes ?? "Open your application to see what the reviewer needs.",
              }),
    });
  } catch {
    // The decision itself has committed and is in the audit log. Telling the
    // applicant is best effort.
  }

  revalidatePath("/admin/agents");
  revalidatePath("/admin");
  return ok(null);
}

/**
 * The listing's code, on the one decision that creates it.
 *
 * The row is read before the status update, so on the publish that takes a
 * listing live for the first time `reference` is still null in hand while the
 * database has just minted one. Rather than print nothing on the single
 * message where the code matters most, this reads it back. Every other
 * decision uses the value already held, and a failed read degrades to no code
 * rather than to a failed decision.
 */
async function publishedReference(
  admin: SupabaseClient<Database>,
  listingId: string,
  held: string | null,
  decision: "approve" | "publish" | "reject" | "request_changes",
): Promise<string | null> {
  if (held) return held;
  if (decision !== "publish") return null;
  try {
    const { data } = await admin
      .from("listings")
      .select("reference")
      .eq("id", listingId)
      .maybeSingle();
    return data?.reference ?? null;
  } catch {
    return null;
  }
}

/** ----------------------------------------------------------------- listings */

/**
 * A reviewer's note as the one line of a notification, under the listing it
 * is about. The note used to be the whole body, so a lister with three
 * listings read "Add at least five clear photos" and could not tell which
 * one; the reason codes' checklist dashes are folded into one sentence run.
 */
function reviewNoticeLine(title: string, notes: string): string {
  const flat = notes
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .join(" ");
  return `${title}: ${flat}`;
}

export async function reviewListing(input: {
  listingId: string;
  decision: "approve" | "publish" | "reject" | "request_changes";
  notes?: string;
  /** C8: reason codes; their lister-facing sentences are composed into the note here, on the server. */
  reasons?: string[];
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("listing_approval");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(reviewListingSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { listingId, decision } = parsed.data;
  const reasons = (parsed.data.reasons ?? []).filter(isReviewReasonCode);
  /* The codes' sentences, then the reviewer's own words: the same reasons
     always read the same to the lister (C8). Approve and publish carry no codes. */
  const composed =
    decision === "reject" || decision === "request_changes"
      ? composeReviewNote(reasons, parsed.data.notes ?? "")
      : (parsed.data.notes ?? "");
  const notes = composed.length > 0 ? composed : null;

  if (decision === "request_changes" && (notes === null || notes.length === 0)) {
    return fail("Tell the agent what to change.", {
      notes: "Write the change you need before sending it back.",
    });
  }
  /* A rejection always says why: the lister reads it, and the next reviewer
     needs it if the listing comes back. */
  if (decision === "reject" && (notes === null || notes.trim().length < 8)) {
    return fail("Say why this listing is rejected, in at least eight characters. The lister reads it.", {
      notes: "Write the reason for the rejection.",
    });
  }

  const { data: listing, error: readError } = await access.supabase
    .from("listings")
    .select("id, title, status, agent_id, reference, published_at, agents!listings_agent_id_fkey( user_id )")
    .eq("id", listingId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!listing) return fail(GONE);

  /* Nobody reviews their own listing, whatever their access. The rule used to
     be skipped when the lister could not be read, which is the one case it
     cannot vouch for, so a lister nobody can name is not decided at all. */
  const listerUserId = listing.agents?.user_id ?? null;
  if (!listerUserId) {
    return fail("We could not confirm who listed this, so nothing was decided. Refresh and try again.");
  }
  if (listerUserId === access.user.id) {
    return fail("You cannot review your own listing. Leave it for another reviewer.");
  }
  if (listing.status === "DRAFT") {
    return fail("This listing is still a draft, so there is nothing to review yet.");
  }
  /* WHICH DECISIONS EACH STATUS TAKES. A rejected listing and one sent back
     for changes are with the lister, who can be editing them at this moment
     (both are editable); approving either passed a version nobody had sent,
     and the desk's page already offered no decision on a rejected one. They
     come back here when the lister sends them again. An approved listing is
     published or sent back, not approved a second time, which wrote a second
     audit row and told the lister twice. */
  if (listing.status === "REJECTED") {
    return fail("This listing was rejected and is with the lister. It comes back here when they send it again.");
  }
  if (decision === "approve" && listing.status === "MORE_INFO_REQUIRED") {
    return fail("This listing is with the lister for changes. Approve it once they send it back.");
  }
  if (decision === "approve" && listing.status === "APPROVED") {
    return fail("This listing is already approved. Publish it, or send it back to the lister.");
  }
  if (decision === "publish" && listing.status !== "APPROVED") {
    return fail("Approve this listing first, then publish it.");
  }
  /* V-57: a nightly stay is published only once its arrival charges are
     declared (all five, an amount or none). Lets and sales are untouched. */
  if (decision === "publish" && !(await arrivalChargesDeclared(access.supabase, { listingId }))) {
    return fail(ARRIVAL_DECLARATION_NEEDED);
  }
  if (decision !== "publish" && listing.status === "PUBLISHED") {
    return fail("This listing is already live. Refresh the queue to see the current state.");
  }

  const nextStatus =
    decision === "approve"
      ? "APPROVED"
      : decision === "publish"
        ? "PUBLISHED"
        : decision === "reject"
          ? "REJECTED"
          : "MORE_INFO_REQUIRED";

  const now = new Date().toISOString();
  const { data: decidedListing, error: updateError } = await access.supabase
    .from("listings")
    .update({
      status: nextStatus,
      reviewer_id: access.user.id,
      reviewed_at: now,
      review_notes: notes,
      /* The FIRST time it went live, kept (V-22, batch 1 review finding 4):
         a listing sent back to draft and published again is not new, and
         "Listed today", the Newest sort, the New mark and saved-search alerts
         all read this column. */
      ...(decision === "publish" && !listing.published_at ? { published_at: now } : {}),
    })
    .eq("id", listing.id)
    /* Compare and set, as for applications: a second reviewer's click on a
       row somebody already moved changes nothing. */
    .eq("status", listing.status)
    .select("id");
  if (isClosedListingRefusal(updateError)) return fail(CLOSED_LISTING_MESSAGE);
  /* SCUML item 15: a high-risk lister's listing waits for a cleared EDD review. */
  if (isEddGateRefusal(updateError)) return fail(eddGateMessage("admin"));
  /* D51: no publish without the lister's recorded acceptance of the fee on this price. */
  if (isRateAgreementRefusal(updateError)) {
    return fail(
      "The lister has not accepted the current fee on this listing's price, so it cannot go live yet. Ask them to review and accept it.",
    );
  }
  /* SCUML item 17: the publish gate refuses an agent or firm listing without an approved mandate. */
  if (isMandateRefusal(updateError)) return fail(MANDATE_NEEDED_MESSAGE);
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);
  if (!decidedListing || decidedListing.length === 0) return fail(DECIDED_ELSEWHERE);

  try {
    const admin = createAdminClient();
    const ownerId = listerUserId;

    if (ownerId) {
      /*
       * THE CODE, APPENDED IN BRACKETS. A notification is often read on a
       * lock screen, which is exactly the moment somebody is being asked for
       * the code down the phone. It is only there once the listing has been
       * published, because that is when the database issues it.
       *
       * On the publish branch `reference` is read from the row BEFORE the
       * update, so it is null the first time a listing goes live. The row is
       * re-read below for that one case rather than printing nothing.
       */
      const code = await publishedReference(admin, listing.id, listing.reference, decision);
      const tag = code ? ` (${code})` : "";

      const notice =
        decision === "approve"
          ? {
              /*
               * IT NO LONGER TELLS THEM TO PRESS A BUTTON THEY DO NOT HAVE.
               *
               * This told the lister to publish it themselves, to put it
               * in front of guests. Publishing is an ADMIN act:
               * `reviewListing` refuses it from anybody who is not an admin
               * and the agent console carries no such control. So a lister
               * read an instruction, went looking for the button, and found
               * nothing. The next step here is ours and the sentence now
               * says so.
               */
              title: "Listing passed review",
              body: `${listing.title} passed review. We put it live next, and there is nothing for you to do.`,
            }
          : decision === "publish"
            ? {
                title: "Listing is live",
                body: `${listing.title}${tag} is now in search and open to guests.`,
              }
            : decision === "reject"
              ? {
                  title: "Listing not approved",
                  body: notes
                    ? reviewNoticeLine(listing.title, notes)
                    : `${listing.title} did not pass review. Open it to read the note.`,
                }
              : {
                  title: "Listing needs changes",
                  body: notes
                    ? reviewNoticeLine(listing.title, notes)
                    : `${listing.title} needs a change before it can go live.`,
                };

      /*
       * THE JUNCTION. Both halves of one decision, in one call. Until this
       * line every listing decision wrote an in-app row and sent no email at
       * all, while `listingApproved` and `listingRejected` sat complete in the
       * catalogue with zero callers.
       *
       * WHICH BUILDER GOES WITH WHICH DECISION, and it is not one to one:
       * `listingApproved`'s copy is written for PUBLISH ("It is published and
       * people can find it now"), so approve gets its own builder rather than
       * a message that would tell somebody their property is in search when it
       * is not.
       */
      await announce(admin, {
        recipient: { kind: "user", userId: ownerId },
        /* An approval or a publish carries its success moment on the link, with
           the listing it names; the lister's page checks that listing's status
           before the sheet opens (docs/SUCCESS_MOMENTS.md). */
        notice: {
          kind: "listing",
          href:
            decision === "publish"
              ? withDone("/agent/listings", "listing-live", { listing: listing.id })
              : decision === "approve"
                ? withDone("/agent/listings", "listing-approved", { listing: listing.id })
                : "/agent/listings",
          ...notice,
        },
        email: (contact) =>
          decision === "publish"
            ? listingApproved({
                listerName: contact.name,
                listingTitle: listing.title,
                listingId: listing.id,
                reference: code,
              })
            : decision === "approve"
              ? listingPassedReview({ listerName: contact.name, listingTitle: listing.title })
              : decision === "reject"
                ? listingRejected({
                    listerName: contact.name,
                    listingTitle: listing.title,
                    /* REJECTED is editable, so resubmission is the real path. */
                    reason: notes ?? "The reviewer left no note. Contact support and a person will explain.",
                    canResubmit: true,
                  })
                : listingChangesRequested({
                    listerName: contact.name,
                    listingTitle: listing.title,
                    reason: notes ?? "The reviewer left no note. Contact support and a person will explain.",
                  }),
      });
    }

  } catch {
    // The transition has committed. Telling the lister is best effort.
  }

  /* The audit row is written on its own, so a notification or email that
     throws can never cost the decision its record. */
  try {
    const detail: AuditDetail = {
      before_status: listing.status,
      after_status: nextStatus,
      decision,
      title: listing.title,
      agent_id: listing.agent_id,
      notes,
      /* C8: countable on the analytics desk ("why listings were sent back"). */
      reasons: reasons.join(","),
    };
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "listing.review",
      entityType: "listing",
      entityId: listing.id,
      detail,
    });
  } catch {
    // Best effort, as every other admin decision's audit row.
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  return ok(null);
}

/** ---------------------------------------------------------- support tickets */

export async function replySupportTicket(input: {
  ticketId: string;
  body: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("support");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(replySupportTicketSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: ticket, error: readError } = await access.supabase
    .from("support_tickets")
    .select("id, reference, status")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!ticket) return fail(GONE);

  // The reply goes in under the admin's own client: the insert policy proves
  // the role, and notify_support_reply then tells the ticket owner.
  const { error: insertError } = await access.supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    sender_role: "admin",
    sender_id: access.user.id,
    body: parsed.data.body,
  });
  if (insertError) return fail(claimRefusal(insertError) ?? SERVICE_DOWN);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "support_ticket.reply",
      entityType: "support_ticket",
      entityId: ticket.id,
      detail: {
        before_status: ticket.status,
        after_status: ticket.status,
        reference: ticket.reference,
        characters: parsed.data.body.length,
      },
    });
  } catch {
    // Best effort.
  }

  revalidatePath("/admin/support");
  revalidatePath("/admin");
  return ok(null);
}

export async function setTicketStatus(input: {
  ticketId: string;
  status: "open" | "pending" | "resolved" | "closed";
  /** Required to close: what was done. Kept in the audit trail. */
  note?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("support");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(setTicketStatusSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const closingNote = (input.note ?? "").trim().slice(0, 1000);
  if (parsed.data.status === "closed" && closingNote.length < 8) {
    return fail("Say what was done before closing this ticket, in at least eight characters.", {
      note: "Write a closing note.",
    });
  }

  const { data: ticket, error: readError } = await access.supabase
    .from("support_tickets")
    .select("id, reference, status")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!ticket) return fail(GONE);
  if (ticket.status === parsed.data.status) return fail("This ticket already sits in that state.");

  const { error: updateError } = await access.supabase
    .from("support_tickets")
    .update({ status: parsed.data.status })
    .eq("id", ticket.id);
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "support_ticket.status",
      entityType: "support_ticket",
      entityId: ticket.id,
      detail: {
        before_status: ticket.status,
        after_status: parsed.data.status,
        reference: ticket.reference,
        closing_note: parsed.data.status === "closed" ? closingNote : null,
      },
    });
  } catch {
    // Best effort.
  }

  revalidatePath("/admin/support");
  revalidatePath("/admin");
  return ok(null);
}

/** ------------------------------------------------------------ kill switches */

export async function toggleFeatureFlag(input: {
  key: string;
  enabled: boolean;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(toggleFeatureFlagSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: flag, error: readError } = await access.supabase
    .from("feature_flags")
    .select("key, enabled, note")
    .eq("key", parsed.data.key)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!flag) return fail("There is no switch by that name. Reload the console to see the switches there are.");
  if (flag.enabled === parsed.data.enabled) {
    return fail("That switch is already in this position. Refresh to see the current state.");
  }

  const { error: updateError } = await access.supabase
    .from("feature_flags")
    .update({ enabled: parsed.data.enabled })
    .eq("key", flag.key);
  if (updateError) return fail(claimRefusal(updateError) ?? SERVICE_DOWN);

  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: parsed.data.enabled ? "feature_flag.enable" : "feature_flag.disable",
      entityType: "feature_flag",
      entityId: flag.key,
      detail: {
        before_status: flag.enabled ? "enabled" : "disabled",
        after_status: parsed.data.enabled ? "enabled" : "disabled",
        note: flag.note,
      },
    });
  } catch {
    // Best effort.
  }

  revalidatePath("/admin/switches");
  revalidatePath("/admin");
  return ok(null);
}
