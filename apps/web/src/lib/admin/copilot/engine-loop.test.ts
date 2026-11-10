import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_TOOL_ROUNDS, streamAdminCopilot, type AdminCopilotEvent, type AdminCopilotRequest } from "./engine";
import { defineTool, type CopilotViewer } from "./tools/types";

const viewer: CopilotViewer = { userId: "u1", firstName: "Ada", isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: "support_agent" };

/** One model reply as the SSE stream the Messages API sends. */
function sse(frames: Record<string, unknown>[]): Response {
  const body = frames.map((f) => `event: ${String(f.type)}\ndata: ${JSON.stringify(f)}\n\n`).join("");
  return new Response(new Blob([body]).stream(), { status: 200 });
}
const textReply = (text: string) =>
  sse([
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" } },
  ]);
const toolReply = (name: string, input: unknown, id = "tu1") =>
  sse([
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id, name } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use" } },
  ]);

const readTool = defineTool({
  name: "get_support_queue",
  description: "d",
  kind: "read",
  scopes: ["support"],
  status: "Reading the support queue",
  input: z.object({}),
  handler: async () => ({ ok: true, data: { openTotal: 7 } }),
});
const proposeTool = defineTool({
  name: "create_my_task",
  description: "d",
  kind: "propose",
  scopes: ["support"],
  status: "Preparing a task",
  input: z.object({ title: z.string() }),
  handler: async (input) => ({
    ok: true,
    data: { proposed: true },
    proposal: { label: "Add a task", summary: `Adds ${input.title}`, args: { title: input.title }, mode: "draft", deskHref: "/admin/my-desk/tasks", action: null },
  }),
});

const req = (over: Partial<AdminCopilotRequest> = {}): AdminCopilotRequest => ({
  viewer,
  positionTitle: "Support Agent",
  roleSummary: null,
  scopeLabels: ["Support"],
  deskName: "Support",
  context: null,
  history: [],
  message: "How many tickets are open?",
  tools: [readTool, proposeTool],
  now: Date.parse("2026-11-10T09:00:00Z"),
  ...over,
});

async function collect(gen: AsyncGenerator<AdminCopilotEvent>) {
  const out: AdminCopilotEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("the copilot tool loop", () => {
  it("calls a tool, feeds the result back, then streams the final answer", async () => {
    const bodies: Record<string, unknown>[] = [];
    const replies = [toolReply("get_support_queue", {}), textReply("There are 7 open tickets, from the support queue.")];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return replies.shift()!;
    });
    const events = await collect(streamAdminCopilot("key", req(), new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch }));
    const types = events.map((e) => e.type);
    expect(types).toEqual(["tool", "tool", "text", "done"]);
    expect(events[0]).toMatchObject({ type: "tool", phase: "start", label: "Reading the support queue" });
    expect(events[1]).toMatchObject({ type: "tool", phase: "done" });
    expect(events.find((e) => e.type === "text")).toMatchObject({ text: expect.stringContaining("7 open tickets") });
    /* The second request carries the tool result inside the untrusted fence. */
    const second = bodies[1]!.messages as { role: string; content: unknown }[];
    const last = second[second.length - 1]!;
    expect(last.role).toBe("user");
    expect(JSON.stringify(last.content)).toContain("vallo_tool");
    expect(JSON.stringify(last.content)).toContain("openTotal");
    /* Per-round token caps, tools offered, system prompt carries the limits. */
    expect(bodies[0]!.max_tokens).toBeLessThanOrEqual(1400);
    expect((bodies[0]!.tools as unknown[]).length).toBe(2);
    expect(String(bodies[0]!.system)).toContain("HARD LIMITS");
  });

  it("streams a proposal as its own event and never as a change", async () => {
    const replies = [toolReply("create_my_task", { title: "Follow up" }), textReply("I have prepared a card. Nothing has changed yet.")];
    const fetchImpl = vi.fn(async () => replies.shift()!);
    const events = await collect(streamAdminCopilot("key", req(), new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch }));
    const proposal = events.find((e) => e.type === "proposal");
    expect(proposal).toMatchObject({ proposal: { tool: "create_my_task", label: "Add a task", mode: "draft" } });
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("refuses a tool the viewer was not offered, even when the model asks for it", async () => {
    const replies = [toolReply("get_money_overview", {}), textReply("That is not on your desks.")];
    const fetchImpl = vi.fn(async () => replies.shift()!);
    const events = await collect(streamAdminCopilot("key", req(), new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch }));
    expect(events.filter((e) => e.type === "tool").map((e) => (e as { phase: string }).phase)).toEqual(["start", "error"]);
  });

  it("stops after six rounds and forces an answer without tools on the last", async () => {
    const calls: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push(body);
      return calls.length < MAX_TOOL_ROUNDS ? toolReply("get_support_queue", {}, `tu${calls.length}`) : textReply("Here is what I have.");
    });
    const events = await collect(streamAdminCopilot("key", req(), new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch }));
    expect(calls).toHaveLength(MAX_TOOL_ROUNDS);
    expect(calls[MAX_TOOL_ROUNDS - 1]!.tool_choice).toEqual({ type: "none" });
    expect(calls[0]!.tool_choice).toBeUndefined();
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("yields an error event, not a throw, when the model cannot be reached", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 500 }));
    const events = await collect(streamAdminCopilot("key", req(), new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
  });
});
