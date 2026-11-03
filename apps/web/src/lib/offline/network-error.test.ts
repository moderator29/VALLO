import { describe, expect, it } from "vitest";
import { isNetworkError } from "./use-offline";

describe("isNetworkError: a weak signal is not a fault", () => {
  it("knows the browsers' words for a request that never landed", () => {
    for (const message of [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
      "The network connection was lost.",
      "An unexpected response was received from the server.",
      "Loading chunk 482 failed.",
      "net::ERR_INTERNET_DISCONNECTED",
    ]) {
      expect(isNetworkError(new TypeError(message)), message).toBe(true);
    }
    const chunk = new Error("x");
    chunk.name = "ChunkLoadError";
    expect(isNetworkError(chunk)).toBe(true);
  });

  it("leaves real faults as faults", () => {
    expect(isNetworkError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isNetworkError(new Error("Unauthorized"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
