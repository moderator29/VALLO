import { describe, expect, it } from "vitest";
import { pathInOwnFolder } from "./own-folder";

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "22222222-2222-4222-8222-222222222222";

describe("a storage path in its owner's folder", () => {
  it("accepts a file in the folder or below it, in either case", () => {
    expect(pathInOwnFolder(ME, `${ME}/avatar.webp`)).toBe(true);
    expect(pathInOwnFolder(ME, `${ME}/docs/id-front.pdf`)).toBe(true);
    expect(pathInOwnFolder(ME, `${ME}/${THEM}.jpg`)).toBe(true);
    expect(pathInOwnFolder(ME, `${ME.toUpperCase()}/a.jpg`)).toBe(true);
  });

  it("refuses a path that walks out, or is not in the folder at all", () => {
    for (const forged of [
      `${ME}/../${THEM}/id.pdf`,
      `${ME}/./x.png`,
      `${ME}//x.png`,
      `${ME}/x.jpg/`,
      `${ME}/a\\..\\b.png`,
      `${ME}/\t/x.jpg`,
      `${ME}/x\u0000.png`,
      ME,
      `${ME}/`,
      `${ME}x/evil.png`,
      `${THEM}/x.jpg`,
      `other/${ME}/x.png`,
      "",
    ]) {
      expect(pathInOwnFolder(ME, forged), JSON.stringify(forged)).toBe(false);
    }
    expect(pathInOwnFolder(ME, `${ME}/${"a".repeat(400)}`)).toBe(false);
    expect(pathInOwnFolder("", "/x.png")).toBe(false);
  });
});
