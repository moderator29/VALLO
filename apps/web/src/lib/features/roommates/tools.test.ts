import { describe, expect, it } from "vitest";

import { cleanGallery } from "./model";
import { agreementText, openShelf } from "./tools";

const W = { heading: "House agreement", who: "People: {names}", where: "Home: {where}", split: "Rent: {split}", rulesHead: "House rules:", note: "Not a legal contract." };

describe("agreementText", () => {
  it("numbers the rules, names the people and ends with the note", () => {
    const t = agreementText(W, { names: " Ada ,Bola, ", where: "Yaba", splitLabel: "Equal shares", rules: ["Quiet hours from 10pm", "No smoking inside"] });
    expect(t).toBe("House agreement\nPeople: Ada, Bola\nHome: Yaba\nRent: Equal shares\n\nHouse rules:\n1. Quiet hours from 10pm\n2. No smoking inside\n\nNot a legal contract.");
  });
  it("leaves out what was not given and caps the lists", () => {
    const t = agreementText(W, { names: "", where: "  ", splitLabel: "Equal shares", rules: Array.from({ length: 30 }, (_, i) => `r${i}`) });
    expect(t).not.toContain("People:");
    expect(t).not.toContain("Home:");
    expect(t.match(/^\d+\. /gm)).toHaveLength(20);
  });
});

describe("openShelf", () => {
  it("opens the shelf that has items, and lets the address override", () => {
    expect(openShelf(undefined, 2, 1)).toBe("rooms");
    expect(openShelf(undefined, 0, 3)).toBe("people");
    expect(openShelf(undefined, 0, 0)).toBe("rooms");
    expect(openShelf("people", 4, 0)).toBe("people");
    expect(openShelf("rooms", 0, 4)).toBe("rooms");
  });
});

describe("cleanGallery", () => {
  const me = "11111111-1111-4111-8111-111111111111";
  it("keeps only the member's own photos, once each, six at most", () => {
    expect(cleanGallery(me, [`${me}/a.jpg`, `${me}/a.jpg`, `${me}/b.jpg`])).toEqual([`${me}/a.jpg`, `${me}/b.jpg`]);
    expect(cleanGallery(me, ["someone-else/a.jpg"])).toBeNull();
    expect(cleanGallery(me, [`${me}/../x.jpg`])).toBeNull();
    expect(cleanGallery(me, Array.from({ length: 7 }, (_, i) => `${me}/${i}.jpg`))).toBeNull();
    expect(cleanGallery(me, [])).toEqual([]);
  });
});
