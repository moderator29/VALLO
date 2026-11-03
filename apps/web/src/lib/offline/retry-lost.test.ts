import { describe, expect, it, vi } from "vitest";
import { retryLost } from "./retry-lost";

const sleep = vi.fn(async () => {});

describe("retryLost", () => {
  it("asks again after a lost answer and returns the real one", async () => {
    const call = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue("ok");
    await expect(retryLost(call, { sleep })).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("gives up after the last gap and throws the network error", async () => {
    const call = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(retryLost(call, { sleep, gaps: [1, 1] })).rejects.toThrow("Failed to fetch");
    expect(call).toHaveBeenCalledTimes(3);
  });
  it("never repeats a real fault", async () => {
    const call = vi.fn().mockRejectedValue(new Error("Cannot read properties of undefined"));
    await expect(retryLost(call, { sleep })).rejects.toThrow("Cannot read");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
