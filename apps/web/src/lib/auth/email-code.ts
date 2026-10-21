"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClientWithAgent } from "@/lib/security/agent-client";
import { consume, ipFromHeaders, subjectForEmail, subjectForIp } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/return-path";
import { rememberFirstCodeSignIn } from "./first-sign-in-server";
import type { CodeSignInState } from "./code-sign-in-state";
import { CONFIRMATION_CODE_RE } from "./confirmation-code";

/**
 * A3. SIGN IN WITH A CODE BY EMAIL, NO PASSWORD.
 *
 * `signInWithOtp` for an EXISTING account only (`shouldCreateUser: false`),
 * so this door never makes an account behind the sign-up form's terms and
 * 18+ receipts. GoTrue mints the six digits; the mail goes out exactly as
 * every other auth mail does today: through the Send Email hook
 * (`app/api/auth/email-hook`, Resend, hello@vallospaces.com), which already
 * renders the `magiclink` type as the code email. Nothing about email
 * delivery, the templates or SMTP changes, and nothing here touches SMS.
 *
 * NO ENUMERATION. An address with no account gets the same "a code is on
 * its way" step as one with an account; only a person holding the inbox can
 * tell the difference.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskAddress(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 1 ? email : `${email[0]}•••${email.slice(at)}`;
}

export async function sendEmailSignInCode(_prev: CodeSignInState, formData: FormData): Promise<CodeSignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL.test(email)) return { step: "ask", error: "badTarget" };

  const ip = subjectForIp(ipFromHeaders(await headers()));
  const [byIp, byAddress] = await Promise.all([
    consume({ bucket: "email_code_send", subject: ip, limit: 10, windowSeconds: 600 }),
    consume({ bucket: "email_code_send_address", subject: subjectForEmail(email), limit: 5, windowSeconds: 3_600 }),
  ]);
  if (!byIp.allowed || !byAddress.allowed) return { step: "ask", target: email, error: "limited" };

  try {
    const supabase = await createClientWithAgent();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    /* An unknown address is answered like a known one. A rate refusal from
       GoTrue itself is said as such; any other failure is ours. */
    if (error && /rate|too many/i.test(error.message)) return { step: "ask", target: email, error: "limited" };
    if (error && !/signups? not allowed|not found|user/i.test(error.message)) return { step: "ask", target: email, error: "failed" };
  } catch {
    return { step: "ask", target: email, error: "failed" };
  }
  return { step: "code", target: email, shown: maskAddress(email) };
}

export async function verifyEmailSignInCode(_prev: CodeSignInState, formData: FormData): Promise<CodeSignInState> {
  const email = String(formData.get("target") ?? "").trim().toLowerCase().slice(0, 254);
  const token = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!EMAIL.test(email)) return { step: "ask", error: "badTarget" };
  /* GoTrue's one email code length, the same as the sign-up code's. */
  if (!CONFIRMATION_CODE_RE.test(token)) return { step: "code", target: email, shown: maskAddress(email), error: "badCode" };

  const verdict = await consume({
    bucket: "email_code_verify",
    subject: subjectForEmail(email),
    limit: 10,
    windowSeconds: 600,
  });
  if (!verdict.allowed) return { step: "code", target: email, shown: maskAddress(email), error: "limited" };

  const supabase = await createClientWithAgent();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", target: email, shown: maskAddress(email), error: "wrongCode" };
  /* A first sign-in (this code confirmed the address) earns "Welcome to
     Vallo" on the next screen, by the one-shot cookie. */
  await rememberFirstCodeSignIn(supabase, data?.user, "email");

  /* The address the chooser remembered is spent, as after a password sign-in. */
  (await cookies()).delete("nf_chooser_email");
  revalidatePath("/", "layout");
  const next = formData.get("next");
  redirect((typeof next === "string" && safeReturnPath(next, "")) || "/home");
}
