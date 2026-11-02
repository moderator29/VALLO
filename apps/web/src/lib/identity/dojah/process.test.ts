import { describe, expect, it } from "vitest";
import { amlClear, processDojahResult, type ProcessDeps } from "./process";

const CHECK = "0b6c7d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    metadata: { vallo_ref: CHECK, ipinfo: { country: "Nigeria", proxy: false } },
    data: {
      government_data: { status: true, data: { nin: { entity: { nin: "70123456789", first_name: "JOHN", last_name: "MUSA", date_of_birth: "1992-10-10" } } } },
      selfie: { status: true, data: { liveness_score: 99, match_score: 97 } },
    },
    id_type: "NIN",
    reference_id: "DJ-1",
    verification_status: "Completed",
    selfie_url: "https://files.dojah.io/dojah-images/s.jpg?sig=1",
    status: true,
    ...overrides,
  };
}

function fakes(over: Partial<ProcessDeps> = {}) {
  const recorded: Record<string, unknown>[] = [];
  const copied: string[] = [];
  const deps: ProcessDeps = {
    loadCheck: async (id) => (id === CHECK ? { id, subject_id: "user-1", status: "opened" } : null),
    expectedName: async () => "John Musa",
    aml: null,
    copyFile: async (_url, path) => {
      copied.push(path);
      return path;
    },
    hmac: { nin: (n) => `nin:${n}`.padEnd(64, "0"), bvn: (n) => `bvn:${n}`.padEnd(64, "0") },
    record: async (args) => {
      recorded.push(args);
      return String(args.p_status);
    },
    ...over,
  };
  return { deps, recorded, copied };
}

describe("processDojahResult", () => {
  it("records a clean pass, hashes the NIN and never sends it raw", async () => {
    const { deps, recorded, copied } = fakes();
    const outcome = await processDojahResult(deps, payload());
    expect(outcome).toEqual({ kind: "recorded", status: "passed", verdict: "passed" });
    expect(recorded[0]!.p_nin_hmac).toMatch(/^nin:70123456789/);
    expect(JSON.stringify({ ...recorded[0], p_nin_hmac: null })).not.toContain("70123456789");
    expect(copied).toEqual([`user-1/${CHECK}/selfie.jpg`]);
  });
  it("ignores a result for a check it does not know or one already decided", async () => {
    expect(await processDojahResult(fakes().deps, payload({ metadata: { vallo_ref: "nope" } }))).toEqual({ kind: "ignored", reason: "no_reference" });
    const decided = fakes({ loadCheck: async (id) => ({ id, subject_id: "u", status: "approved" }) });
    expect(await processDojahResult(decided.deps, payload())).toEqual({ kind: "ignored", reason: "already_decided" });
  });
  it("sends an AML hit to a person", async () => {
    const { deps, recorded } = fakes({
      aml: async () => ({ ok: true, entity: { match_status: "Potential Match", total_results: 1, results: [{ name: "JOHN MUSA", source_type: "PEP" }] } }),
    });
    const outcome = await processDojahResult(deps, payload());
    expect(outcome.kind === "recorded" && outcome.status).toBe("review");
    expect((recorded[0]!.p_reasons as string[])[0]).toContain("Potential Match");
  });
  it("sends a pass to a person when the HMAC key is missing", async () => {
    const { deps } = fakes({ hmac: null });
    const outcome = await processDojahResult(deps, payload());
    expect(outcome.kind === "recorded" && outcome.status).toBe("review");
  });
  it("records waiting for an Ongoing session", async () => {
    const { deps } = fakes();
    const outcome = await processDojahResult(deps, payload({ verification_status: "Ongoing" }));
    expect(outcome.kind === "recorded" && outcome.status).toBe("waiting");
  });
  it("treats only No Match as clear", () => {
    expect(amlClear({ match_status: "No Match" })).toBe(true);
    expect(amlClear({ match_status: "Partially Matched" })).toBe(false);
    expect(amlClear({})).toBe(true);
    expect(amlClear({ results: [{ name: "x" }] })).toBe(false);
  });
});
