import { generateCode, isIssueOutcome, otpMessage, type IssueOutcome } from "./core";
import type { OtpTransport } from "./transport";

/**
 * SENDING A CODE (V-50), with every effect injected so the flow is proven with
 * the capturing transport. The production wiring is `actions.ts`.
 *
 * ORDER MATTERS. The hash is stored BEFORE the code is sent, so a code that
 * arrives can always be confirmed; and the code itself never leaves this
 * function except into the transport. It is not returned, not logged, not
 * stored.
 */

export type SendDeps = {
  randomInt(maxExclusive: number): number;
  /** `public.phone_otp_issue`, as the service role. */
  issue(userId: string, phone: string, code: string): Promise<unknown>;
  transport: OtpTransport;
  /** The per-person and per-number allowance. False means refused or unknown. */
  allow(userId: string, phone: string): Promise<boolean>;
};

/**
 * NO ENUMERATION (founder's ruling, 13 October 2026). A number on another
 * account and a number the database will not take are ONE answer for the
 * member, `refused`, in the same shape and after the same work (one
 * allowance, one database call, nothing sent), so neither the words nor the
 * shape says which. `staffReason` keeps the database's own word for the audit
 * trail (`phone.number_refused`) and is never shown to the member.
 */
export type SendOutcome =
  | { ok: true }
  | { ok: false; reason: "refused"; staffReason: "taken" | "invalid" }
  | { ok: false; reason: "limited" | "already" | "fixed" | "unconfigured" | "failed" };

export async function runSendCode(deps: SendDeps, userId: string, phoneE164: string): Promise<SendOutcome> {
  if (!(await deps.allow(userId, phoneE164))) return { ok: false, reason: "limited" };
  const code = generateCode(deps.randomInt);
  let issued: IssueOutcome;
  try {
    const answer = await deps.issue(userId, phoneE164, code);
    issued = isIssueOutcome(answer) ? answer : "invalid";
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (issued === "already") return { ok: false, reason: "already" };
  if (issued === "fixed") return { ok: false, reason: "fixed" };
  if (issued === "taken" || issued === "invalid") return { ok: false, reason: "refused", staffReason: issued };
  const sent = await deps.transport.send(phoneE164, otpMessage(code));
  return sent.ok ? { ok: true } : { ok: false, reason: sent.reason };
}
