"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClientWithAgent } from "@/lib/security/agent-client";
import { consume, ipFromHeaders, subjectForIp } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/return-path";
import { formatPhone, normalisePhone } from "@/lib/phone";
import { rememberFirstCodeSignIn } from "./first-sign-in-server";
import { claimInviteFromCookie } from "@/lib/referral/server";
import { isSixDigits, type CodeSignInState } from "./code-sign-in-state";
import { phoneSignInEnabled } from "./phone-sign-in-flag";
import { isUnreachableAuthError } from "./unreachable";

/**
 * A2. SIGN IN (OR UP) WITH A PHONE NUMBER, THE CODE BY WHATSAPP OR SMS.
 *
 * Supabase Auth generates and checks the code (`signInWithOtp({ phone })`,
 * `verifyOtp({ type: "sms" })`); our Send SMS hook (`/api/auth/sms-hook`)
 * only delivers it, WhatsApp first through Termii and the DND SMS route as the
 * fallback. Behind `PHONE_SIGNIN_ENABLED`, off by default: with it off both
 * actions refuse before anything is sent.
 *
 * A new number makes an account, as the recommendation asks. It has no terms
 * receipt yet, so the finish-setup gate in `proxy.ts` asks for the terms and
 * the 18+ statement before it goes anywhere (`lib/auth/finish-setup.ts`).
 */

export async function sendPhoneSignInCode(_prev: CodeSignInState, formData: FormData): Promise<CodeSignInState> {
  if (!phoneSignInEnabled()) return { step: "ask", error: "off" };
  const phone = normalisePhone(String(formData.get("phone") ?? "").slice(0, 32));
  if (!phone) return { step: "ask", error: "badTarget" };

  const ip = subjectForIp(ipFromHeaders(await headers()));
  const [byIp, byNumber] = await Promise.all([
    consume({ bucket: "phone_code_send", subject: ip, limit: 6, windowSeconds: 600 }),
    consume({ bucket: "phone_code_send_number", subject: `phone:${phone}`, limit: 4, windowSeconds: 3_600 }),
  ]);
  if (!byIp.allowed || !byNumber.allowed) return { step: "ask", target: phone, error: "limited" };

  try {
    const supabase = await createClientWithAgent();
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: "sms" } });
    if (error) return { step: "ask", target: phone, error: /rate|too many/i.test(error.message) ? "limited" : "failed" };
  } catch {
    return { step: "ask", target: phone, error: "failed" };
  }
  return { step: "code", target: phone, shown: formatPhone(phone) };
}

export async function verifyPhoneSignInCode(_prev: CodeSignInState, formData: FormData): Promise<CodeSignInState> {
  if (!phoneSignInEnabled()) return { step: "ask", error: "off" };
  const phone = normalisePhone(String(formData.get("target") ?? ""));
  const token = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!phone) return { step: "ask", error: "badTarget" };
  if (!isSixDigits(token)) return { step: "code", target: phone, shown: formatPhone(phone), error: "badCode" };

  const verdict = await consume({ bucket: "phone_code_verify", subject: `phone:${phone}`, limit: 10, windowSeconds: 600 });
  if (!verdict.allowed) return { step: "code", target: phone, shown: formatPhone(phone), error: "limited" };

  const supabase = await createClientWithAgent();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  /* SPEED: a check that never got an answer is not a wrong code. */
  if (error && isUnreachableAuthError(error)) return { step: "code", target: phone, shown: formatPhone(phone), error: "failed" };
  if (error) return { step: "code", target: phone, shown: formatPhone(phone), error: "wrongCode" };
  /* A first sign-in (this code confirmed the number) earns "Welcome to
     Vallo" on the next screen, by the one-shot cookie. */
  await rememberFirstCodeSignIn(supabase, data?.user, "phone");
  /* D85: a phone sign-up carries no metadata, so the invite the /join link
     kept in this browser is claimed now (a new account only). */
  await claimInviteFromCookie();

  const next = formData.get("next");
  const landing = (typeof next === "string" && safeReturnPath(next, "")) || "/home";
  /* SPEED: answered at once to a script submit, as the email code is. */
  if ((await headers()).has("next-action")) return { step: "code", target: phone, shown: formatPhone(phone), next: landing };
  revalidatePath("/", "layout");
  redirect(landing);
}
