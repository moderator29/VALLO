import type { OtpTransport, SendResult } from "./transport";

/**
 * TWILIO, THE CODE TRANSPORT FOR EVERY NUMBER OUTSIDE NIGERIA (2 November
 * 2026). Off until configured. Nigerian numbers stay on Termii (`termii.ts`).
 *
 * It is only the DELIVERY. The code is made and checked by Vallo itself (the
 * hash is stored by `phone_otp_issue`, confirmed by `confirm_phone`), so this
 * uses Twilio's ordinary Messages API and none of Twilio Verify, which would
 * add a per-verification fee on top of the message cost.
 *
 * Two channels, the second only when the first is refused:
 *
 *   whatsapp   when `TWILIO_WHATSAPP_FROM` and `TWILIO_WHATSAPP_CONTENT_SID`
 *              are both set: an approved WhatsApp authentication template,
 *              sent through Twilio's Content API with the code as variable 1;
 *   sms        from `TWILIO_MESSAGING_SERVICE_SID` (preferred) or
 *              `TWILIO_FROM_NUMBER`.
 *
 * It never logs the number, the message or the credentials.
 */
export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** A Messaging Service (preferred) or a sender number, one of the two. */
  messagingServiceSid: string | null;
  fromNumber: string | null;
  whatsappFrom: string | null;
  whatsappContentSid: string | null;
  baseUrl: string;
};

export const TWILIO_DEFAULT_BASE = "https://api.twilio.com";

export function twilioConfig(env: Record<string, string | undefined> = process.env): TwilioConfig | null {
  const accountSid = (env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = (env.TWILIO_AUTH_TOKEN ?? "").trim();
  const messagingServiceSid = (env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim() || null;
  const fromNumber = (env.TWILIO_FROM_NUMBER ?? "").trim() || null;
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !authToken) return null;
  if (!messagingServiceSid && !fromNumber) return null;
  const whatsappFrom = (env.TWILIO_WHATSAPP_FROM ?? "").trim() || null;
  const whatsappContentSid = (env.TWILIO_WHATSAPP_CONTENT_SID ?? "").trim() || null;
  return {
    accountSid,
    authToken,
    messagingServiceSid,
    fromNumber,
    whatsappFrom,
    whatsappContentSid,
    baseUrl: TWILIO_DEFAULT_BASE,
  };
}

export type TwilioChannel = "whatsapp" | "sms";

export function twilioChannels(config: TwilioConfig): TwilioChannel[] {
  return config.whatsappFrom && config.whatsappContentSid ? ["whatsapp", "sms"] : ["sms"];
}

export type TwilioFetch = (url: string, init: RequestInit) => Promise<Response>;
export type TwilioAttempt = { ok: true; messageSid: string | null } | { ok: false; reason: "refused" | "network" };

/** The six digits in a message built by `otpMessage`, for the WhatsApp template variable. */
export function codeIn(message: string): string | null {
  return /\b(\d{6})\b/.exec(message)?.[1] ?? null;
}

export function twilioBody(config: TwilioConfig, to: string, message: string, channel: TwilioChannel): URLSearchParams | null {
  const body = new URLSearchParams();
  if (channel === "whatsapp") {
    const code = codeIn(message);
    if (!code || !config.whatsappFrom || !config.whatsappContentSid) return null;
    body.set("To", `whatsapp:${to}`);
    body.set("From", config.whatsappFrom.startsWith("whatsapp:") ? config.whatsappFrom : `whatsapp:${config.whatsappFrom}`);
    body.set("ContentSid", config.whatsappContentSid);
    body.set("ContentVariables", JSON.stringify({ "1": code }));
    return body;
  }
  body.set("To", to);
  body.set("Body", message);
  if (config.messagingServiceSid) body.set("MessagingServiceSid", config.messagingServiceSid);
  else if (config.fromNumber) body.set("From", config.fromNumber);
  else return null;
  return body;
}

/** One attempt on one channel. `refused` is Twilio answering no; `network` is no answer. */
export async function twilioPost(
  config: TwilioConfig,
  to: string,
  message: string,
  channel: TwilioChannel,
  fetcher: TwilioFetch = fetch,
): Promise<TwilioAttempt> {
  const body = twilioBody(config, to, message, channel);
  if (!body) return { ok: false, reason: "refused" };
  try {
    const response = await fetcher(`${config.baseUrl}/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, reason: "refused" };
    const answer = (await response.json().catch(() => null)) as { sid?: string; error_code?: number | null } | null;
    if (answer && typeof answer.sid === "string" && !answer.error_code) return { ok: true, messageSid: answer.sid };
    return { ok: false, reason: "refused" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export function twilioTransport(config: TwilioConfig, fetcher: TwilioFetch = fetch): OtpTransport {
  return {
    name: "twilio",
    async send(phoneE164: string, message: string): Promise<SendResult> {
      if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) return { ok: false, reason: "failed" };
      for (const channel of twilioChannels(config)) {
        if ((await twilioPost(config, phoneE164, message, channel, fetcher)).ok) return { ok: true };
      }
      return { ok: false, reason: "failed" };
    },
  };
}
