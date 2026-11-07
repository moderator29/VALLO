/**
 * THE PHONE'S SIDE OF THE LOCK ON MONEY. V-81.
 *
 * Thin wrappers over `navigator.credentials`, asking only for the platform
 * authenticator (Face ID, a fingerprint, or the device PIN behind them) with
 * user verification required. Everything comes back as base64url strings for
 * the server actions in `money-step-up-actions.ts`, which do the checking.
 * Nothing here decides anything: a failure is null, and the caller offers the
 * password instead.
 */

export function toB64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = "";
  for (const byte of view) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const text = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
  return out;
}

/** True when this browser can ask the phone's own lock. */
export async function platformLockAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export type EnrolResult = { credentialId: string; clientDataJSON: string; publicKey: string; alg: number };

export async function createPlatformKey(input: {
  challenge: string;
  userId: string;
  email: string;
  rpId: string;
  rpName: string;
  exclude: string[];
}): Promise<EnrolResult | null> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: fromB64url(input.challenge),
        rp: { id: input.rpId, name: input.rpName },
        user: { id: new TextEncoder().encode(input.userId), name: input.email, displayName: input.email },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        attestation: "none",
        timeout: 60_000,
        excludeCredentials: input.exclude.map((id) => ({ type: "public-key" as const, id: fromB64url(id) })),
      },
    })) as PublicKeyCredential | null;
    if (!credential) return null;
    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey?.();
    const alg = response.getPublicKeyAlgorithm?.();
    if (!publicKey || typeof alg !== "number") return null;
    return {
      credentialId: toB64url(credential.rawId),
      clientDataJSON: toB64url(response.clientDataJSON),
      publicKey: toB64url(publicKey),
      alg,
    };
  } catch {
    return null;
  }
}

export type AssertResult = { credentialId: string; clientDataJSON: string; authenticatorData: string; signature: string };

export async function assertPlatformKey(input: {
  challenge: string;
  rpId: string;
  allow: string[];
  /** The longest to wait for the phone (the Face ID bug: a ceremony WebKit
      never started left a tap with no answer for the full minute). */
  waitMs?: number;
}): Promise<AssertResult | null> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer = controller && input.waitMs ? setTimeout(() => controller.abort(), input.waitMs) : null;
  try {
    const credential = (await navigator.credentials.get({
      ...(controller ? { signal: controller.signal } : {}),
      publicKey: {
        challenge: fromB64url(input.challenge),
        rpId: input.rpId,
        allowCredentials: input.allow.map((id) => ({ type: "public-key" as const, id: fromB64url(id) })),
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!credential) return null;
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      credentialId: toB64url(credential.rawId),
      clientDataJSON: toB64url(response.clientDataJSON),
      authenticatorData: toB64url(response.authenticatorData),
      signature: toB64url(response.signature),
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
