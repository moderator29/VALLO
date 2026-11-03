import type { z } from "zod";
import type { AssistantListingItem, AssistantStreamEvent } from "../types";
import type { AssistantWorkspace } from "../workspace";
import type { AiPermission, AssistantAccess } from "../permissions";

/**
 * ONE SHAPE FOR EVERY ASSISTANT TOOL (AI-01).
 *
 * Each tool lives in its own file under `lib/assistant/tools/` and is listed
 * once in `registry.ts`. The route builds the Claude API `tools` list from the
 * registry and dispatches a tool_use block by name; the registry checks the
 * input against the tool's zod schema before `run` sees it, so a tool never
 * receives input its schema refuses.
 */

/** Where the assistant was opened: the plain concierge, or a workspace. */
export type ToolFrame = "consumer" | AssistantWorkspace;

export const TOOL_FRAMES: readonly ToolFrame[] = ["consumer", "agent", "host"];

/** What a running tool may know about the request. */
export type ToolContext = {
  frame: ToolFrame;
  /**
   * What this person has allowed the assistant, read from the database for
   * THIS request, never from the browser. Absent reads as off.
   */
  access?: AssistantAccess;
  /**
   * The caller's own authenticated client, for a tool that declares
   * `requires`. Never the service role.
   */
  supabase?: unknown;
  /** The signed-in person's id, from the session, for tools that need it. Never from the model. */
  userId?: string;
};

/**
 * What a tool hands back. `data` goes to the model inside the fence
 * (`lib/assistant/untrusted.ts`). `note` is a fixed sentence from this
 * codebase that the model follows; never member text. `listings` are cards
 * for the stream's `listings` event and never reach the model.
 */
export type ToolOutcome = {
  data: unknown;
  note?: string;
  listings?: AssistantListingItem[];
  /**
   * Stream events the SERVER built from this result (cards, slots, summaries,
   * payment reviews). They reach the screen and never the model, which is what
   * keeps a button, an amount or a proposal id out of the model's hands.
   */
  events?: AssistantStreamEvent[];
};

/**
 * "read" today. "propose" arrives with approval-bound actions (AI-03); no
 * tool here changes anything.
 */
export type ToolMode = "read" | "propose";

/** A tool as the Claude API is told about it. */
export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Readonly<Record<string, unknown>>;
};

export type AssistantTool<S extends z.ZodType = z.ZodType> = {
  name: string;
  /** A prompt for the model, so it is written for the model. */
  description: string;
  /** Checked before `run`. */
  input: S;
  /**
   * The JSON schema the model is shown, written by hand so the wire stays
   * exactly as it was. `registry.test.ts` checks it agrees with `input`.
   */
  inputSchema: Readonly<Record<string, unknown>>;
  mode: ToolMode;
  /**
   * The permission a member must have granted before this tool is shown to the
   * model or run. Public discovery tools declare none. Enforced twice: hidden
   * by `toolsFor`, and checked against the database by `runTool` before `run`.
   */
  requires?: AiPermission;
  /** The frames this tool is offered in. Outside them it is neither offered nor run. */
  workspaces: readonly ToolFrame[];
  run(ctx: ToolContext, input: z.output<S>): Promise<ToolOutcome>;
};

/** Identity, for inference: keeps `run`'s input typed by the schema. */
export function defineTool<S extends z.ZodType>(tool: AssistantTool<S>): AssistantTool<S> {
  return tool;
}
