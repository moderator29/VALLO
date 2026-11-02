import { describe, expect, it, vi } from "vitest";
import { codeIn, twilioBody, twilioChannels, twilioConfig, twilioPost, twilioTransport } from "./twilio";
import { capturingTransport, routedTransport, unconfiguredTransport } from "./transport";

const SID = `AC${"a".repeat(32)}`;
const ENV = { TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: "tok", TWILIO_MESSAGING_SERVICE_SID: "MG123" };
const cfg = twilioConfig(ENV)!;

describe("twilioConfig", () => {
  it("is off until the account, the token and a sender are all set", () => {
    expect(twilioConfig({})).toBeNull();
    expect(twilioConfig({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: "tok" })).toBeNull();
    expect(twilioConfig({ ...ENV, TWILIO_ACCOUNT_SID: "nope" })).toBeNull();
    expect(twilioConfig({ TWILIO_ACCOUNT_SID: SID, TWILIO_AUTH_TOKEN: "tok", TWILIO_FROM_NUMBER: "+15005550006" })).not.toBeNull();
    expect(cfg.messagingServiceSid).toBe("MG123");
  });
  it("offers WhatsApp only with both its sender and its template", () => {
    expect(twilioChannels(cfg)).toEqual(["sms"]);
    expect(twilioChannels({ ...cfg, whatsappFrom: "+14155238886", whatsappContentSid: "HX1" })).toEqual(["whatsapp", "sms"]);
  });
});

describe("the request", () => {
  it("builds an SMS from the messaging service", () => {
    const b = twilioBody(cfg, "+447911123456", "Your Vallo code is 123456", "sms")!;
    expect(b.get("To")).toBe("+447911123456");
    expect(b.get("MessagingServiceSid")).toBe("MG123");
    expect(b.get("From")).toBeNull();
    expect(b.get("Body")).toContain("123456");
  });
  it("builds a WhatsApp template message carrying only the code", () => {
    const w = { ...cfg, whatsappFrom: "+14155238886", whatsappContentSid: "HX1" };
    const b = twilioBody(w, "+447911123456", "Your Vallo code is 123456", "whatsapp")!;
    expect(b.get("To")).toBe("whatsapp:+447911123456");
    expect(b.get("From")).toBe("whatsapp:+14155238886");
    expect(b.get("ContentSid")).toBe("HX1");
    expect(b.get("ContentVariables")).toBe('{"1":"123456"}');
    expect(b.get("Body")).toBeNull();
  });
  it("finds the code in a message", () => {
    expect(codeIn("Your Vallo code is 482913. It expires in 10 minutes.")).toBe("482913");
    expect(codeIn("no digits")).toBeNull();
  });
  it("posts with basic auth to the account's Messages endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sid: "SM1", error_code: null }), { status: 201 }));
    const r = await twilioPost(cfg, "+447911123456", "Your code 123456", "sms", fetcher);
    expect(r).toEqual({ ok: true, messageSid: "SM1" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from(`${SID}:tok`).toString("base64")}`);
  });
  it("reports a refusal and a dead network apart, and never throws", async () => {
    expect(await twilioPost(cfg, "+447911123456", "x 123456", "sms", async () => new Response("{}", { status: 400 }))).toEqual({ ok: false, reason: "refused" });
    expect(await twilioPost(cfg, "+447911123456", "x 123456", "sms", async () => { throw new Error("down"); })).toEqual({ ok: false, reason: "network" });
  });
});

describe("the transports", () => {
  it("falls back from WhatsApp to SMS when WhatsApp is refused", async () => {
    const w = { ...cfg, whatsappFrom: "+14155238886", whatsappContentSid: "HX1" };
    const seen: string[] = [];
    const fetcher = vi.fn(async (_u: string, init: RequestInit) => {
      const to = (init.body as URLSearchParams).get("To")!;
      seen.push(to);
      return to.startsWith("whatsapp:") ? new Response("{}", { status: 400 }) : new Response(JSON.stringify({ sid: "SM2" }), { status: 201 });
    });
    const r = await twilioTransport(w, fetcher as never).send("+447911123456", "Your code 123456");
    expect(r).toEqual({ ok: true });
    expect(seen).toEqual(["whatsapp:+447911123456", "+447911123456"]);
  });
  it("refuses a malformed number without calling Twilio", async () => {
    const fetcher = vi.fn();
    expect(await twilioTransport(cfg, fetcher as never).send("0803", "Your code 123456")).toEqual({ ok: false, reason: "failed" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("routes Nigerian numbers to Termii's side and the rest to Twilio's, never crossing", async () => {
    const ng: { to: string; message: string }[] = [];
    const abroad: { to: string; message: string }[] = [];
    const t = routedTransport(capturingTransport(ng), capturingTransport(abroad));
    await t.send("+2348031234567", "a");
    await t.send("+447911123456", "b");
    expect(ng.map((m) => m.to)).toEqual(["+2348031234567"]);
    expect(abroad.map((m) => m.to)).toEqual(["+447911123456"]);
    expect(await routedTransport(unconfiguredTransport, unconfiguredTransport).send("+447911123456", "c")).toEqual({ ok: false, reason: "unconfigured" });
  });
});
