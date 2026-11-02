import { termiiConfig, termiiTransport } from "./termii";
import { twilioConfig, twilioTransport } from "./twilio";
/**
 * HOW A CODE REACHES A PHONE (V-50): AN INTERFACE, AND THE FOUNDER'S VENDOR
 * BEHIND IT.
 *
 * The entry prefers a WhatsApp authentication template where the number is on
 * WhatsApp and the transactional SMS route otherwise. Both are a contract the
 * founder signs (founder question 7), so the product is built against this
 * interface and ships with two implementations that are not a vendor:
 *
 *   unconfigured  the production default until a vendor is wired. It sends
 *                 nothing and says so, and the flag stays off, so no screen
 *                 ever asks for a code that cannot arrive.
 *   capturing     for tests: it records what it was asked to send, so the
 *                 whole flow (issue, deliver, confirm) is proven end to end.
 *
 * THE TWO VENDORS. `termii.ts` for Nigeria, `twilio.ts` for everywhere else,
 * chosen by the number in `routedTransport`. To add another, implement
 * `OtpTransport` and route to it from `otpTransport()`.
 *
 * NEVER TO A LOCK SCREEN. A code is not sent as a push notification, because a
 * lock screen is readable by whoever holds the phone. SMS and WhatsApp are the
 * channels the entry names; a push channel must never implement this.
 */

export type SendResult = { ok: true } | { ok: false; reason: "unconfigured" | "failed" };

export interface OtpTransport {
  readonly name: string;
  send(phoneE164: string, message: string): Promise<SendResult>;
}

export const unconfiguredTransport: OtpTransport = {
  name: "unconfigured",
  async send() {
    return { ok: false, reason: "unconfigured" };
  },
};

export type CapturedMessage = { to: string; message: string };

export function capturingTransport(outbox: CapturedMessage[]): OtpTransport {
  return {
    name: "capturing",
    async send(to, message) {
      outbox.push({ to, message });
      return { ok: true };
    },
  };
}

/**
 * ROUTED BY COUNTRY (2 November 2026). A Nigerian number (+234) goes through
 * Termii and every other number through Twilio. Each leg is "unconfigured"
 * until its own keys are set, so turning one on never changes the other, and a
 * number is never sent through the wrong vendor.
 */
export function routedTransport(nigerian: OtpTransport, abroad: OtpTransport): OtpTransport {
  return {
    name: `${nigerian.name}+${abroad.name}`,
    send(phoneE164, message) {
      return (phoneE164.startsWith("+234") ? nigerian : abroad).send(phoneE164, message);
    },
  };
}

/** The transport this deployment uses. */
export function otpTransport(): OtpTransport {
  const termii = termiiConfig();
  const twilio = twilioConfig();
  if (!termii && !twilio) return unconfiguredTransport;
  return routedTransport(
    termii ? termiiTransport(termii) : unconfiguredTransport,
    twilio ? twilioTransport(twilio) : unconfiguredTransport,
  );
}

/**
 * Can a code reach this number from this deployment? Nigerian numbers need
 * Termii's keys and every other number Twilio's. The sign-up phone step asks
 * this first, so it never asks for a code that cannot arrive.
 */
export function canSendTo(phoneE164: string): boolean {
  return phoneE164.startsWith("+234") ? termiiConfig() !== null : twilioConfig() !== null;
}
