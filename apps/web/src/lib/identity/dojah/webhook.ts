import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * IS THIS DELIVERY FROM DOJAH? (webhooks-signatures)
 *
 * Every delivery carries `x-dojah-signature`: HMAC-SHA256 of the raw body,
 * hex, keyed with the WEBHOOK secret of that subscription (Developers ->
 * Webhooks, the Secret column), which is not the API secret key. It is
 * computed over the exact bytes received, so the body is read as text and
 * never re-serialised before checking.
 *
 * The second header, `x-dojah-signature-v2`, is a hash of the secret key
 * alone: the same value on every delivery, so it proves nothing about the
 * body and is not used.
 */
export function verifyDojahSignature(rawBody: string, header: string | null, secret: string | null): boolean {
  if (!secret || !header) return false;
  const got = header.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(got)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
}

/**
 * The payload with every government number and file link taken out, for the
 * raw event log. A reviewer reads names and scores from the check row; nobody
 * needs a NIN or a BVN sitting in a log table.
 */
const SECRET_KEYS = new Set(["nin", "bvn", "vnin", "value", "verification_value", "phone_number", "phone_number1", "phone_number2", "telephoneno", "photo", "image", "signature"]);

export function redactDojahPayload(input: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(input)) return input.map((item) => redactDojahPayload(item, depth + 1));
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key.toLowerCase()) && (typeof value === "string" || typeof value === "number")) {
        out[key] = "[redacted]";
      } else if (typeof value === "string" && /^https:\/\/[^ ]*(files|images)\.dojah\.io\//.test(value)) {
        out[key] = "[file]";
      } else {
        out[key] = redactDojahPayload(value, depth + 1);
      }
    }
    return out;
  }
  return input;
}
