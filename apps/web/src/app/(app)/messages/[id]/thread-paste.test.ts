import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH } from "@/lib/messages/schema";
import { MAX_PENDING_PHOTOS, THREAD_TEXT_LIMIT } from "./thread-paste";

describe("the thread composer's limits", () => {
  it("counts a held paste against the same limit the server holds a typed message to", () => {
    expect(THREAD_TEXT_LIMIT).toBe(MAX_MESSAGE_LENGTH);
  });

  it("holds a handful of photos for one Send, never an unbounded pile", () => {
    expect(MAX_PENDING_PHOTOS).toBeGreaterThan(1);
    expect(MAX_PENDING_PHOTOS).toBeLessThanOrEqual(10);
  });
});
