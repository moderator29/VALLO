import { describe, expect, it } from "vitest";

import { assignFaces, planFaces } from "./faces-plan";

const ADA = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const BAYO = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const THREAD = "00000000-0000-4000-8000-000000000001";

describe("the Activity Centre's faces", () => {
  const rows = [
    { id: "n1", href: `/roommates/me?tab=requests&from=${ADA}` },
    { id: "n2", href: `/messages/${THREAD}` },
    { id: "n3", href: "/u/chioma" },
    { id: "n4", href: "/bookings/b1" },
    { id: "n5", href: `/roommates/groups/${THREAD}?from=${BAYO}` },
    { id: "n6", href: `/roommates/p/${ADA}?from=${ADA}` },
  ];

  it("batches threads, handles and the senders a link names with ?from=, and skips rows with no person", () => {
    const plan = planFaces(rows, 20);
    expect(plan.lookups.map((l) => l.id)).toEqual(["n1", "n2", "n3", "n5", "n6"]);
    expect(plan.threadIds).toEqual([THREAD]);
    expect(plan.handles).toEqual(["chioma"]);
    expect(plan.userIds.sort()).toEqual([ADA, BAYO].sort());
  });

  it("reads only the visible rows", () => {
    expect(planFaces(rows, 2).lookups.map((l) => l.id)).toEqual(["n1", "n2"]);
  });

  it("puts each person's face on their row, and leaves a row with no photo bare", () => {
    const plan = planFaces(rows, 20);
    const faces = assignFaces(plan, new Map([[THREAD, BAYO]]), new Map([[ADA, "ada.jpg"], [BAYO, "bayo.jpg"]]), new Map());
    expect(Object.fromEntries(faces)).toEqual({ n1: "ada.jpg", n2: "bayo.jpg", n5: "bayo.jpg", n6: "ada.jpg" });
  });
});
