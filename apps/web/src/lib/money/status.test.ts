import { describe, expect, it } from "vitest";
import { valloErrorFor } from "./errors";
import { VALLO_STATUSES, VALLO_STATUS_LABEL_DRAFT, providerMappingTable, valloStatusFor } from "./status";

describe("Vallo status vocabulary", () => {
  it("has eleven statuses, each labelled", () => {
    expect(VALLO_STATUSES).toHaveLength(11);
    for (const s of VALLO_STATUSES) expect(VALLO_STATUS_LABEL_DRAFT[s]).toBeTruthy();
  });

  it("maps every documented provider word into the vocabulary", () => {
    for (const v of ["paystack"] as const) {
      for (const target of Object.values(providerMappingTable(v))) expect(VALLO_STATUSES).toContain(target);
    }
  });

  it("is paid only on a confirmed success", () => {
    expect(valloStatusFor("paystack", "success")).toBe("paid");
    expect(valloStatusFor("paystack", "pending")).toBe("processing");
    expect(valloStatusFor("paystack", "abandoned")).toBe("awaiting_payment");
  });

  it("an unknown or missing word is under review, never a guess", () => {
    expect(valloStatusFor("paystack", "SOMETHING_NEW")).toBe("under_review");
    expect(valloStatusFor("paystack", undefined)).toBe("under_review");
    expect(valloStatusFor("paystack", "__proto__")).toBe("under_review");
  });

  it("no label leaks a provider word", () => {
    const labels = Object.values(VALLO_STATUS_LABEL_DRAFT).join(" ");
    expect(labels).not.toMatch(/paystack|ONGOING|INVESTIGATING|abandoned/i);
  });
});

describe("Vallo error language", () => {
  it("maps documented codes and never claims an outcome after a timeout", () => {
    expect(valloErrorFor({ httpStatus: 429 })).toMatchObject({ code: "busy_try_shortly", retryable: true });
    expect(valloErrorFor({ httpStatus: 503 }).code).toBe("service_unavailable");
    expect(valloErrorFor({ httpStatus: 403 }).code).toBe("not_set_up");
    expect(valloErrorFor({ httpStatus: 400 }).code).toBe("request_refused");
    const unknown = valloErrorFor({ httpStatus: null });
    expect(unknown).toMatchObject({ code: "outcome_unknown", retryable: false });
    expect(unknown.message).not.toMatch(/nothing (has been|was) charged/i);
  });
});
