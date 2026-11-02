"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDictionary, type Dictionary } from "@vallo/i18n";
import { z } from "zod";
import { getLocale } from "../locale";
import { readPhone } from "../phone";
import { isCountryCode, readInternational } from "../phone-intl";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { consume, subjectForUser } from "../security/rate-limit";
import { hasServiceRole } from "../security/service-rpc";
import { createAdminClient } from "../supabase/admin";
import { isConfirmOutcome, memberConfirmRefusal, type MemberConfirmRefusal } from "./core";
import { phoneConfirmationOn } from "./flag";
import { runSendCode, type SendOutcome } from "./send";
import { recordNumberRefused } from "./staff-trail";
import { otpTransport } from "./transport";

/**
 * SEND A CODE, AND CONFIRM IT (V-50).
 *
 * Both are closed while `phone_confirmation` is off, with a sentence rather
 * than an error, because the only way to reach them with the flag off is a
 * stale page. Sending needs the service role (the code's hash is written by a
 * function a member cannot call); confirming runs as the member.
 *
 * ALLOWANCES, FAILING CLOSED, because a code is an SMS the founder pays for
 * and an open door here sends strangers texts at Vallo's expense:
 *
 *   five codes an hour per account;
 *   three an hour per number FOR THIS ACCOUNT, so a stranger typing somebody
 *   else's number spends their own allowance and never the owner's;
 *   twenty a day per number across every account, the cost ceiling on one
 *   handset. A stranger would need several accounts to reach it, and the
 *   owner can still confirm the next day.
 *
 * NO ENUMERATION (founder's ruling, 13 October 2026). Nothing here tells
 * anybody that a number is on Vallo or on another account. A number on
 * another account and a number that cannot be used are one sentence
 * (`numberRefused`), one shape (the words, and the same words on the
 * number field) and the same work before the answer; the real reason goes
 * to the audit trail for staff (`staff-trail.ts`), after the reply. A
 * number already confirmed on the member's OWN account is their own data
 * and is said plainly.
 *
 * The words come from the dictionary, in the reader's locale.
 */

type PhoneCopy = Dictionary["trustVisible"]["phone"];

function sendMessages(copy: PhoneCopy): Record<Exclude<SendOutcome, { ok: true }>["reason"], string> {
  return {
    limited: copy.sendLimited,
    refused: copy.numberRefused,
    already: copy.sendAlready,
    unconfigured: copy.sendUnconfigured,
    failed: copy.sendFailed,
  };
}

function confirmMessages(copy: PhoneCopy): Record<MemberConfirmRefusal, string> {
  return {
    wrong: copy.confirmWrong,
    expired: copy.confirmExpired,
    locked: copy.confirmLocked,
    no_code: copy.confirmNoCode,
    refused: copy.numberRefused,
    signed_out: SIGNED_OUT_MESSAGE,
  };
}

/** The one shape every number refusal has: the words, on the number field too. */
function refusedNumber<T>(copy: PhoneCopy): ActionResult<T> {
  return fail(copy.numberRefused, { phone: copy.numberRefused });
}

async function phoneCopy(): Promise<PhoneCopy> {
  return getDictionary(await getLocale()).trustVisible.phone;
}

type RpcCaller = {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

async function allowed(bucket: string, subject: string, limit: number, windowSeconds = 3_600): Promise<boolean> {
  const verdict = await consume({ bucket, subject, limit, windowSeconds });
  return verdict.allowed && !verdict.degraded;
}

export async function sendPhoneCode(input: unknown): Promise<ActionResult<{ sentTo: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const copy = await phoneCopy();
  const messages = sendMessages(copy);
  if (!(await phoneConfirmationOn())) return fail(copy.closed);

  const parsed = validate(
    z.object({ phone: z.string().trim().min(1, copy.numberEmpty), country: z.string().max(2).optional() }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const country = isCountryCode(parsed.data.country) ? parsed.data.country : "NG";
  const typed = parsed.data.phone;
  /* A number typed with a plus is read as written; one without is read in the
     chosen country. Nigerian numbers keep their own reading (carrier names, NCC
     ranges) and go to Termii; every other country is read by the international
     rules and goes to Twilio (`transport.ts`). */
  const nigerian = typed.startsWith("+") ? typed.replace(/\D/g, "").startsWith("234") : country === "NG";
  let e164: string;
  if (nigerian) {
    const reading = readPhone(typed);
    if (reading.state !== "valid") {
      /* The shape of a Nigerian number, said about the digits typed: it is the
         same for every person and says nothing about who holds the number. */
      const words = reading.state === "invalid" ? reading.reason : copy.profileInvalid;
      return fail(words, { phone: words });
    }
    e164 = reading.e164;
  } else {
    const reading = readInternational(typed, country);
    if (reading.state !== "valid") return fail(copy.numberInvalid, { phone: copy.numberInvalid });
    e164 = reading.e164;
  }
  if (!hasServiceRole()) return fail(messages.unconfigured);

  const admin = createAdminClient() as unknown as RpcCaller;
  const result = await runSendCode(
    {
      randomInt: (max) => randomInt(max),
      issue: async (userId, phone, code) => {
        const { data, error } = await admin.rpc("phone_otp_issue", { p_user: userId, p_phone: phone, p_code: code });
        if (error) throw new Error("issue failed");
        return data;
      },
      transport: otpTransport(),
      allow: async (userId, phone) =>
        (await allowed("phone_otp_user", subjectForUser(userId), 5)) &&
        (await allowed("phone_otp_number_account", `phone:${phone}:${subjectForUser(userId)}`, 3)) &&
        (await allowed("phone_otp_number_day", `phone:${phone}`, 20, 86_400)),
    },
    session.user.id,
    e164,
  );
  if (!result.ok) {
    if (result.reason === "refused") {
      const userId = session.user.id;
      const reason = result.staffReason;
      after(() => recordNumberRefused(userId, reason));
      return refusedNumber(copy);
    }
    return fail(messages[result.reason]);
  }
  return ok({ sentTo: e164 });
}

export async function confirmPhoneCode(input: unknown): Promise<ActionResult<{ confirmed: true }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const copy = await phoneCopy();
  if (!(await phoneConfirmationOn())) return fail(copy.closed);

  const parsed = validate(z.object({ code: z.string().trim().regex(/^\d{6}$/, copy.codeShape) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data, error } = await (session.supabase as unknown as RpcCaller).rpc("confirm_phone", {
    p_code: parsed.data.code,
  });
  if (error || !isConfirmOutcome(data)) return fail(copy.sendFailed);
  if (data !== "confirmed") {
    if (data === "taken") {
      const userId = session.user.id;
      after(() => recordNumberRefused(userId, "taken_on_confirm"));
    }
    return fail(confirmMessages(copy)[memberConfirmRefusal(data)]);
  }
  revalidatePath("/settings/phone");
  return ok({ confirmed: true });
}
