import { describe, expect, it } from "vitest";
import { groupRows, orderRows, placePopover, type ActionSheetRow } from "./action-sheet-model";

const noop = () => {};
const confirm = { title: "Delete?", line: "It cannot be undone.", confirmLabel: "Delete" };

describe("orderRows", () => {
  it("puts every destructive row last and keeps the rest in the order given", () => {
    const rows: ActionSheetRow[] = [
      { id: "delete", kind: "danger", label: "Delete", onSelect: noop, confirm },
      { id: "pin", label: "Pin" },
      { id: "block", kind: "danger", label: "Block", onSelect: noop, confirm: "own" },
      { id: "mute", kind: "switch", label: "Mute", checked: false, onChange: noop },
    ];
    expect(orderRows(rows).map((row) => row.id)).toEqual(["pin", "mute", "delete", "block"]);
  });
});

describe("groupRows", () => {
  it("joins neighbouring radios of one group and leaves every other row alone", () => {
    const rows: ActionSheetRow[] = [
      { id: "open", label: "Open" },
      { id: "a", kind: "radio", group: "Show", label: "All", checked: true, onSelect: noop },
      { id: "b", kind: "radio", group: "Show", label: "Unread", checked: false, onSelect: noop },
      { id: "c", kind: "radio", group: "Sort", label: "Newest", checked: true, onSelect: noop },
      { id: "pin", label: "Pin" },
      { id: "d", kind: "radio", group: "Sort", label: "Oldest", checked: false, onSelect: noop },
    ];
    const shape = groupRows(rows).map((entry) => (Array.isArray(entry) ? entry.map((row) => row.id) : entry.id));
    expect(shape).toEqual(["open", ["a", "b"], ["c"], "pin", ["d"]]);
  });
});

describe("placePopover", () => {
  const viewport = { width: 1440, height: 900 };
  const size = { width: 352, height: 400 };

  it("hangs under the trigger from its start edge when there is room", () => {
    const at = placePopover({ left: 200, right: 244, top: 100, bottom: 144 }, size, viewport);
    expect(at).toEqual({ left: 200, top: 152, above: false });
  });

  it("hangs from the end edge when the start edge would run off the window", () => {
    const at = placePopover({ left: 1380, right: 1424, top: 100, bottom: 144 }, size, viewport);
    expect(at.left).toBe(1424 - 352);
    expect(at.left + size.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it("flips above the trigger when there is no room below and more above", () => {
    const at = placePopover({ left: 200, right: 244, top: 820, bottom: 864 }, size, viewport);
    expect(at.above).toBe(true);
    expect(at.top).toBe(820 - 8 - 400);
  });

  it("stays inside the margin on a window too small for it", () => {
    const at = placePopover({ left: 4, right: 48, top: 10, bottom: 54 }, { width: 352, height: 700 }, { width: 360, height: 640 });
    expect(at.left).toBe(8);
    expect(at.top).toBe(8);
  });

  it("mirrors in a right-to-left page", () => {
    const at = placePopover({ left: 900, right: 944, top: 100, bottom: 144 }, size, viewport, true);
    expect(at.left).toBe(944 - 352);
  });
});
