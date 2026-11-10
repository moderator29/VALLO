import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ProposalAction } from "./tools/types";

/**
 * SIGNED, SHORT-LIVED, SINGLE-USE PROPOSALS.
 *
 * A propose tool never writes. It mints a token: the proposal's action and
 * arguments, the person it was made for, a random nonce and an expiry, signed
 * with a key derived from the server's own secret. The browser holds the
 * token only to hand it back to `/api/admin/copilot/act`; it cannot change
 * what is inside without breaking the signature, and another staff member
 * cannot use it because the user id is inside the signed body.
 *
 * Single use is the act route's job (it records the nonce); this file proves
 * who, what and until when.
 */

export const PROPOSAL_LIFETIME_MS = 15 * 60 * 1000;

export type ProposalBody = {
  v: 1;
  /** The nonce: also the proposal's id. */
  n: string;
  /** The staff member the proposal was made for. */
  u: string;
  /** The propose tool that made it. */
  t: string;
  a: ProposalAction;
  label: string;
  summary: string;
  /** Epoch milliseconds. */
  exp: number;
};

export function proposalKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (secret.length < 16) return null;
  return createHmac("sha256", secret).update("vallo.admin.copilot.proposal.v1").digest();
}

const sign = (key: Buffer, body: string) => createHmac("sha256", key).update(body).digest("base64url");

export function sealProposal(key: Buffer, input: Omit<ProposalBody, "v" | "n" | "exp">, nowMs: number, nonce: string = randomUUID()): { token: string; body: ProposalBody } {
  const body: ProposalBody = { v: 1, n: nonce, exp: nowMs + PROPOSAL_LIFETIME_MS, ...input };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return { token: `${encoded}.${sign(key, encoded)}`, body };
}

export type OpenResult =
  | { ok: true; body: ProposalBody }
  | { ok: false; reason: "invalid" | "expired" | "wrong_user" };

export function openProposal(key: Buffer, token: unknown, userId: string, nowMs: number): OpenResult {
  if (typeof token !== "string" || token.length > 12_000) return { ok: false, reason: "invalid" };
  const [encoded, mac, ...rest] = token.split(".");
  if (!encoded || !mac || rest.length > 0) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(key, encoded));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  let body: ProposalBody;
  try {
    body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProposalBody;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!body || body.v !== 1 || typeof body.n !== "string" || typeof body.u !== "string" || typeof body.exp !== "number") return { ok: false, reason: "invalid" };
  if (body.u !== userId) return { ok: false, reason: "wrong_user" };
  if (nowMs > body.exp) return { ok: false, reason: "expired" };
  return { ok: true, body };
}
