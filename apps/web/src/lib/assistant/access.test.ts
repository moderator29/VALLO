import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { assertPermission, auditAction, readAssistantState } from "./access";
import { toolDefinitions, toolsFor, runTool } from "./tools/registry";
import { defineTool, type AssistantTool } from "./tools/types";

type Call = { fn: string; args?: Record<string, unknown> };
function client(answers: Record<string, unknown>, calls: Call[] = []) {
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, ...(args ? { args } : {}) });
      const a = answers[fn];
      if (a instanceof Error) throw a;
      return { data: a, error: null };
    },
  };
}

describe("readAssistantState", () => {
  it("reads as OFF for a signed-out caller, a failed read and a malformed answer", async () => {
    expect((await readAssistantState(client({ ai_assistant_state: { signed_in: false } }))).enabled).toBe(false);
    expect((await readAssistantState(client({ ai_assistant_state: new Error("down") }))).enabled).toBe(false);
    expect((await readAssistantState(client({ ai_assistant_state: "yes" }))).enabled).toBe(false);
  });

  it("gives no permission while it is off, even if rows are reported", async () => {
    const s = await readAssistantState(
      client({ ai_assistant_state: { signed_in: true, enabled: false, permissions: ["discovery", "transactions"], grant_epoch: 2 } }),
    );
    expect(s.permissions).toEqual([]);
    expect(s.enabled).toBe(false);
  });

  it("keeps only known permission keys and the epoch when it is on", async () => {
    const s = await readAssistantState(
      client({ ai_assistant_state: { signed_in: true, enabled: true, permissions: ["discovery", "root"], grant_epoch: 4 } }),
    );
    expect(s.permissions).toEqual(["discovery"]);
    expect(s.epoch).toBe(4);
  });
});

describe("assertPermission", () => {
  it("allows when the database says so, and writes nothing", async () => {
    const c = client({ ai_assistant_can: true });
    expect(await assertPermission(c, "transactions", "list_transactions")).toEqual({ ok: true });
    expect(c.calls.map((x) => x.fn)).toEqual(["ai_assistant_can"]);
  });

  it("denies, and audits the denial, when it does not", async () => {
    const c = client({ ai_assistant_can: false });
    expect(await assertPermission(c, "wallet_balance", "get_balance")).toEqual({ ok: false, reason: "not_granted" });
    const audit = c.calls.find((x) => x.fn === "ai_assistant_audit_write");
    expect(audit?.args).toMatchObject({ p_event: "tool_denied", p_permission: "wallet_balance", p_tool: "get_balance", p_outcome: "denied" });
  });

  it("fails closed when the database cannot be asked", async () => {
    const c = client({ ai_assistant_can: new Error("down") });
    expect((await assertPermission(c, "transactions")).ok).toBe(false);
  });
});

describe("auditAction", () => {
  it("never throws, even when the log cannot be written", async () => {
    await expect(auditAction(client({ ai_assistant_audit_write: new Error("down") }), { event: "tool_used" })).resolves.toBeUndefined();
  });
});

const privateTool: AssistantTool = defineTool({
  name: "list_transactions",
  description: "A private tool.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "transactions",
  workspaces: ["consumer"],
  run: async () => ({ data: { rows: [] } }),
});
const publicTool: AssistantTool = defineTool({
  name: "public_one",
  description: "A public tool.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  workspaces: ["consumer"],
  run: async () => ({ data: {} }),
});
const registry = [publicTool, privateTool] as const;

describe("tools that require a permission", () => {
  it("are hidden from the model until the permission is granted", () => {
    expect(toolsFor("consumer", registry).map((t) => t.name)).toEqual(["public_one"]);
    expect(toolsFor("consumer", registry, { enabled: false, permissions: ["transactions"], epoch: 1 }).map((t) => t.name)).toEqual(["public_one"]);
    expect(
      toolDefinitions("consumer", registry, { enabled: true, permissions: ["discovery", "transactions"], epoch: 1 }).map((d) => d.name),
    ).toEqual(["public_one", "list_transactions"]);
  });

  it("are refused at run time by the database, not by what the model claims", async () => {
    const c = client({ ai_assistant_can: false });
    const run = await runTool("list_transactions", {}, { frame: "consumer", access: { enabled: true, permissions: ["transactions"], epoch: 1 }, supabase: c }, registry);
    expect(run.ok).toBe(false);
    expect(c.calls.some((x) => x.fn === "ai_assistant_audit_write")).toBe(true);
  });

  it("run when the request offered it and the database agrees", async () => {
    const c = client({ ai_assistant_can: true });
    const run = await runTool(
      "list_transactions",
      {},
      { frame: "consumer", supabase: c, userId: "u1", access: { enabled: true, permissions: ["transactions"], epoch: 1 } },
      registry,
    );
    expect(run.ok).toBe(true);
  });

  it("are refused, without asking the database, when this request never offered them", async () => {
    const c = client({ ai_assistant_can: true });
    const run = await runTool("list_transactions", {}, { frame: "consumer", supabase: c, userId: "u1" }, registry);
    expect(run.ok).toBe(false);
    expect(c.calls.some((x) => x.fn === "ai_assistant_can")).toBe(false);
  });

  it("are refused when there is no client to ask", async () => {
    const run = await runTool("list_transactions", {}, { frame: "consumer" }, registry);
    expect(run.ok).toBe(false);
  });
});

vi.mock("server-only", () => ({}));
