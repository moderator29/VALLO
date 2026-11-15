import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: () => null,
};
vi.stubGlobal("window", { localStorage: fakeStorage });

import { dismissSaveEducation, saveEducationPending, subscribeSaveEducation, triggerSaveEducation } from "./save-education";

beforeEach(() => store.clear());
afterEach(() => {
  if (saveEducationPending()) dismissSaveEducation();
});

describe("the first-save education trigger", () => {
  it("opens once and remembers, so the second tap is silent", () => {
    const updates: boolean[] = [];
    subscribeSaveEducation(() => updates.push(saveEducationPending()));

    triggerSaveEducation();
    expect(saveEducationPending()).toBe(true);
    expect(updates).toEqual([true]);

    dismissSaveEducation();
    expect(saveEducationPending()).toBe(false);
    expect(store.get("vallo.saved.education.v1")).toBe("seen");

    triggerSaveEducation();
    expect(saveEducationPending()).toBe(false);
  });

  it("stays closed when storage says it was already seen", () => {
    store.set("vallo.saved.education.v1", "seen");
    triggerSaveEducation();
    expect(saveEducationPending()).toBe(false);
  });

  it("stays closed when localStorage throws", () => {
    const orig = fakeStorage.getItem;
    fakeStorage.getItem = () => { throw new Error("blocked"); };
    triggerSaveEducation();
    expect(saveEducationPending()).toBe(false);
    fakeStorage.getItem = orig;
  });
});
