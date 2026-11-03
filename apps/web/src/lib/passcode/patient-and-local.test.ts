import { describe, expect, it, vi } from "vitest";
import { verifyPatiently } from "./patient-verify";
import { canCheckLocally, checkLocally, forgetLocalPasscode, rememberPasscode } from "./local-verifier";
import type { VerifyResult } from "./actions";

const ATTEMPT = "11111111-2222-4333-8444-555555555555";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

describe("verifyPatiently: a weak signal is asked again, a real answer ends it", () => {
  it("retries a lost answer under the same attempt id, then takes the answer", async () => {
    const calls: [string, string][] = [];
    const answers: Array<VerifyResult | Error> = [new Error("network"), { status: "error" }, { status: "ok" }];
    const onRetry = vi.fn();
    const result = await verifyPatiently(
      {
        verify: async (code, id) => {
          calls.push([code, id]);
          const next = answers.shift()!;
          if (next instanceof Error) throw next;
          return next;
        },
        isOnline: () => true,
        sleep: async () => undefined,
        onRetry,
      },
      "4829",
      ATTEMPT,
    );
    expect(result).toEqual({ status: "ok" });
    expect(calls).toEqual([["4829", ATTEMPT], ["4829", ATTEMPT], ["4829", ATTEMPT]]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("never retries a wrong code", async () => {
    const verify = vi.fn(async (): Promise<VerifyResult> => ({ status: "wrong", beforeCooldown: 4, beforeSignOut: 9 }));
    const result = await verifyPatiently({ verify, isOnline: () => true, sleep: async () => undefined }, "1111", ATTEMPT);
    expect(result.status).toBe("wrong");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("says unreachable after the last gap, or at once with no network", async () => {
    const lost = async (): Promise<VerifyResult> => {
      throw new Error("timeout");
    };
    const verify = vi.fn(lost);
    expect(await verifyPatiently({ verify, isOnline: () => true, sleep: async () => undefined, gaps: [1, 1] }, "4829", ATTEMPT)).toEqual({
      status: "unreachable",
    });
    expect(verify).toHaveBeenCalledTimes(3);
    const offline = vi.fn(lost);
    expect(await verifyPatiently({ verify: offline, isOnline: () => false, sleep: async () => undefined }, "4829", ATTEMPT)).toEqual({
      status: "unreachable",
    });
    expect(offline).toHaveBeenCalledTimes(1);
  });
});

describe("the phone's own check", () => {
  it("opens with the right code for the same member, and never stores the code", async () => {
    const storage = memoryStorage();
    await rememberPasscode("user-1", "482913", 6, storage, 1_000);
    expect(JSON.stringify([...Array(storage.length)].map((_, i) => storage.getItem(storage.key(i)!)))).not.toContain("482913");
    expect(canCheckLocally("user-1", storage, 2_000)).toBe(true);
    expect(await checkLocally("user-1", "482913", storage, 2_000)).toBe("ok");
    expect(await checkLocally("user-1", "111222", storage, 2_000)).toBe("wrong");
    /* Another member on the same phone cannot use it. */
    expect(await checkLocally("user-2", "482913", storage, 2_000)).toBe("unavailable");
  });

  it("forgets itself after five misses, after thirty days, and on sign-out", async () => {
    const storage = memoryStorage();
    await rememberPasscode("user-1", "4829", 4, storage, 0);
    for (let i = 0; i < 5; i += 1) expect(await checkLocally("user-1", "0000", storage, 10)).toBe("wrong");
    expect(await checkLocally("user-1", "4829", storage, 10)).toBe("unavailable");

    await rememberPasscode("user-1", "4829", 4, storage, 0);
    expect(canCheckLocally("user-1", storage, 31 * 24 * 60 * 60 * 1000)).toBe(false);

    await rememberPasscode("user-1", "4829", 4, storage, 0);
    forgetLocalPasscode(storage);
    expect(canCheckLocally("user-1", storage, 10)).toBe(false);
  });
});
