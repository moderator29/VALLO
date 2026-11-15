import "server-only";

/**
 * THE PROTECTED PAYMENT PROVIDER'S CONFIGURATION (BUILD section 5, phase 2).
 *
 * Read from the environment, never from the database and never from code:
 *   ESCROWPAY_API_BASE_URL    the Merchant API host. The provider has ONE host
 *                             for both books (docs.escrowpay.app, "Getting
 *                             started": sandbox is a test key on the
 *                             production host, not a second hostname). There
 *                             is still no default: unset means not configured.
 *   ESCROWPAY_API_KEY         the secret key, sent as `X-API-Key`. Its prefix
 *                             names its book. The dashboard issues
 *                             `sk_test_...` and `sk_live_...` (seen on the
 *                             sandbox, 14 November 2026); the provider's
 *                             guide writes them `ep_test_sk_...` and
 *                             `ep_live_sk_...`, so both spellings are read.
 *   ESCROWPAY_WEBHOOK_SECRET  the endpoint signing secret (`whsec_...`), shown
 *                             once when the endpoint is created in the
 *                             provider's dashboard. Distinct from the API key.
 *   ESCROWPAY_WEBHOOK_SECRET_PREVIOUS
 *                             optional, only during a rotation: the provider
 *                             signs with either secret for 24 hours.
 *   ESCROWPAY_ENVIRONMENT     "sandbox" (a test key) or "production" (a live key).
 *
 * HOW A RELEASE REACHES THE LISTER: always straight to their own bank
 * (`payout_preference: "automatic"`, the founder's ruling of 15 November
 * 2026), so Vallo's balance at the provider never carries a member's money.
 * There is no setting for anything else. The provider refuses a transaction
 * asking for it on an account where it is switched off, and then nothing
 * opens: that is the safe failure.
 *
 * The rules:
 *  - the key's book must be the one the marker names. A live key marked
 *    sandbox, or a test key marked production, is not configured at all;
 *  - production credentials are used only when the deployment itself is
 *    production (`VERCEL_ENV` production or unset, as on a local machine). A
 *    preview or development deployment with a production marker is refused
 *    outright, never downgraded;
 *  - a test key on the production deployment may record and read, and may
 *    never START a payment (`startsMoney` false): a member must never be
 *    handed the sandbox's made-up account number as if it were the bank's.
 */
export type EscrowPayEnvironment = "sandbox" | "production";

export type EscrowPayConfig = {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string | null;
  webhookSecretPrevious: string | null;
  environment: EscrowPayEnvironment;
  /**
   * How a release reaches the lister. Always "automatic" from the
   * environment; "manual" exists only for the sandbox test to run on an
   * account where automatic payout is switched off (sandbox.e2e.test.ts).
   */
  payoutPreference: "automatic" | "manual";
  /** Whether this configuration may open, release or refund a member's payment. */
  startsMoney: boolean;
};

const TEST_KEY = /^(sk_test_|ep_test_)/;
const LIVE_KEY = /^(sk_live_|ep_live_)/;

export function escrowPayConfig(env: Readonly<Record<string, string | undefined>>): EscrowPayConfig | null {
  /* The host alone is stored; a pasted "/api/v1" is taken off, since every path carries it. */
  const baseUrl = (env.ESCROWPAY_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "");
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
  if (marker === "sandbox" && !TEST_KEY.test(apiKey)) return null;
  if (marker === "production" && !LIVE_KEY.test(apiKey)) return null;
  const productionDeployment = vercelEnv === "" || vercelEnv === "production";
  if (marker === "production" && !productionDeployment) return null;
  const secret = (env.ESCROWPAY_WEBHOOK_SECRET ?? "").trim();
  const previous = (env.ESCROWPAY_WEBHOOK_SECRET_PREVIOUS ?? "").trim();
  return {
    baseUrl,
    apiKey,
    webhookSecret: secret || null,
    webhookSecretPrevious: previous || null,
    environment: marker,
    payoutPreference: "automatic",
    startsMoney: !(marker === "sandbox" && vercelEnv === "production"),
  };
}
