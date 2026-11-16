import { describe, expect, it } from "vitest";
import { decideKey, G_WINDOW_MS, nextIndex } from "./member-keys";

const now = 10_000;

describe("desktop keyboard layer (B17)", () => {
  it("maps the single keys", () => {
    expect(decideKey({ key: "/", now })).toEqual({ type: "search" });
    expect(decideKey({ key: "?", now })).toEqual({ type: "help" });
    expect(decideKey({ key: "j", now })).toEqual({ type: "move", dir: 1 });
    expect(decideKey({ key: "k", now })).toEqual({ type: "move", dir: -1 });
    expect(decideKey({ key: "s", now })).toEqual({ type: "save" });
    expect(decideKey({ key: "x", now })).toBeNull();
  });

  it("takes g then a letter within the window", () => {
    expect(decideKey({ key: "g", now })).toEqual({ type: "pending-g" });
    expect(decideKey({ key: "m", now, pendingGAt: now - 300 })).toEqual({ type: "go", href: "/messages" });
    expect(decideKey({ key: "p", now, pendingGAt: now - 300 })).toEqual({ type: "go", href: "/bookings" });
    expect(decideKey({ key: "h", now, pendingGAt: now - 300 })).toEqual({ type: "go", href: "/home" });
    /* "g s" is Search, not save. */
    expect(decideKey({ key: "s", now, pendingGAt: now - 300 })).toEqual({ type: "go", href: "/search" });
    /* Too late: the second key is itself. */
    expect(decideKey({ key: "s", now, pendingGAt: now - G_WINDOW_MS - 1 })).toEqual({ type: "save" });
  });

  it("never fires while typing or with a modifier", () => {
    expect(decideKey({ key: "/", now, inField: true })).toBeNull();
    expect(decideKey({ key: "s", now, meta: true })).toBeNull();
    expect(decideKey({ key: "j", now, ctrl: true })).toBeNull();
    expect(decideKey({ key: "k", now, alt: true })).toBeNull();
  });

  it("opens VALLO Intelligence on Cmd+K or Ctrl+K, even from a field, and not with Alt", () => {
    expect(decideKey({ key: "k", now, meta: true })).toEqual({ type: "intelligence" });
    expect(decideKey({ key: "K", now, ctrl: true })).toEqual({ type: "intelligence" });
    expect(decideKey({ key: "k", now, ctrl: true, inField: true })).toEqual({ type: "intelligence" });
    expect(decideKey({ key: "k", now, ctrl: true, alt: true })).toBeNull();
    /* A bare k still walks the rows. */
    expect(decideKey({ key: "k", now })).toEqual({ type: "move", dir: -1 });
  });

  it("moves through rows and stops at the ends", () => {
    expect(nextIndex(-1, 1, 5)).toBe(0);
    expect(nextIndex(-1, -1, 5)).toBe(4);
    expect(nextIndex(4, 1, 5)).toBe(4);
    expect(nextIndex(0, -1, 5)).toBe(0);
    expect(nextIndex(2, 1, 0)).toBe(-1);
  });
});
