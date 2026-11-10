import "server-only";

/**
 * THE PROVIDER'S WEBHOOKS, the pure half.
 *
 * TODO(provider-docs): the signature header, the algorithm, what it signs
 * (raw body or not), the envelope, the event names, the event id to
 * de-duplicate on, and the environment marker. None is documented to us, so
 * verification answers false and every delivery is refused until it is. A
 * route built on this refuses before it parses anything.
 *
 * When the documentation arrives, copy the Payluk discipline
 * (`../payluk-webhook.ts`): verify over the raw body in constant time, store
 * the raw event first (`provider_webhook_events`, idempotent on provider and
 * event key), trust the status in the body and never the arrival order, and
 * acknowledge an unknown event name without acting on it.
 */
/**
 * The header the provider signs with. TODO(provider-docs): unknown, so null,
 * and the route therefore reads no header and refuses every delivery.
 */
export const ESCROWPAY_SIGNATURE_HEADER: string | null = null;

export function verifyEscrowPaySignature(rawBody: string, header: string | null, secret: string | null): boolean {
  void rawBody;
  void header;
  void secret;
  return false;
}

export type EscrowPayWebhook = { event: string; key: string; providerReference: string; status: string };

/** Parse a verified body. Null until the envelope is documented. */
export function parseEscrowPayWebhook(body: unknown): EscrowPayWebhook | null {
  void body;
  return null;
}
