import "server-only";

import {
  createECDH,
  createHmac,
  createCipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as signWithKey,
} from "node:crypto";

import {
  VAPID_PRIVATE_KEY_VAR,
  VAPID_PUBLIC_KEY_VAR,
  vapidSubject,
  webPushStatus,
} from "../credentials";
import { isAllowedWebPushEndpoint } from "../endpoint";
import { replyFromStatus, type ProviderReply, type PushPayload, type PushTarget } from "../types";

/**
 * WEB PUSH, RFC 8291 AND RFC 8188, WRITTEN OUT RATHER THAN INSTALLED.
 *
 * ===========================================================================
 * WHY THIS IS THE TRANSPORT THAT MATTERS TO THIS BUILD.
 *
 * Of the three push transports, this is the only one whose credential needs
 * NOBODY. A VAPID key pair is self generated in a second, like an SSH key: no
 * account, no console, no company, no money. FCM needs a Firebase project the
 * owner must create and APNs needs a 99 USD Apple membership the owner does
 * not yet hold. So this is the path that can go all the way to a real handset
 * without waiting for anybody, and it is therefore the path the whole
 * delivery mechanism is proved on.
 *
 * It is also not a consolation prize. On the Android handsets this product is
 * built for, an installed web app gets push through exactly this route, and
 * iOS 16.4 and later grants web push to a site added to the home screen. It
 * is a real channel that reaches real phones.
 *
 * ===========================================================================
 * WHY THE CRYPTO IS HERE AND NOT `npm install web-push`.
 *
 * Adding a dependency to this repository is a thing to be announced, not done
 * quietly, and it buys three primitives Node already ships: ECDH on P-256,
 * HKDF through HMAC, and AES-128-GCM. What follows is the specification
 * written out with the reason for each step beside it. It is about ninety
 * lines and every one of them is testable, which a dependency's internals are
 * not.
 *
 * THE HONEST RISK, NAMED. Hand-written crypto fails silently: a wrong byte
 * produces a body that is perfectly well formed and that no handset can
 * decrypt, and the push service still answers 201 because the service cannot
 * read it either. A 201 therefore PROVES THE TRANSPORT AND NOT THE
 * ENCRYPTION. The only thing that proves the encryption is a notification
 * appearing on a screen. `webpush.test.ts` closes as much of that gap as can
 * be closed without a handset: it runs the receiver's half of RFC 8291
 * independently and decrypts what this file encrypts, which exercises the
 * whole ECDH, HKDF and AES chain in both directions.
 *
 * ===========================================================================
 * THE SHAPE OF A WEB PUSH REQUEST, WHICH IS TWO UNRELATED THINGS AT ONCE.
 *
 * 1. WHO IS SENDING. A VAPID JWT in the Authorization header, signed with our
 *    private key, telling the push service which application is asking. This
 *    is the part that stops anybody who scrapes an endpoint URL out of a
 *    database from pushing to it.
 *
 * 2. WHAT IS BEING SENT. A body encrypted to the SUBSCRIPTION's public key,
 *    which only that browser holds the private half of. THE PUSH SERVICE
 *    CANNOT READ IT, and that is the point of the design: Google or Mozilla
 *    carry the message without being able to see it.
 *
 * The two use different keys for different purposes and confusing them is the
 * classic defect here. The VAPID pair is OURS and is the same for every
 * subscriber. The p256dh and auth pair is THEIRS and is different for every
 * subscription.
 */

/** One record, so the record size only has to exceed the payload. */
const RECORD_SIZE = 4096;
/** How long a push service should hold this if the device is offline. */
const DEFAULT_TTL_SECONDS = 4 * 60 * 60;
/** VAPID tokens must not be long lived. Twelve hours is comfortably inside
    the specification's twenty-four hour ceiling. */
const VAPID_TTL_SECONDS = 12 * 60 * 60;

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HKDF expand, one block, which is all any step here needs. */
function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const hmac = createHmac("sha256", prk);
  hmac.update(info);
  hmac.update(Buffer.from([1]));
  return hmac.digest().subarray(0, length);
}

function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return createHmac("sha256", salt).update(ikm).digest();
}

/** `label || 0x00`, the info form RFC 8188 uses for the key and the nonce. */
function contentEncodingInfo(label: string): Buffer {
  return Buffer.concat([Buffer.from(`Content-Encoding: ${label}`, "ascii"), Buffer.from([0])]);
}

export type EncryptedPush = {
  body: Buffer;
  /** The ephemeral public key, exposed so a test can play the receiver. */
  serverPublicKey: Buffer;
  salt: Buffer;
};

/**
 * Encrypt a payload to one subscription, RFC 8291 with the aes128gcm content
 * encoding of RFC 8188.
 *
 * Every step below is the specification. The comments say what each one is
 * for, because the sequence is otherwise nine lines of opaque buffer
 * shuffling in which a single transposition is undetectable.
 */
export function encryptForSubscription(input: {
  payload: Buffer;
  /** The subscription's public key, 65 bytes uncompressed, base64url. */
  p256dh: string;
  /** The subscription's auth secret, 16 bytes, base64url. */
  auth: string;
  /** Injectable so a test is deterministic. Real sends leave it alone. */
  salt?: Buffer;
  serverKeys?: { privateKey: Buffer; publicKey: Buffer };
}): EncryptedPush {
  const userPublicKey = base64UrlDecode(input.p256dh);
  const authSecret = base64UrlDecode(input.auth);

  if (userPublicKey.length !== 65 || userPublicKey[0] !== 0x04) {
    throw new Error("subscription key is not an uncompressed P-256 point");
  }
  if (authSecret.length !== 16) {
    throw new Error("subscription auth secret is not 16 bytes");
  }

  /* An EPHEMERAL key pair, one per message. Reusing it across messages would
     let a push service correlate every notification to one subscriber as the
     same sender key, and would weaken the forward secrecy the design has. */
  const ecdh = createECDH("prime256v1");
  if (input.serverKeys) {
    ecdh.setPrivateKey(input.serverKeys.privateKey);
  } else {
    ecdh.generateKeys();
  }
  const serverPublicKey = input.serverKeys?.publicKey ?? ecdh.getPublicKey();

  /* The shared secret only the browser and this process can compute. */
  const sharedSecret = ecdh.computeSecret(userPublicKey);

  /* THE AUTH SECRET IS MIXED IN HERE, and this is the step that makes the
     subscription's own secret matter. Without it, anybody who learned the
     public key could derive the same content key. */
  const authPrk = hkdfExtract(authSecret, sharedSecret);

  /* `WebPush: info` binds the derived key to BOTH parties' public keys, so a
     ciphertext cannot be replayed at a different subscription. */
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info", "ascii"),
    Buffer.from([0]),
    userPublicKey,
    serverPublicKey,
  ]);
  const ikm = hkdfExpand(authPrk, keyInfo, 32);

  const salt = input.salt ?? randomBytes(16);
  const prk = hkdfExtract(salt, ikm);

  const contentEncryptionKey = hkdfExpand(prk, contentEncodingInfo("aes128gcm"), 16);
  const nonce = hkdfExpand(prk, contentEncodingInfo("nonce"), 12);

  /* THE DELIMITER, AND IT IS NOT PADDING. RFC 8188 ends each record with a
     byte saying whether it is the last: 0x02 for the final record, 0x01
     otherwise. A receiver that finds 0x01 waits for a record that never
     comes, so this byte is the difference between a notification and a
     silence. One record, so it is always 0x02. */
  const plaintext = Buffer.concat([input.payload, Buffer.from([0x02])]);

  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  /* The aes128gcm header, which carries everything a receiver needs to
     repeat the derivation: the salt, the record size, and our public key.
     `rs` is four bytes big endian; `idlen` is one byte, here always 65. */
  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPublicKey.length, 20);

  return {
    body: Buffer.concat([header, serverPublicKey, ciphertext]),
    serverPublicKey,
    salt,
  };
}

/**
 * The VAPID Authorization header value.
 *
 * ES256 over `{typ, alg}.{aud, exp, sub}`. Two details are easy to get wrong
 * and both produce a 401 that says nothing useful:
 *
 *  - `aud` is the ORIGIN of the endpoint, not the whole endpoint URL. A JWT
 *    audienced at the full path is rejected.
 *  - the signature is RAW r||s, 64 bytes. Node signs ECDSA as DER by
 *    default, so `dsaEncoding: "ieee-p1363"` is load bearing and not a
 *    preference.
 */
export function vapidAuthorization(input: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  now?: number;
}): string {
  const audience = new URL(input.endpoint).origin;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);

  const header = base64UrlEncode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: nowSeconds + VAPID_TTL_SECONDS,
        sub: input.subject,
      }),
    ),
  );
  const signingInput = `${header}.${claims}`;

  const publicKeyBytes = base64UrlDecode(input.publicKey);
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error("VAPID public key is not an uncompressed P-256 point");
  }
  const privateKeyBytes = scalar32(base64UrlDecode(input.privateKey));
  if (privateKeyBytes === null) {
    throw new Error("VAPID private key is not a P-256 scalar");
  }

  /* Imported as a JWK because a VAPID private key is stored as the bare
     scalar, and JWK is the one import format Node offers that takes the
     coordinates directly rather than requiring a hand-built PKCS8 wrapper. */
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(publicKeyBytes.subarray(1, 33)),
      y: base64UrlEncode(publicKeyBytes.subarray(33, 65)),
      d: base64UrlEncode(privateKeyBytes),
    },
  });

  const signature = signWithKey("sha256", Buffer.from(signingInput, "ascii"), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return `vapid t=${signingInput}.${base64UrlEncode(signature)}, k=${input.publicKey}`;
}

/**
 * Check that a stored VAPID pair really is a pair.
 *
 * Two independently generated halves pasted into the wrong variables produce
 * a JWT that signs perfectly and that every push service rejects with a 401,
 * and nothing in the error says why. This derives the public key from the
 * private half and compares, so the mistake is caught once at startup rather
 * than on every send forever.
 */
/**
 * A P-256 PRIVATE KEY IS A NUMBER, AND A NUMBER HAS NO LEADING ZEROS.
 *
 * `ecdh.getPrivateKey()` returns the scalar the way OpenSSL writes a big
 * integer: shortest form, leading zero bytes stripped. So about one generated
 * key in 256 comes out 31 bytes long, and about one in 65,000 comes out 30.
 * `npx web-push generate-vapid-keys`, which is what the deployment's key was
 * told to come from, base64url encodes exactly that buffer.
 *
 * Both readers of the private half used to demand exactly 32 bytes and refuse
 * anything else. **So roughly one VAPID pair in every 256 was a perfectly
 * valid pair that this code called invalid**, and the symptom would have been
 * push refusing to send with a message blaming the key rather than the check.
 * Measured rather than reasoned: 17 of 4,000 generated keys were 31 bytes,
 * 0.42 per cent against a theoretical 0.39.
 *
 * Left padding is the whole fix, and it is not a fudge: the scalar's value is
 * unchanged, and 32 bytes is what P-256 defines the field element to be.
 * Longer than 32 is still refused, because that is a different key, not a
 * shorter spelling of this one.
 */
function scalar32(bytes: Buffer): Buffer | null {
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32 || bytes.length === 0) return null;
  const padded = Buffer.alloc(32);
  bytes.copy(padded, 32 - bytes.length);
  return padded;
}

export function vapidKeysAgree(publicKey: string, privateKey: string): boolean {
  try {
    const privateBytes = scalar32(base64UrlDecode(privateKey));
    const publicBytes = base64UrlDecode(publicKey);
    if (privateBytes === null || publicBytes.length !== 65) return false;
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(privateBytes);
    return ecdh.getPublicKey().equals(publicBytes);
  } catch {
    return false;
  }
}

/** Only used to confirm a key parses; never to move a key anywhere. */
export function vapidPublicKeyIsValid(publicKey: string): boolean {
  try {
    const bytes = base64UrlDecode(publicKey);
    if (bytes.length !== 65 || bytes[0] !== 0x04) return false;
    createPublicKey({
      format: "jwk",
      key: {
        kty: "EC",
        crv: "P-256",
        x: base64UrlEncode(bytes.subarray(1, 33)),
        y: base64UrlEncode(bytes.subarray(33, 65)),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send one notification to one Web Push subscription, AND READ THE REPLY.
 *
 * The status this returns is the status the push service gave. There is no
 * path through this function that reports anything else, which is the
 * property the whole build turns on.
 */
export async function sendWebPush(target: PushTarget, payload: PushPayload): Promise<ProviderReply> {
  const status = webPushStatus();
  if (!status.configured) {
    return { outcome: "failed", status: 0, error: "no_credentials" };
  }
  if (!target.p256dh || !target.auth) {
    /* The table's own check constraint should make this unreachable. It is
       here because "unreachable" is a claim, and a wrong one costs a crash
       inside the drain. */
    return { outcome: "failed", status: 0, error: "subscription_incomplete" };
  }
  if (!isAllowedWebPushEndpoint(target.token)) {
    /* Never POST to an address that is not a push service, including rows
       registered before the register route checked (lib/push/endpoint.ts). */
    return { outcome: "gone", status: 0, error: "endpoint_refused" };
  }

  const publicKey = (process.env[VAPID_PUBLIC_KEY_VAR] ?? "").trim();
  const privateKey = (process.env[VAPID_PRIVATE_KEY_VAR] ?? "").trim();

  let body: Buffer;
  let authorization: string;
  try {
    body = encryptForSubscription({
      payload: Buffer.from(
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          href: payload.href,
          tag: payload.tag,
          /* V-53: the buttons, re-checked by the service worker. */
          actions: payload.actions ?? [],
          urgent: payload.urgent,
          /* A1 to A3: the family's header line and the picture, both drawn by
             the service worker where the browser supports them. */
          ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
          ...(payload.image ? { image: payload.image } : {}),
        }),
        "utf8",
      ),
      p256dh: target.p256dh,
      auth: target.auth,
    }).body;
    authorization = vapidAuthorization({
      endpoint: target.token,
      publicKey,
      privateKey,
      subject: vapidSubject(),
    });
  } catch {
    /* A malformed subscription or a malformed key. Never retryable, and the
       message is deliberately not carried out of the catch: an exception
       from the crypto layer can contain key material. */
    return { outcome: "failed", status: 0, error: "encrypt_failed" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(target.token, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        /* Urgency is a real Web Push header and it is what lets a handset
           batch the unimportant and wake for the important. */
        Urgency: payload.urgent ? "high" : "normal",
        /* The push service collapses undelivered messages sharing a topic,
           so eleven unread messages in one conversation become one waiting
           notification rather than eleven. Must be base64url and short. */
        Topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, ""),
        TTL: String(payload.ttlSeconds ?? DEFAULT_TTL_SECONDS),
        Authorization: authorization,
      },
      body: new Uint8Array(body),
      signal: controller.signal,
      cache: "no-store",
      /* A push service answers; it does not redirect. Following one would
         let the endpoint's host send this request somewhere else. */
      redirect: "manual",
    });

    /* READ THE REPLY. The body is drained and discarded rather than ignored:
       an undrained body holds the socket, and the body itself may echo the
       endpoint back, so it is never stored. The STATUS is the record. */
    void response.text().catch(() => "");

    return replyFromStatus(response.status);
  } catch {
    /* A timeout, a reset, a DNS failure. Status 0 means the request never
       completed, which is a different fact from any status a server sent and
       is recorded as such rather than as a 500 we invented. */
    return { outcome: "failed", status: 0, error: "no_reply" };
  } finally {
    clearTimeout(timeout);
  }
}
