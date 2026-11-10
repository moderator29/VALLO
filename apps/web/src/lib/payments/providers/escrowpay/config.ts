import "server-only";

/**
 * THE PROTECTED PAYMENT PROVIDER'S CONFIGURATION (BUILD section 5, phase 2).
 *
 * Read from the environment, never from the database and never from code:
 *   ESCROWPAY_API_BASE_URL    the API host. TODO(provider-docs): the sandbox
 *                             and production URLs are not documented to us yet,
 *                             so there is deliberately no default. Unset means
 *                             not configured.
 *   ESCROWPAY_API_KEY         the API key.
 *   ESCROWPAY_WEBHOOK_SECRET  the webhook signing secret. TODO(provider-docs):
 *                             whether it is distinct from the API key.
 *   ESCROWPAY_ENVIRONMENT     "sandbox" or "production".
 *
 * The rule: production credentials are used
 * only when the deployment itself is production (`VERCEL_ENV` production or
 * unset, as on a local machine). A preview or development deployment with a
 * production environment marker is refused outright, never downgraded.
 */
export type EscrowPayEnvironment = "sandbox" | "production";

export type EscrowPayConfig = {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string | null;
  environment: EscrowPayEnvironment;
};

export function escrowPayConfig(env: Readonly<Record<string, string | undefined>>): EscrowPayConfig | null {
  const baseUrl = (env.ESCROWPAY_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (env.ESCROWPAY_API_KEY ?? "").trim();
  const marker = (env.ESCROWPAY_ENVIRONMENT ?? "").trim().toLowerCase();
  const vercelEnv = (env.VERCEL_ENV ?? "").trim();
  if (!baseUrl || !apiKey) return null;
  /* Money only ever travels over TLS, to a host with no credentials in it. */
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (marker !== "sandbox" && marker !== "production") return null;
  const productionDeployment = vercelEnv === "" || vercelEnv === "production";
  if (marker === "production" && !productionDeployment) return null;
  const secret = (env.ESCROWPAY_WEBHOOK_SECRET ?? "").trim();
  return { baseUrl, apiKey, webhookSecret: secret || null, environment: marker };
}
