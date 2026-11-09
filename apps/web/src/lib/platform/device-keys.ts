/**
 * WHICH FACE ID OR FINGERPRINT KEYS THIS PHONE HOLDS (the Face ID bug, 7
 * November 2026: "Face ID is not working; it should work and be set up in
 * settings when putting the PIN").
 *
 * The server knows every platform key an ACCOUNT has (`money_credentials`),
 * not which phone holds which. So a member who set up Face ID on one device
 * saw "Unlock with Face ID" on every other one, where the phone has no such
 * key and the ceremony can only fail; and because the account "had a key",
 * the phone that lacked one was never offered the set-up after the passcode,
 * and Settings said it was already on.
 *
 * This is the phone's own record, in local storage, of the keys it made or
 * used successfully. It decides only what is OFFERED. It proves nothing and
 * unlocks nothing: every unlock is still a WebAuthn assertion the server
 * verifies (`lib/passcode/passkey-unlock.ts`).
 *
 *   has      this phone made or used one of the account's keys
 *   unknown  no record yet (every phone before this change): offered, and two
 *            failed tries in a row with no success turn it into `none`
 *   none     this phone has no key: offer the set-up instead of the unlock
 */
const KEY = "vallo.device-keys";
const FAILS_TO_NONE = 2;

type Record = { ids: string[]; fails: number; none: boolean };

function read(): Record | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Record>;
    return {
      ids: Array.isArray(value.ids) ? value.ids.filter((id): id is string => typeof id === "string").slice(0, 20) : [],
      fails: typeof value.fails === "number" ? value.fails : 0,
      none: value.none === true,
    };
  } catch {
    return null;
  }
}

function write(record: Record): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* Storage refused: the phone stays `unknown`, which still offers the unlock. */
  }
}

export type DeviceKeyState = "has" | "unknown" | "none";

/** What this phone holds, against the account's key ids when they are known. */
export function deviceKeyState(accountIds?: readonly string[]): DeviceKeyState {
  const record = read();
  if (!record) return "unknown";
  if (record.ids.length > 0) {
    if (!accountIds) return "has";
    return record.ids.some((id) => accountIds.includes(id)) ? "has" : "none";
  }
  return record.none ? "none" : "unknown";
}

/** This phone made or just used this key. */
export function rememberDeviceKey(credentialId: string): void {
  const record = read() ?? { ids: [], fails: 0, none: false };
  write({ ids: [credentialId, ...record.ids.filter((id) => id !== credentialId)].slice(0, 20), fails: 0, none: false });
}

/** The key was removed from the account. */
export function forgetDeviceKey(credentialId: string): void {
  const record = read();
  if (!record) return;
  write({ ...record, ids: record.ids.filter((id) => id !== credentialId) });
}

/** A ceremony on this phone came back with nothing. Returns the state after. */
export function noteDeviceKeyFailed(): DeviceKeyState {
  const record = read() ?? { ids: [], fails: 0, none: false };
  /* A phone that holds a key and was cancelled once still holds it. */
  if (record.ids.length > 0) return "has";
  const fails = record.fails + 1;
  const none = fails >= FAILS_TO_NONE;
  write({ ids: [], fails, none });
  return none ? "none" : "unknown";
}
