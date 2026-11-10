import "server-only";
import { randomBytes } from "node:crypto";
import { escrowPayConfig } from "@/lib/payments/providers/escrowpay/config";
import { getCallProvider, callProviderConfigured } from "@/lib/calls/provider";
import { apnsProviderToken } from "@/lib/push/transport/apns";
import { TERMII_DEFAULT_BASE } from "@/lib/phone-otp/termii";
import { readSenderIdPage, senderIdVerdict, type SenderIdRow } from "./termii-sender-ids";
import { OPENFREEMAP_ORIGIN } from "@/lib/maps/tiles";

/**
 * PROVIDER CHECKS (the founder, 8 October 2026: "trigger deployment and test
 * the providers"). The sandbox that builds Vallo cannot reach
 * LiveKit Cloud or Termii, so the checks run here, on the live
 * server, behind the operations scope.
 *
 * EVERY CHECK IS READ-ONLY OR SELF-CLEANING. No money moves, no message is
 * sent, no member sees anything:
 *   - Protected-pay provider: whether its settings are present for this
 *     deployment (no network: its API is not documented to us yet).
 *   - LiveKit: create an empty throwaway room, read its participants, delete
 *     it. Proves the URL, the key and the secret against the real server.
 *   - Apple push: sign the provider token with the .p8 (no network).
 *   - Termii: GET /api/get-balance (reads the account, sends nothing), and
 *     GET /api/sender-id (the sender IDs on the account, with their status).
 *   - OpenFreeMap: fetch the map style (no key).
 * No key, secret or token is ever returned: only names, outcomes and codes.
 */

export type CheckOutcome = {
  name: string;
  ok: boolean;
  detail: string;
  /** The Termii sender IDs on the account, when this check lists them. */
  senders?: SenderIdRow[];
};

const TIMEOUT = 15_000;

function protectedPayCheck(): CheckOutcome {
  const name = "Protected-pay provider (settings only)";
  return escrowPayConfig(process.env)
    ? { name, ok: true, detail: "Settings are present. Nothing is sent to the provider until its documentation is confirmed and the switch is on." }
    : { name, ok: false, detail: "Settings not set for this deployment. This is expected while the protected rail is switched off." };
}

async function liveKitCheck(): Promise<CheckOutcome> {
  const name = "LiveKit (calls)";
  if (!callProviderConfigured()) return { name, ok: false, detail: "LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set." };
  const provider = getCallProvider();
  if (!provider) return { name, ok: false, detail: "Settings set but unreadable (check LIVEKIT_URL starts with wss://)." };
  const room = `vc_${randomBytes(16).toString("hex")}`;
  try {
    await provider.prepareRoom(room, { maxParticipants: 2, emptyTimeoutSeconds: 10 });
    const people = await provider.listParticipants(room);
    await provider.endRoom(room);
    return { name, ok: true, detail: `Created, read (${people.length} inside) and closed a throwaway room on the real server.` };
  } catch (error) {
    try {
      await provider.endRoom(room);
    } catch {
      /* best effort */
    }
    const message = error instanceof Error ? error.message.slice(0, 160) : "unknown error";
    return { name, ok: false, detail: `The server refused: ${message}` };
  }
}

function apnsCheck(): CheckOutcome {
  const name = "Apple push (APNs key)";
  const token = apnsProviderToken();
  if (!token.ok) return { name, ok: false, detail: token.error };
  return {
    name,
    ok: true,
    detail: `The .p8 key signs a provider token. Gateway: ${process.env.APNS_PRODUCTION === "true" ? "production" : "sandbox"}. A real push needs a device to register.`,
  };
}

async function termiiCheck(): Promise<CheckOutcome> {
  const name = "Termii (SMS codes)";
  const key = (process.env.TERMII_API_KEY ?? "").trim();
  if (!key) return { name, ok: false, detail: "TERMII_API_KEY not set." };
  const sender = (process.env.TERMII_SENDER_ID ?? "").trim();
  try {
    const res = await fetch(`${TERMII_DEFAULT_BASE}/api/get-balance?api_key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status !== 200) return { name, ok: false, detail: `Termii answered HTTP ${res.status}.` };
    return {
      name,
      ok: Boolean(sender),
      detail: sender ? "Key accepted and balance read. Sender ID set." : "Key accepted and balance read, but TERMII_SENDER_ID is not set yet.",
    };
  } catch {
    return { name, ok: false, detail: "No answer from Termii (network or timeout)." };
  }
}

/** The most pages of sender IDs read: fifteen a page, so this is far past any real account. */
const SENDER_PAGES_MAX = 5;

/**
 * THE SENDER IDS ON THE TERMII ACCOUNT, with their status, and whether the one
 * in TERMII_SENDER_ID is an approved one (the founder, 13 October 2026).
 * Read-only: `GET /api/sender-id`, the same key the balance check uses. The
 * key is in the request's query, as Termii requires, and is never returned,
 * printed or put in an error: every failure below is worded without the URL.
 */
export async function termiiSenderIdsCheck(
  env: Record<string, string | undefined> = process.env,
  fetcher: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
): Promise<CheckOutcome> {
  const name = "Termii sender IDs";
  const key = (env.TERMII_API_KEY ?? "").trim();
  if (!key) return { name, ok: false, detail: "TERMII_API_KEY not set, so the account's sender IDs cannot be read." };
  const configured = (env.TERMII_SENDER_ID ?? "").trim();
  const rows: SenderIdRow[] = [];
  try {
    for (let page = 1; page <= SENDER_PAGES_MAX; page += 1) {
      const res = await fetcher(`${TERMII_DEFAULT_BASE}/api/sender-id?api_key=${encodeURIComponent(key)}&page=${page}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.status !== 200) return { name, ok: false, detail: `Termii answered HTTP ${res.status} when asked for the sender IDs.` };
      const read = readSenderIdPage(await res.json().catch(() => null));
      rows.push(...read.rows);
      if (page >= read.pages || read.rows.length === 0) break;
    }
  } catch {
    return { name, ok: false, detail: "No answer from Termii (network or timeout) when asked for the sender IDs." };
  }
  if (rows.length === 0) {
    return {
      name,
      ok: false,
      detail: configured
        ? `The account lists no sender IDs at all. TERMII_SENDER_ID is ${configured}; add it in the Termii dashboard under Sender ID.`
        : "The account lists no sender IDs, and TERMII_SENDER_ID is not set. Add one in the Termii dashboard under Sender ID.",
      senders: [],
    };
  }
  const verdict = senderIdVerdict(configured, rows);
  return { name, ok: verdict.ok, detail: verdict.line, senders: rows };
}

/* The map tiles need no key (OpenFreeMap, 10 November 2026), so the check is
   only whether the style the maps open answers. */
async function mapTilesCheck(): Promise<CheckOutcome> {
  const name = "OpenFreeMap (maps)";
  try {
    const res = await fetch(`${OPENFREEMAP_ORIGIN}/styles/positron`, { signal: AbortSignal.timeout(TIMEOUT) });
    return res.status === 200
      ? { name, ok: true, detail: "The map style answered. No key is needed." }
      : { name, ok: false, detail: `OpenFreeMap answered HTTP ${res.status}. The maps fall back to the pin card until it answers.` };
  } catch {
    return { name, ok: false, detail: "No answer from OpenFreeMap (network or timeout)." };
  }
}

export async function runProviderChecks(): Promise<CheckOutcome[]> {
  return Promise.all([
    Promise.resolve(protectedPayCheck()),
    liveKitCheck(),
    Promise.resolve(apnsCheck()),
    termiiCheck(),
    termiiSenderIdsCheck(),
    mapTilesCheck(),
  ]);
}
