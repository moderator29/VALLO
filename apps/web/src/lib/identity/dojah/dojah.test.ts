import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { dojahConfig } from "./config";
import { dojahClient, failureFor, retryable } from "./client";
import { decideVerification, readVerification } from "./result";
import { redactDojahPayload, verifyDojahSignature } from "./webhook";

/** The documented kyc_widget sample, trimmed to the fields Vallo reads. */
function sample(overrides: Record<string, unknown> = {}) {
  return {
    metadata: { vallo_ref: "chk-123", ipinfo: { country: "Nigeria", proxy: false } },
    data: {
      government_data: {
        status: true,
        data: { nin: { entity: { nin: "70123456789", first_name: "JOHN", middle_name: "DOE", last_name: "MUSA", date_of_birth: "1992-10-10" } } },
      },
      selfie: { status: true, message: "Successfully validated your liveness", data: { selfie_url: "https://files.dojah.io/dojah-images/s.jpg?X=1", liveness_score: 98, match_score: 96 } },
      id: { status: true, message: "ok", data: { id_data: { document_type: "National ID" } } },
    },
    id_type: "NIN",
    value: "70123456789",
    reference_id: "DJ-92F24FA662",
    verification_status: "Completed",
    verification_url: "https://app.dojah.io/easy-onboard/verifications/abc",
    selfie_url: "https://files.dojah.io/dojah-images/s.jpg?X=1",
    status: true,
    aml: { status: false },
    ...overrides,
  };
}

describe("dojahConfig", () => {
  it("is off without an app id and a secret key", () => {
    expect(dojahConfig({})).toBeNull();
    expect(dojahConfig({ DOJAH_APP_ID: "a" })).toBeNull();
  });
  it("defaults to the sandbox and strips a stray Bearer", () => {
    const c = dojahConfig({ DOJAH_APP_ID: "a", DOJAH_SECRET_KEY: "Bearer sk_x" })!;
    expect(c.environment).toBe("sandbox");
    expect(c.baseUrl).toBe("https://sandbox.dojah.io");
    expect(c.secretKey).toBe("sk_x");
    expect(c.widgetId).toBeNull();
  });
  it("goes live only when told", () => {
    const c = dojahConfig({ DOJAH_APP_ID: "a", DOJAH_SECRET_KEY: "s", DOJAH_ENV: "LIVE", DOJAH_WIDGET_ID: "w" })!;
    expect(c.baseUrl).toBe("https://api.dojah.io");
    expect(c.widgetId).toBe("w");
  });
});

describe("the client", () => {
  it("maps the documented status codes", () => {
    expect(failureFor(402)).toBe("wallet");
    expect(failureFor(404)).toBe("not_found");
    expect(failureFor(424)).toBe("upstream");
    expect(failureFor(401)).toBe("unauthorised");
    expect(retryable("upstream")).toBe(true);
    expect(retryable("wallet")).toBe(false);
  });
  it("sends the key raw with the AppId and unwraps entity", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const client = dojahClient(dojahConfig({ DOJAH_APP_ID: "app", DOJAH_SECRET_KEY: "sk" })!, async (url, init) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      return new Response(JSON.stringify({ entity: { company_name: "VALLO SPACES LTD" } }), { status: 200 });
    });
    const answer = await client.cacAdvance("9870413", "COMPANY");
    expect(answer).toEqual({ ok: true, entity: { company_name: "VALLO SPACES LTD" } });
    expect(seen[0]!.url).toBe("https://sandbox.dojah.io/api/v1/kyc/cac/advance?rc_number=9870413&company_type=COMPANY");
    expect(seen[0]!.headers.Authorization).toBe("sk");
    expect(seen[0]!.headers.AppId).toBe("app");
  });
  it("answers wallet on 402 and upstream when the network fails", async () => {
    const config = dojahConfig({ DOJAH_APP_ID: "a", DOJAH_SECRET_KEY: "s" })!;
    expect(await dojahClient(config, async () => new Response("", { status: 402 })).vnin("X")).toEqual({ ok: false, reason: "wallet", status: 402 });
    expect(await dojahClient(config, async () => { throw new Error("down"); }).vnin("X")).toEqual({ ok: false, reason: "upstream", status: 0 });
  });
});

describe("the webhook signature", () => {
  const body = JSON.stringify(sample());
  const secret = "whsec_test";
  const good = createHmac("sha256", secret).update(body).digest("hex");
  it("accepts the HMAC of the exact bytes", () => {
    expect(verifyDojahSignature(body, good, secret)).toBe(true);
    expect(verifyDojahSignature(body, good.toUpperCase(), secret)).toBe(true);
  });
  it("refuses a changed body, a missing header or no secret", () => {
    expect(verifyDojahSignature(body + " ", good, secret)).toBe(false);
    expect(verifyDojahSignature(body, null, secret)).toBe(false);
    expect(verifyDojahSignature(body, good, null)).toBe(false);
    expect(verifyDojahSignature(body, "abc", secret)).toBe(false);
  });
  it("redacts government numbers and file links from the stored payload", () => {
    const text = JSON.stringify(redactDojahPayload(sample()));
    expect(text).not.toContain("70123456789");
    expect(text).not.toContain("files.dojah.io");
    expect(text).toContain("JOHN");
  });
});

describe("reading and deciding a result", () => {
  it("reads the documented sample", () => {
    const r = readVerification(sample())!;
    expect(r.valloRef).toBe("chk-123");
    expect(r.dojahReference).toBe("DJ-92F24FA662");
    expect(r.lifecycle).toBe("Completed");
    expect(r.idType).toBe("NIN");
    expect(r.idNumber).toBe("70123456789");
    expect(r.governmentName).toBe("JOHN DOE MUSA");
    expect(r.selfie).toEqual({ ok: true, liveness: 98, match: 96, message: "Successfully validated your liveness" });
    expect(r.files.selfie).toMatch(/^https:\/\/files\.dojah\.io/);
  });
  it("passes a clean result whose name matches", () => {
    const v = decideVerification(readVerification(sample())!, "John Musa");
    expect(v.kind).toBe("passed");
  });
  it("sends a name mismatch to a person, never refuses it", () => {
    const v = decideVerification(readVerification(sample())!, "Ada Obi");
    expect(v.kind).toBe("review");
    if (v.kind === "review") expect(v.reasons.join(" ")).toContain("JOHN DOE MUSA");
  });
  it("sends a weak face match or a proxy to a person", () => {
    const weak = sample();
    (weak.data.selfie.data as { match_score: number }).match_score = 60;
    expect(decideVerification(readVerification(weak)!, "John Musa").kind).toBe("review");
    const vpn = sample({ metadata: { vallo_ref: "x", ipinfo: { proxy: true } } });
    expect(decideVerification(readVerification(vpn)!, "John Musa").kind).toBe("review");
  });
  it("waits on Ongoing and Pending, invites back on Abandoned, retries on Failed", () => {
    expect(decideVerification(readVerification(sample({ verification_status: "Pending" }))!, "x").kind).toBe("waiting");
    expect(decideVerification(readVerification(sample({ verification_status: "Abandoned" }))!, "x").kind).toBe("abandoned");
    expect(decideVerification(readVerification(sample({ verification_status: "Failed" }))!, "x").kind).toBe("retry");
  });
  it("Completed is not passed: a false overall status goes to a person", () => {
    expect(decideVerification(readVerification(sample({ status: false }))!, "John Musa").kind).toBe("review");
  });
});
