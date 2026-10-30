import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Filing one of the three registrations, against a fake client that records
 * every write. One open application per person, and a document path is the
 * caller's own folder and nothing reached through it.
 */

const USER = "957b3bd2-cce3-425d-bba9-5cd876ca3d62";
type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

const seam = vi.hoisted(() => ({
  calls: [] as Call[],
  open: null as { reference: string } | null,
  notified: [] as unknown[],
}));

function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      seam.calls.push(call);
      const result = () => {
        if (table === "agent_applications" && call.op === "select") return { data: seam.open, error: null };
        if (table === "agent_applications" && call.op === "insert") {
          return { data: { id: "app-1", reference: "VL-AGT-10020" }, error: null };
        }
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const op of ["insert", "update"] as const) {
        chain[op] = (payload: unknown) => {
          call.op = op;
          call.payload = payload;
          return chain;
        };
      }
      for (const op of ["select", "order", "limit"] as const) chain[op] = () => chain;
      chain.eq = (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return chain;
      };
      chain.in = (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return chain;
      };
      chain.maybeSingle = () => Promise.resolve(result());
      chain.single = () => Promise.resolve(result());
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: () =>
    Promise.resolve({ state: "signed-in", supabase: fakeClient(), user: { id: USER, email: "ada@example.com" } }),
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        seam.notified.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

const { submitSupplyRegistration } = await import("./registration-actions");
const { PAY_ON_VALLO_VERSION, PRIVACY_VERSION, TERMS_VERSION } = await import("../legal/versions");

const OWNER = {
  role: "owner",
  fullName: "Ada Obi",
  phone: "0803 123 4567",
  nin: "12345678901",
  stateCode: "LA",
  lgaCode: "la_ikeja",
  area: "",
  ownershipDocument: "none",
  acceptTerms: true,
  acceptPayOnVallo: true,
};

const AGENT = {
  role: "agent",
  fullName: "Ada Obi",
  phone: "0803 123 4567",
  nin: "12345678901",
  experience: "3_5",
  agencyFeeBps: 1000,
  legalFeeBps: null,
  idPath: `${USER}/batch/identity-1.jpg`,
  selfiePath: "",
  acceptTerms: true,
  acceptPayOnVallo: true,
};

const writes = () => seam.calls.filter((c) => c.op !== "select");

beforeEach(() => {
  seam.calls = [];
  seam.open = null;
  seam.notified = [];
});

describe("submitSupplyRegistration", () => {
  it("files an owner registration and tells them", async () => {
    const result = await submitSupplyRegistration(OWNER);
    expect(result.ok).toBe(true);
    const insert = writes().find((c) => c.table === "agent_applications");
    expect(insert?.payload).toMatchObject({ supply_role: "owner", ownership_document: "none", status: "SUBMITTED" });
    expect(seam.notified).toHaveLength(1);
  });

  it("refuses a second filing while an application is still open, and writes nothing", async () => {
    seam.open = { reference: "VL-AGT-10019" };
    const result = await submitSupplyRegistration(OWNER);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("VL-AGT-10019");
    expect(writes()).toEqual([]);
    const read = seam.calls.find((c) => c.table === "agent_applications" && c.op === "select");
    expect(read?.filters).toContainEqual(["status", ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"]]);
  });

  it("refuses a document path that climbs out of the caller's folder", async () => {
    const result = await submitSupplyRegistration({ ...AGENT, idPath: `${USER}/../someone-else/identity.jpg` });
    expect(result.ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("files an owner's proof of ownership against the registration, not a listing", async () => {
    const result = await submitSupplyRegistration({
      ...OWNER,
      ownershipDocument: "letter_of_authority",
      ownershipPath: `${USER}/batch/ownership-1.pdf`,
    });
    expect(result.ok).toBe(true);
    const documents = writes().find((c) => c.table === "agent_documents");
    expect(documents?.payload).toEqual([
      { application_id: "app-1", uploader_id: USER, kind: "ownership", storage_path: `${USER}/batch/ownership-1.pdf` },
    ]);
  });

  it("files an agent's documents against the new application", async () => {
    const result = await submitSupplyRegistration(AGENT);
    expect(result.ok).toBe(true);
    const documents = writes().find((c) => c.table === "agent_documents");
    expect(documents?.payload).toEqual([
      { application_id: "app-1", uploader_id: USER, kind: "identity", storage_path: `${USER}/batch/identity-1.jpg` },
    ]);
  });

  /* Ruling 6 (13 October 2026): enforced on the server, not only in the form. */
  it("refuses a registration without both ticks, and writes nothing", async () => {
    for (const missing of [{ acceptTerms: undefined }, { acceptPayOnVallo: undefined }, { acceptPayOnVallo: false }]) {
      seam.calls = [];
      const result = await submitSupplyRegistration({ ...OWNER, ...missing });
      expect(result.ok).toBe(false);
      expect(writes()).toEqual([]);
    }
    const result = await submitSupplyRegistration({ ...AGENT, acceptPayOnVallo: undefined });
    expect(result.ok ? null : result.fieldErrors?.acceptPayOnVallo).toMatch(/inside Vallo/);
  });

  it("records the acceptance on the application with each version and the moment", async () => {
    const result = await submitSupplyRegistration(OWNER);
    expect(result.ok).toBe(true);
    const insert = writes().find((c) => c.table === "agent_applications");
    const agreements = (insert?.payload as { consents?: { agreements?: { document: string; version: string; at: string }[] } })
      .consents?.agreements;
    expect(agreements?.map((a) => [a.document, a.version])).toEqual([
      ["terms", TERMS_VERSION],
      ["privacy", PRIVACY_VERSION],
      ["pay_on_vallo", PAY_ON_VALLO_VERSION],
    ]);
    expect(agreements?.every((a) => !Number.isNaN(Date.parse(a.at)))).toBe(true);
  });
});
