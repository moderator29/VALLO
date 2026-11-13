import { describe, expect, it } from "vitest";
import { isChunkLoadError, isNetworkError } from "./use-offline";

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

/*
 * 13 November 2026: the words Safari, Firefox and Turbopack use for a piece of
 * the app's own code that did not arrive, and the reset of a dropped
 * connection, were missing, so those reached the fault screen.
 */
describe("a piece of the app's own code that did not arrive", () => {
  it("is a weak signal, and is known as a chunk so the boundary loads the page afresh instead of drawing it again", () => {
    for (const message of [
      "Importing a module script failed.",
      "error loading dynamically imported module: https://www.vallospaces.com/_next/static/chunks/a.js",
      "Failed to fetch dynamically imported module: https://www.vallospaces.com/_next/static/chunks/a.js",
      "Failed to load chunk /_next/static/immutable/chunks/3gw4krc1jurw9.js from module 123",
    ]) {
      expect(isNetworkError(new TypeError(message)), message).toBe(true);
      expect(isChunkLoadError(new TypeError(message)), message).toBe(true);
    }
    expect(isNetworkError(new Error("net::ERR_CONNECTION_RESET"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

/*
 * The founder's screenshot (13 November 2026), reproduced on production: a
 * navigation's answer cut part way throws React's "Connection closed.", which
 * the production build words as "Minified React error #412". It drew the
 * fault screen with a "C-" reference. It is a weak signal.
 */
describe("a navigation cut part way by a weak signal", () => {
  it("is a weak signal in both of React's wordings", () => {
    expect(isNetworkError(new Error("Connection closed."))).toBe(true);
    expect(isNetworkError(new Error("Minified React error #412; visit https://react.dev/errors/412 for the full message or use the non-minified dev environment for full errors and additional helpful warnings."))).toBe(true);
    expect(isNetworkError(new Error("Minified React error #418; visit https://react.dev/errors/418"))).toBe(false);
    expect(isNetworkError(new Error("Minified React error #4120"))).toBe(false);
  });
});
