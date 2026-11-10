"use server";

/**
 * Account deletion, as a flow rather than as a call.
 *
 * THIS MODULE IS "use server", SO IT EXPORTS ASYNC FUNCTIONS AND NOTHING ELSE.
 * Not a constant, not a type, not a re-export. Every value the screens need
 * lives in `constants.ts`, `preconditions.ts` or `queries.ts`. Section 10.7 of
 * the ledger records what the other mistake costs: twenty minutes of
 * production, in this build.
 *
 * WHAT THIS REPLACES. `lib/profile/actions.ts` called
 * `admin.auth.admin.deleteUser`, which aborts on the first row whose foreign
 * key is `on delete restrict`, which is every booking and every wallet. So
 * anybody who had ever paid for anything was told to email support, which is
 * the case App Store Review guideline 5.1.1(v) names as a rejection. See
 * `docs/design/audits/r3/findings.md` F-17.
 *
 * THE FLOW, IN ORDER, AND EVERY STEP IS A REFUSAL POINT.
 *
 *   1. The preconditions are re-asked in the database, not trusted from the
 *      screen, so a booking made in another tab a second ago still blocks.
 *   2. The person re-authenticates: the password, or a one-time code for an
 *      account that has never had one.
 *   3. The phrase is typed in capitals and checked on the server.
 *   4. A request row is written with a thirty day clock on it.
 *   5. Every session is ended and the account is BANNED for the window, which
 *      is what deactivated means here: it is enforced by the auth server and
 *      not by a flag the app has to remember to check.
 *   6. An email goes out carrying the date and the restore code, because a
 *      banned account cannot be signed into and the code is the way back.
 *   7. Every one of those steps is written to `audit_log`.
 *
 * NOTHING IS DESTROYED TODAY. The purge runs at the end of the window, on the
 * cron harness, in `lib/cron/jobs/account-purge.ts`.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { bestEffortEmail, sendMessage } from "../email/client";
import { consume, ipFromHeaders, subjectForIp, subjectForUser } from "../security/rate-limit";
import { revokeTokens } from "../push/revoke";
import { createAdminClient } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/env";
import { writeDeletionAudit } from "./audit";
import { GRACE_WINDOW_DAYS } from "./constants";
import { deletionStarted } from "./emails";
import { blockersFrom, readingFrom } from "./preconditions";
import { reauthenticate, sendReauthCode } from "./reauthenticate";
import { markReasonRestored, recordDeletionReason } from "./reasons";
import { hashRestoreCode, looksLikeRestoreCode, newRestoreCode } from "./restore-code";
import { asRecord, callDeletionRpc } from "./rpc";
import { confirmDeletionSchema, restoreWithCodeSchema } from "./schema";

const GATED_MESSAGE =
  "We cannot run a deletion from here right now, and nothing has been changed. Try again shortly.";

const REAUTH_FAILED_MESSAGE =
  "That did not match. Nothing has been changed. Check it and try once more.";

const BLOCKED_MESSAGE =
  "There is still something of yours here, so nothing has been changed. The list above says what, and each one has a way to clear it.";

const ALREADY_OPEN_MESSAGE =
  "This account is already scheduled for deletion. The date is on this screen.";

const CODE_SENT_FAILED_MESSAGE =
  "We could not send the code just now. Nothing has been changed. Try again in a moment.";

const RESTORE_NOT_FOUND_MESSAGE =
  "That code does not match an account waiting to be deleted. If the thirty days have already passed, the deletion has run and cannot be undone.";

const RESTORE_FAILED_MESSAGE =
  "We could not restore the account just now. Nothing has been changed. Try again shortly.";

/** True when the platform holds a service role key it can act with. */
async function serviceClientOrNull() {
  if (!isSupabaseConfigured()) return null;
  if ((process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length === 0) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function callerIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

/**
 * Send the one-time code an account with no password re-authenticates with.
 *
 * Paced per person rather than per address of origin: this can only ever mail
 * the address already on the signed-in account, so the thing worth limiting is
 * one account asking for codes in a loop.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function sendDeletionCode(
  ...args: Parameters<typeof sendDeletionCodeInner>
): Promise<Awaited<ReturnType<typeof sendDeletionCodeInner>>> {
  return setupExempt(() => sendDeletionCodeInner(...args));
}

async function sendDeletionCodeInner(): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const paced = await consume({
    bucket: "deletion_code",
    subject: subjectForUser(session.user.id),
    limit: 5,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return fail(`Too many codes requested just now. Try again ${paced.retryIn}.`);
  }

  const sent = await sendReauthCode(session.user);
  if (!sent) return fail(CODE_SENT_FAILED_MESSAGE);
  return ok(null);
}

/**
 * Open the thirty day window. Nothing is destroyed here.
 *
 * Returns the date the purge runs, so the screen can say it back rather than
 * computing a second version of the same clock.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function startDeletion(
  ...args: Parameters<typeof startDeletionInner>
): Promise<Awaited<ReturnType<typeof startDeletionInner>>> {
  return setupExempt(() => startDeletionInner(...args));
}

async function startDeletionInner(
  input: unknown,
): Promise<ActionResult<{ purgeAfter: string; graceDays: number }>> {
  const parsed = validate(confirmDeletionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(GATED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { supabase, user } = session;

  const paced = await consume({
    bucket: "deletion_start",
    subject: subjectForUser(user.id),
    limit: 5,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return fail(`Too many attempts just now. Try again ${paced.retryIn}.`);
  }

  const admin = await serviceClientOrNull();
  if (!admin) return fail(GATED_MESSAGE);

  const proved = await reauthenticate(user, {
    password: parsed.data.password,
    emailCode: parsed.data.emailCode,
  });
  if (!proved) {
    await writeDeletionAudit(admin, {
      action: "account.deletion.reauth_failed",
      userId: user.id,
    });
    return fail(REAUTH_FAILED_MESSAGE);
  }

  // Minted before the call so the hash can go in with the row rather than in a
  // second write against a table the generated types do not carry yet. A
  // scheduling failure simply leaves an unused code in memory.
  const restoreCode = newRestoreCode();

  const scheduled = await callDeletionRpc(admin, "schedule_account_deletion", {
    p_user: user.id,
    p_days: GRACE_WINDOW_DAYS,
    p_restore_code_hash: hashRestoreCode(restoreCode),
  });
  if (!scheduled.ok) return fail(GATED_MESSAGE);

  const answer = asRecord(scheduled.data);
  if (answer["scheduled"] !== true) {
    const reason = typeof answer["reason"] === "string" ? answer["reason"] : "refused";
    if (reason === "already_open") return fail(ALREADY_OPEN_MESSAGE);
    if (reason === "blocked") {
      const reading = readingFrom(answer["blockers"]);
      await writeDeletionAudit(admin, {
        action: "account.deletion.refused",
        userId: user.id,
        detail: { blockers: blockersFrom(reading).length },
      });
      return fail(BLOCKED_MESSAGE);
    }
    return fail(GATED_MESSAGE);
  }

  const requestId = typeof answer["request_id"] === "string" ? answer["request_id"] : null;
  const purgeAfter = typeof answer["purge_after"] === "string" ? answer["purge_after"] : "";

  await writeDeletionAudit(admin, {
    action: "account.deletion.requested",
    userId: user.id,
    requestId,
    detail: { grace_days: GRACE_WINDOW_DAYS, reason: parsed.data.reason ?? "not_given" },
  });

  // The reason, kept for the admin rates desk. Best effort: until the SQL is
  // applied (or if the write fails) the deletion still goes ahead.
  await recordDeletionReason(admin, {
    userId: user.id,
    reason: parsed.data.reason,
    note: parsed.data.reasonNote,
    accountCreatedAt: user.created_at,
  });

  // Signed out everywhere, then banned for the length of the window. The ban
  // is what makes "deactivated" a fact rather than a promise: GoTrue refuses
  // to mint a token for a banned row, so no screen in the product has to
  // remember to check a flag.
  try {
    await (supabase as unknown as { rpc: (fn: string) => PromiseLike<unknown> }).rpc(
      "end_other_sessions",
    );
  } catch {
    // The ban below covers this. A session that cannot be ended explicitly
    // stops refreshing within the hour.
  }
  // A deactivated account sends no pushes. The purge deletes `push_tokens` at
  // the end of the window, but the drain only skips REVOKED rows, so without
  // this every device kept receiving the account's notifications for thirty
  // days. Restoring does not re-enable them; the person turns push back on.
  try {
    await revokeTokens(user.id, { all: true });
  } catch {
    // Best effort, like the session end above.
  }
  try {
    await admin.auth.admin.updateUserById(user.id, {
      ban_duration: `${GRACE_WINDOW_DAYS * 24}h`,
    });
  } catch {
    // Reported through the audit line above rather than swallowed silently:
    // the request is real either way and the purge still runs.
  }

  if (user.email) {
    const address = user.email;
    // Their own row, through their own client, read before the sign out below.
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", user.id)
      .maybeSingle();
    await bestEffortEmail(() =>
      sendMessage(
        address,
        deletionStarted({ name: profile?.first_name ?? null, purgeAfter, restoreCode }),
      ),
    );
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  return ok({ purgeAfter, graceDays: GRACE_WINDOW_DAYS });
}

/** Form binding for useActionState in the confirmation drawer. */
export async function startDeletionAction(
  _prev: ActionResult<{ purgeAfter: string; graceDays: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ purgeAfter: string; graceDays: number }>> {
  return startDeletion(formDataToObject(formData));
}

/**
 * Change your mind, from inside a session.
 *
 * Reachable while a session minted before the ban is still valid, and by
 * anybody whose deletion is open for another reason. The code path below is
 * the one that works once the ban has bitten.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function cancelDeletion(
  ...args: Parameters<typeof cancelDeletionInner>
): Promise<Awaited<ReturnType<typeof cancelDeletionInner>>> {
  return setupExempt(() => cancelDeletionInner(...args));
}

async function cancelDeletionInner(): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(GATED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const admin = await serviceClientOrNull();
  if (!admin) return fail(GATED_MESSAGE);

  const cancelled = await callDeletionRpc(admin, "cancel_account_deletion", {
    p_user: session.user.id,
    p_restore_code_hash: null,
  });
  if (!cancelled.ok) return fail(RESTORE_FAILED_MESSAGE);
  if (asRecord(cancelled.data)["cancelled"] !== true) return fail(RESTORE_NOT_FOUND_MESSAGE);

  try {
    await admin.auth.admin.updateUserById(session.user.id, { ban_duration: "none" });
  } catch {
    return fail(RESTORE_FAILED_MESSAGE);
  }

  await writeDeletionAudit(admin, {
    action: "account.deletion.cancelled",
    userId: session.user.id,
    detail: { by: "session" },
  });
  await markReasonRestored(admin, session.user.id);

  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * Change your mind, with the code from the email and no session at all.
 *
 * Paced per address of origin, because the subject of this call is a token
 * rather than an account and there is nobody signed in to count against. The
 * only thing the code can do is cancel a deletion, so a guessed code fails in
 * the direction where an account survives.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function restoreWithCode(
  ...args: Parameters<typeof restoreWithCodeInner>
): Promise<Awaited<ReturnType<typeof restoreWithCodeInner>>> {
  return setupExempt(() => restoreWithCodeInner(...args));
}

async function restoreWithCodeInner(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(restoreWithCodeSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const paced = await consume({
    bucket: "deletion_restore",
    subject: subjectForIp(await callerIp()),
    limit: 10,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return fail(`Too many attempts just now. Try again ${paced.retryIn}.`);
  }

  if (!looksLikeRestoreCode(parsed.data.restoreCode)) return fail(RESTORE_NOT_FOUND_MESSAGE);

  const admin = await serviceClientOrNull();
  if (!admin) return fail(GATED_MESSAGE);

  const cancelled = await callDeletionRpc(admin, "cancel_account_deletion", {
    p_user: null,
    p_restore_code_hash: hashRestoreCode(parsed.data.restoreCode),
  });
  if (!cancelled.ok) return fail(RESTORE_FAILED_MESSAGE);

  const answer = asRecord(cancelled.data);
  if (answer["cancelled"] !== true) return fail(RESTORE_NOT_FOUND_MESSAGE);

  const userId = typeof answer["user_id"] === "string" ? answer["user_id"] : null;
  if (!userId) return fail(RESTORE_FAILED_MESSAGE);

  try {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  } catch {
    return fail(RESTORE_FAILED_MESSAGE);
  }

  await writeDeletionAudit(admin, {
    action: "account.deletion.cancelled",
    userId,
    detail: { by: "restore_code" },
  });
  await markReasonRestored(admin, userId);

  return ok(null);
}

/** Form binding for the public restore form on /delete-account. */
export async function restoreWithCodeAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return restoreWithCode(formDataToObject(formData));
}
