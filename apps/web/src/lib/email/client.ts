import "server-only";
import { CONTACT_EMAIL } from "@/lib/support-email";

/**
 * Resend client. Server-only, typed, no SDK.
 *
 * A thin fetch layer over the one endpoint we need, POST
 * https://api.resend.com/emails. Deliberately tiny: transactional mail is a
 * side effect of an action that has already succeeded, so this module never
 * throws and never reports failure by exception. Every call answers with a
 * typed result the caller may ignore.
 *
 * The API key is read lazily, so importing this module is safe on a platform
 * with no email configured at all. With no key present sendEmail returns
 * {sent: false, reason: "unconfigured"} and nothing leaves the process.
 *
 * Logging is deliberately thin: a failure logs the reason and, when there was
 * one, the HTTP status. Never the recipient, never the subject, never the body.
 */

const API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * THE COMPANY ADDRESS, hello@vallospaces.com, is both ends of every platform
 * email (founder, 29 September 2026): the From line and, unless a message
 * names its own, the Reply-To. It is the company's public mailbox, never a
 * person's. EMAIL_FROM and EMAIL_REPLY_TO still override it per environment.
 * Resend refuses a From whose domain is not verified on the account, so
 * `vallospaces.com` must be a verified sending domain there.
 */
export const COMPANY_ADDRESS = CONTACT_EMAIL;

/** The sender used when EMAIL_FROM is not set. */
const DEFAULT_FROM = `Vallo <${COMPANY_ADDRESS}>`;

/** Where a reply lands when EMAIL_REPLY_TO is not set, or not an address. */
const DEFAULT_REPLY_TO = `Vallo <${COMPANY_ADDRESS}>`;

/** Deliberately forgiving: one @, a dot in the domain, no whitespace. */
const ADDRESS_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export type SendFailureReason =
  /** RESEND_API_KEY is absent. Nothing was attempted. */
  | "unconfigured"
  /** The address did not look like an address, so nothing was attempted. */
  | "invalid-recipient"
  /** Resend answered, and said no. */
  | "rejected"
  /** Ten seconds passed with no answer. */
  | "timeout"
  /** DNS, TLS, socket: the service could not be reached at all. */
  | "unreachable";

export type SendEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: SendFailureReason; status?: number };

export type SendEmailMessage = {
  /** A single recipient address. One email, one person. */
  to: string;
  subject: string;
  html: string;
  /**
   * The text/plain alternative.
   *
   * Optional on this type and required on every message the catalogue builds,
   * which is the split that matters: a message always has one, and a call site
   * that has not been moved to `sendMessage` yet still compiles. Sending
   * without it is worse in two ways that are easy to miss until they bite. A
   * multipart message with no text part is a bulk-mail signature to every
   * major spam filter, and a text-only client shows an empty body rather than
   * a degraded one.
   */
  text?: string;
  /** Where a reply should land, when it is not the sending address. */
  replyTo?: string;
  /**
   * Extra message headers, e.g. `List-Unsubscribe` on mail a preference can
   * switch off (OPS-14). Sent as Resend's `headers` object.
   */
  headers?: Record<string, string>;
};

/*
 * OPS-14: A BLIP IS RETRIED, NOT LOST. A 429, a 5xx or a failed connection is
 * tried again twice, after a short wait, with the same Idempotency-Key, so
 * Resend delivers it at most once even if an earlier attempt did reach it. A
 * 4xx other than 429 is Resend saying no, and trying again changes nothing.
 * The waits are short because most sends sit inside a person's request;
 * anything longer than this belongs to the outbox, which retries on a cron.
 */
export const RETRY_DELAYS_MS = [400, 1200] as const;
let sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** For tests: replace the wait between attempts. */
export function setEmailRetrySleep(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

function transient(result: SendEmailResult): boolean {
  if (result.sent) return false;
  if (result.reason === "unreachable" || result.reason === "timeout") return true;
  return result.reason === "rejected" && (result.status === 429 || (result.status ?? 0) >= 500);
}

function apiKey(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

/**
 * True when RESEND_API_KEY is present. Read lazily on every call so a key
 * added to the environment takes effect without a rebuild, and so importing
 * this module can never fail. Callers use this to skip the work of gathering
 * recipients and rendering when no mail can be sent anyway.
 */
export function isEmailConfigured(): boolean {
  return apiKey().length > 0;
}

/** The From address: EMAIL_FROM when set, otherwise the Vallo default. */
export function emailFrom(): string {
  const configured = (process.env.EMAIL_FROM ?? "").trim();
  return configured.length > 0 ? configured : DEFAULT_FROM;
}

/**
 * Where a reply lands when the message did not say.
 *
 * THE DEFECT THIS ENDS. Every message this platform sends goes out From a
 * sender nobody reads. `reply_to` has been on the wire format since the
 * beginning and nothing ever set it, so somebody replying to a booking
 * confirmation, which is the most natural thing in the world to do, was
 * writing into a mailbox with nobody behind it. The reply was not bounced and
 * was not refused. It simply went nowhere, and the person had no way to know.
 *
 * Unset now means the company address, hello@vallospaces.com, because a
 * reply should always reach the company mailbox (founder, 29 September). A
 * configured value that is not an address is refused, logged without the
 * value, and the company address is used instead.
 *
 * NEVER the private founder mailbox. Whatever address is set here is printed
 * in the headers of every message the platform sends and is as public as the
 * From line.
 */
export function emailReplyTo(): string {
  return usableReplyTo(process.env.EMAIL_REPLY_TO ?? "") || DEFAULT_REPLY_TO;
}

/**
 * A reply address we are willing to put on the wire, or an empty string.
 *
 * It accepts both shapes Resend accepts, a bare `hello@vallospaces.com` and a
 * labelled `Vallo <hello@vallospaces.com>`, because rejecting the labelled one
 * would drop a correctly configured address in silence. Silently discarding
 * what somebody configured is the same class of fault as an input that
 * truncates a pasted code: the system keeps working, the intent is gone, and
 * nothing says so. Anything that is not one of those two shapes is refused
 * loudly enough to find in a log and never guessed at.
 */
function usableReplyTo(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  const labelled = /^[^<>]*<([^\s<>@]+@[^\s<>@.]+\.[^\s<>@]+)>$/.exec(trimmed);
  const address = labelled ? labelled[1] : trimmed;
  if (ADDRESS_RE.test(address ?? "")) return trimmed;

  /* The address itself is never logged. It is a company mailbox rather than a
     person's, but an address in a log is an address in a log. */
  console.warn("[email] a reply address was configured but is not a valid address, ignoring it");
  return "";
}

/** Resend's success body is {id}; its error body is {name, message, statusCode}. */
type ResendResponse = {
  id?: unknown;
  name?: unknown;
  message?: unknown;
};

/**
 * Send one email. Never throws, never blocks longer than ten seconds, and
 * returns a typed result rather than reporting failure by exception, because
 * every caller is a best-effort side effect of an action that has already
 * committed to the database.
 */
export async function sendEmail(message: SendEmailMessage): Promise<SendEmailResult> {
  const key = apiKey();
  if (key.length === 0) return { sent: false, reason: "unconfigured" };

  const to = message.to.trim();
  if (!ADDRESS_RE.test(to)) return { sent: false, reason: "invalid-recipient" };

  const idempotencyKey = crypto.randomUUID();
  let result = await attemptSend(key, to, message, idempotencyKey);
  for (const wait of RETRY_DELAYS_MS) {
    if (!transient(result)) break;
    await sleep(wait);
    result = await attemptSend(key, to, message, idempotencyKey);
  }
  return result;
}

async function attemptSend(
  key: string,
  to: string,
  message: SendEmailMessage,
  idempotencyKey: string,
): Promise<SendEmailResult> {
  /* The message wins when it says, the environment answers when it does not,
     and when neither speaks the company address does. */
  const replyTo = usableReplyTo(message.replyTo ?? "") || emailReplyTo();

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      // The REST API speaks snake_case: reply_to, not the SDK's replyTo.
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: message.subject,
        html: message.html,
        ...(typeof message.text === "string" && message.text.length > 0
          ? { text: message.text }
          : {}),
        ...(replyTo.length > 0 ? { reply_to: replyTo } : {}),
        ...(message.headers && Object.keys(message.headers).length > 0 ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const reason: SendFailureReason =
      e instanceof Error && e.name === "TimeoutError" ? "timeout" : "unreachable";
    console.warn(`[email] send did not complete: ${reason}`);
    return { sent: false, reason };
  }

  let body: ResendResponse | null = null;
  try {
    body = (await res.json()) as ResendResponse;
  } catch {
    body = null;
  }

  if (!res.ok) {
    // The error name is Resend's own machine code (validation_error,
    // rate_limit_exceeded and friends). It carries no user data.
    const code = typeof body?.name === "string" ? body.name : "unknown_error";
    console.warn(`[email] send rejected: ${res.status} ${code}`);
    return { sent: false, reason: "rejected", status: res.status };
  }

  return { sent: true, id: typeof body?.id === "string" ? body.id : null };
}

/**
 * Send a catalogue message to one person.
 *
 * The one-liner every send site should use. It exists because the alternative,
 * spreading a message into sendEmail by hand, is how the text alternative gets
 * left off: `{ to, subject: m.subject, html: m.html }` compiles perfectly and
 * silently drops the part that keeps the mail out of spam. Passing the whole
 * message means a field added to the catalogue reaches the wire without every
 * call site being edited again.
 */
export async function sendMessage(
  to: string,
  message: { subject: string; html: string; text: string },
  options?: { replyTo?: string; headers?: Record<string, string> },
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
    ...(options?.headers ? { headers: options.headers } : {}),
  });
}

/**
 * OPS-14 and A12: the List-Unsubscribe headers for mail a /settings switch
 * can turn off.
 *
 * Given a signed token (`lib/email/unsubscribe-token.ts`), it is RFC 8058
 * one-click: `List-Unsubscribe` names the sign-in-free endpoint and
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click` tells Gmail and Yahoo
 * they may POST it. Without a token (no service key to sign with) it falls
 * back to the settings switch, which needs a sign-in, and claims no
 * one-click it cannot honour. Security mail has no channel and never reaches
 * this function.
 */
export function listUnsubscribeHeaders(origin: string, channel: string, token?: string | null): Record<string, string> {
  const base = origin.replace(/\/+$/, "");
  if (token) {
    return {
      "List-Unsubscribe": `<${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  return { "List-Unsubscribe": `<${base}/settings/notifications?channel=${encodeURIComponent(channel)}>` };
}

/**
 * Run an email side effect that must never affect its caller.
 *
 * The two guarantees every send site in this codebase relies on, in one place:
 * nothing is attempted when there is no API key, and no failure inside the
 * work, including rendering and recipient lookups, can propagate. A booking
 * that saved is a booking that succeeded, whatever happens to its email.
 */
export async function bestEffortEmail(work: () => Promise<unknown>): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    await work();
  } catch {
    // Swallowed by design. A failed email never fails a user's action.
  }
}
