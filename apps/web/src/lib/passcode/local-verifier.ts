/**
 * THE PASSCODE, CHECKED ON THE PHONE WHEN VALLO CANNOT BE REACHED
 * (2 November 2026; docs/PASSCODE.md section 11).
 *
 * The way a banking app opens with no signal. After the server accepts the
 * passcode, this device keeps a verifier: PBKDF2-SHA256 of the code under a
 * random salt, 200,000 rounds, tied to the member's id. Never the code.
 *
 * WHAT IT CAN OPEN, AND WHAT IT CANNOT. It is used only by the lock drawn
 * over a page that is ALREADY on this phone (a copy the service worker kept,
 * or the screen the member was on when it locked), and only when the server
 * cannot be reached. It shows that page again. It writes no unlock cookie and
 * opens nothing on the server: every money action still refuses until the
 * server has accepted the code, which happens by itself when the signal
 * returns (`PasscodeLock`). A lock drawn by the server in place of a page has
 * no page behind it and never uses this.
 *
 * WHY THIS IS NOT A WEAKER DOOR. Whoever can read this device's storage can
 * already read the kept pages it would reveal (they sit in the same origin's
 * cache). Five wrong tries here forget the verifier, so the next unlock needs
 * the server; it expires after 30 days; sign-out forgets it.
 */

const KEY = "nf_pc_local";
const ROUNDS = 200_000;
const EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOCAL_MISSES = 5;

type Stored = { v: 1; user: string; salt: string; hash: string; length: number; at: number; misses: number };

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function derive(code: string, salt: Uint8Array, user: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("no webcrypto");
  const material = await subtle.importKey("raw", new TextEncoder().encode(`${user}:${code}`), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ROUNDS }, material, 256);
  return b64(new Uint8Array(bits));
}

function read(storage: Storage | null): Stored | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== 1 || typeof parsed.hash !== "string" || typeof parsed.salt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** After the server accepted `code`: keep a fresh verifier for this member on this device. */
export async function rememberPasscode(user: string, code: string, length: number, storage: Storage | null = store(), now = Date.now()): Promise<void> {
  if (!storage || !user || !/^\d{4,6}$/.test(code)) return;
  try {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(code, salt, user);
    const value: Stored = { v: 1, user, salt: b64(salt), hash, length, at: now, misses: 0 };
    storage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* No storage or no crypto: the server stays the only check. */
  }
}

/** Whether this device can check a code for `user` without the network. */
export function canCheckLocally(user: string, storage: Storage | null = store(), now = Date.now()): boolean {
  const kept = read(storage);
  return Boolean(kept && kept.user === user && now - kept.at < EXPIRES_MS && kept.misses < MAX_LOCAL_MISSES);
}

/**
 * "ok", "wrong", or "unavailable" (no verifier, another member, expired, or
 * too many misses here). A wrong code counts; the fifth forgets the verifier.
 */
export async function checkLocally(
  user: string,
  code: string,
  storage: Storage | null = store(),
  now = Date.now(),
): Promise<"ok" | "wrong" | "unavailable"> {
  const kept = read(storage);
  if (!storage || !kept || kept.user !== user || now - kept.at >= EXPIRES_MS || kept.misses >= MAX_LOCAL_MISSES) {
    return "unavailable";
  }
  let hash: string;
  try {
    hash = await derive(code, unb64(kept.salt), user);
  } catch {
    return "unavailable";
  }
  let diff = hash.length ^ kept.hash.length;
  for (let i = 0; i < Math.min(hash.length, kept.hash.length); i += 1) diff |= hash.charCodeAt(i) ^ kept.hash.charCodeAt(i);
  if (diff === 0) {
    storage.setItem(KEY, JSON.stringify({ ...kept, misses: 0 }));
    return "ok";
  }
  const misses = kept.misses + 1;
  if (misses >= MAX_LOCAL_MISSES) forgetLocalPasscode(storage);
  else storage.setItem(KEY, JSON.stringify({ ...kept, misses }));
  return "wrong";
}

/** Sign-out, a changed passcode, or too many misses: the next unlock needs the server. */
export function forgetLocalPasscode(storage: Storage | null = store()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* Nothing to forget. */
  }
}
