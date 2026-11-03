import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runTool, TOOL_REGISTRY, toolDefinitions, toolsFor } from "./registry";
import { defineTool, TOOL_FRAMES, type AssistantTool, type ToolFrame } from "./types";

/*
 * Every listing and area read is stood in: these tests are about the
 * registry's gate (name, frame, schema), and a tool that gets past it must
 * not reach the network.
 */
vi.mock("@/lib/listings/repository", () => ({
  getListingRepository: () => ({ search: async () => [], byId: async () => null }),
}));
vi.mock("@/lib/social/areas-queries", () => ({ listOpenAreas: async () => [] }));
vi.mock("@/lib/social/posts-queries", () => ({ getAreaFeed: async () => ({ posts: [] }) }));

const ctx = (frame: ToolFrame = "consumer") => ({ frame });

describe("the registry", () => {
  it("lists the tools once each, in the order the API is shown them", () => {
    expect(TOOL_REGISTRY.map((t) => t.name)).toEqual([
      "search_listings",
      "compare_listings",
      "area_intel",
      "find_screen",
      "get_listing_photos",
      "get_listing_details",
      "picked_for_you",
      "remember_preference",
      "list_saved_listings",
      "propose_save_listing",
      "get_viewing_options",
      "propose_viewing",
      "list_my_viewings",
      "propose_cancel_viewing",
      "get_move_options",
      "propose_reschedule_viewing",
      "list_my_bookings",
      "list_my_transactions",
      "spend_summary",
      "get_refund_status",
      "get_wallet_balance",
      "propose_payment",
      "get_account_summary",
    ]);
  });

  it("holds read and propose tools only (none writes), each offered in at least one known frame", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(["read", "propose"], tool.name).toContain(tool.mode);
      /* A proposing tool needs a permission: it can only ever prepare something for the member to approve. */
      if (tool.mode === "propose") expect(tool.requires, tool.name).toBeDefined();
      expect(tool.workspaces.length, tool.name).toBeGreaterThan(0);
      for (const frame of tool.workspaces) expect(TOOL_FRAMES).toContain(frame);
    }
  });

  it("shows the model a schema that agrees with the zod schema the input is checked against", () => {
    for (const tool of TOOL_REGISTRY) {
      const fromZod = z.toJSONSchema(tool.input) as { properties?: object; required?: string[] };
      const shown = tool.inputSchema as { type: string; properties: object; required?: string[] };
      expect(shown.type, tool.name).toBe("object");
      expect(Object.keys(shown.properties).sort(), tool.name).toEqual(Object.keys(fromZod.properties ?? {}).sort());
      expect([...(shown.required ?? [])].sort(), tool.name).toEqual([...(fromZod.required ?? [])].sort());
    }
  });

  it("builds the API tools list as name, description and input_schema only", () => {
    /* With nothing granted the model sees the public tools only. */
    const defs = toolDefinitions("consumer");
    expect(defs.map((d) => d.name)).toEqual(TOOL_REGISTRY.filter((t) => !t.requires).map((t) => t.name));
    for (const def of defs) expect(Object.keys(def)).toEqual(["name", "description", "input_schema"]);
  });

  it("carries no em dash in anything the model reads", () => {
    for (const tool of TOOL_REGISTRY) {
      const all = toolDefinitions("consumer", TOOL_REGISTRY, { enabled: true, permissions: ["discovery", "saved_prefs", "bookings_viewings", "account_info", "transactions", "wallet_balance", "payment_assist", "notifications"], epoch: 1 });
      expect(JSON.stringify(all.find((d) => d.name === tool.name))).not.toContain("\u2014");
    }
  });
});

describe("runTool refuses, and never throws", () => {
  it("answers an unknown name with an error", async () => {
    await expect(runTool("delete_everything", {}, ctx())).resolves.toEqual({
      ok: false,
      error: "There is no tool called delete_everything.",
    });
    await expect(runTool("", {}, ctx())).resolves.toMatchObject({ ok: false });
  });

  it.each([
    ["search_listings", { kind: "castle" }],
    ["search_listings", { bedrooms: "two" }],
    ["search_listings", { maxPricePerNightNaira: "a lot" }],
    ["search_listings", { query: 7 }],
    ["search_listings", "Yaba"],
    ["compare_listings", {}],
    ["compare_listings", { ids: "l1" }],
    ["compare_listings", { ids: ["l1"] }],
    ["compare_listings", { ids: ["a", "b", "c", "d", "e"] }],
    ["compare_listings", { ids: [1, 2] }],
    ["area_intel", {}],
    ["area_intel", { place: 3 }],
    ["find_screen", {}],
    ["find_screen", { need: "   " }],
    ["find_screen", { need: "x".repeat(301) }],
    ["find_screen", null],
  ])("%s refuses %j with a schema error", async (name, input) => {
    const run = await runTool(name, input, ctx());
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error).toMatch(new RegExp(`^${name} was called with input that does not match its schema`));
  });

  it("passes input that fits the schema to the tool", async () => {
    const run = await runTool("search_listings", { query: "Yaba", kind: "rental", bedrooms: 2 }, ctx());
    expect(run).toMatchObject({ ok: true, outcome: { data: { results: [] } } });
  });

  it("turns a tool that throws into an error", async () => {
    const boom = defineTool({
      name: "boom",
      description: "Fails.",
      input: z.object({}),
      inputSchema: { type: "object", properties: {} },
      mode: "read",
      workspaces: TOOL_FRAMES,
      async run() {
        throw new Error("database down");
      },
    });
    const run = await runTool("boom", {}, ctx(), [boom]);
    expect(run).toEqual({ ok: false, error: "boom could not finish just now. Answer without it and say so." });
  });
});

describe("the workspace filter", () => {
  const ran: unknown[] = [];
  const agentOnly: AssistantTool = defineTool({
    name: "agent_only",
    description: "For listers.",
    input: z.object({ n: z.number() }),
    inputSchema: { type: "object", properties: { n: { type: "number" } }, required: ["n"] },
    mode: "read",
    workspaces: ["agent"],
    async run(_ctx, input) {
      ran.push(input);
      return { data: input };
    },
  });
  const registry = [...TOOL_REGISTRY, agentOnly];

  it("offers a tool only in its own frames", () => {
    expect(toolsFor("agent", registry).map((t) => t.name)).toContain("agent_only");
    expect(toolsFor("host", registry).map((t) => t.name)).not.toContain("agent_only");
    expect(toolsFor("consumer", registry).map((t) => t.name)).not.toContain("agent_only");
    expect(toolDefinitions("host", registry).map((d) => d.name)).not.toContain("agent_only");
  });

  it("refuses to run it outside them, without running it", async () => {
    ran.length = 0;
    expect(await runTool("agent_only", { n: 1 }, ctx("host"), registry)).toEqual({
      ok: false,
      error: "The tool agent_only is not available here.",
    });
    expect(ran).toEqual([]);
    expect(await runTool("agent_only", { n: 1 }, ctx("agent"), registry)).toEqual({ ok: true, outcome: { data: { n: 1 } } });
    expect(ran).toEqual([{ n: 1 }]);
  });
});
