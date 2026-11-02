/**
 * DOJAH, THE IDENTITY PROVIDER (2 November 2026; docs/identity/DOJAH.md,
 * the vendor's pages saved in docs/identity/dojah-source).
 *
 * Off until configured, like every other vendor here. Two environments, and
 * the only thing that changes between them is the host and the keys:
 *
 *   sandbox  https://sandbox.dojah.io  mock answers, never billed
 *   live     https://api.dojah.io      real NIMC / NIBSS / CAC answers, billed
 *            from the prepaid Dojah wallet (402 when it runs dry)
 *
 * Environment variables (server only; none is ever sent to a browser):
 *
 *   DOJAH_ENV             "live" or "sandbox" (default sandbox)
 *   DOJAH_APP_ID          the App ID (Developers -> Configuration)
 *   DOJAH_SECRET_KEY      the secret key, sent raw in Authorization (no Bearer)
 *   DOJAH_WIDGET_ID       the published EasyOnboard flow for a person
 *   DOJAH_WEBHOOK_SECRET  the Secret column on Developers -> Webhooks for the
 *                         kyc_widget subscription. NOT the API secret key.
 *
 * The widget id is not secret (it is in the hosted link), but it is read on
 * the server so the link is built in one place.
 */

export type DojahEnvironment = "sandbox" | "live";

export type DojahConfig = {
  environment: DojahEnvironment;
  baseUrl: string;
  appId: string;
  secretKey: string;
  /** Null when no person flow is published yet: the widget step stays closed. */
  widgetId: string | null;
  /** Null when no webhook is subscribed yet: deliveries are refused. */
  webhookSecret: string | null;
};

export const DOJAH_HOSTS: Record<DojahEnvironment, string> = {
  sandbox: "https://sandbox.dojah.io",
  live: "https://api.dojah.io",
};

/** Where the hosted EasyOnboard flow runs (the iframe origin). */
export const DOJAH_IDENTITY_ORIGIN = "https://identity.dojah.io";

/** Dojah's only sending address for webhooks (webhooks-signatures). */
export const DOJAH_WEBHOOK_IP = "135.119.89.106";

type Env = Record<string, string | undefined>;

export function dojahConfig(env: Env = process.env): DojahConfig | null {
  const appId = (env.DOJAH_APP_ID ?? "").trim();
  const secretKey = (env.DOJAH_SECRET_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!appId || !secretKey) return null;
  const environment: DojahEnvironment = (env.DOJAH_ENV ?? "").trim().toLowerCase() === "live" ? "live" : "sandbox";
  const widgetId = (env.DOJAH_WIDGET_ID ?? "").trim() || null;
  const webhookSecret = (env.DOJAH_WEBHOOK_SECRET ?? "").trim() || null;
  return { environment, baseUrl: DOJAH_HOSTS[environment], appId, secretKey, widgetId, webhookSecret };
}
