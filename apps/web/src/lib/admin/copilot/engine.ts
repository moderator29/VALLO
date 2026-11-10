import "server-only";

/**
 * THE ADMIN COPILOT, SHARED ENGINE (founder, 10 November 2026: an AI
 * assistant on every admin desk, addressing the staff member by name,
 * answering from what Vallo's console and manuals actually say).
 *
 * One streaming call, the same discipline the member assistant already uses
 * (`app/api/assistant/route.ts`): the Anthropic Messages API, server-sent
 * events parsed by hand, a watchdog so the route always answers before the
 * platform's own timeout. No tools in this first build: the page that hosts
 * the copilot passes in a short, already-correct context string (today's
 * real counts, read under the viewer's own access), and the model answers
 * from that plus the role's job description. It never queries the database
 * itself, so it can never read past what its caller chose to show it.
 *
 * This is an internal tool for staff, not the member-facing assistant: no AI
 * consent gate (that is a member-privacy control; staff already agreed to
 * the handbook, which says personal data stays inside the console), but the
 * same rule holds here by instruction: never invent a figure, a case
 * outcome, or a policy; never claim to have taken an action; say plainly
 * when something is not known yet.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const ADMIN_COPILOT_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

export type AdminCopilotTurn = { role: "user" | "assistant"; text: string };

export type AdminCopilotRequest = {
  /** The staff member's first name only; never their email or full legal name. */
  viewerFirstName: string;
  /** The role's title, as JOB_DESCRIPTIONS names it, or null for a super admin with no named position. */
  positionTitle: string | null;
  /** One short paragraph: what the role is for, read from JOB_DESCRIPTIONS. */
  roleSummary: string | null;
  /** The desk's own name, as the sidebar shows it (for example "Business Development"). */
  deskName: string;
  /**
   * A short, already-correct block of today's real figures for this desk,
   * built by the server page from its own data read under the viewer's own
   * access. Plain text, no markup. Omit rather than guess.
   */
  context: string | null;
  /** The conversation so far, oldest first. The caller stores and replays this; the engine holds no memory of its own. */
  history: AdminCopilotTurn[];
  /** What the staff member just asked. */
  message: string;
};

/** The one rule every desk's copilot carries, regardless of role. */
const HOUSE_RULES: string[] = [
  "You are the internal AI assistant inside the Vallo staff console, speaking with one member of staff, never with a member of the public.",
  "Address them by their first name once, naturally, not in every reply.",
  "Answer only from the role description, the context given to you, and general knowledge of how a company like Vallo runs. Never invent a figure, a case outcome, a member's details, or a company policy you were not given.",
  "You cannot see the database and cannot take any action yourself: no approval, no payment, no message to a member, no change of any kind. If they ask you to do something, explain how to do it in the console, and say plainly that you cannot do it for them.",
  "If you do not know something, say so and point to the staff manual or their lead, rather than guess.",
  "Keep answers short and practical: a staff member is working, not reading an essay.",
  "Never write anything a member of the public might see without first telling the staff member whom to ask before it goes out (their lead, for anything that reads as a company statement).",
];

export function buildAdminSystemPrompt(req: Pick<AdminCopilotRequest, "viewerFirstName" | "positionTitle" | "roleSummary" | "deskName" | "context">): string {
  const lines = [...HOUSE_RULES];
  lines.push(`The staff member you are speaking with is named ${req.viewerFirstName}.`);
  lines.push(
    req.positionTitle
      ? `Their position is ${req.positionTitle}${req.roleSummary ? `: ${req.roleSummary}` : "."}`
      : "They are a super admin with full console access.",
  );
  lines.push(`They are on the ${req.deskName} desk.`);
  if (req.context) lines.push(`Today, on this desk: ${req.context}`);
  return lines.join("\n");
}

export type AdminCopilotEvent = { type: "text"; text: string } | { type: "done" } | { type: "error"; message: string };

async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            yield JSON.parse(payload) as Record<string, unknown>;
          } catch {
            /* A malformed frame is dropped; the stream carries on. */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * One streamed reply, no tool use. Yields text deltas as they arrive, then
 * `done`. Never throws: an upstream fault is yielded as `error`, so the
 * route can always answer with a 200 body the client can read.
 */
export async function* streamAdminCopilot(
  apiKey: string,
  req: AdminCopilotRequest,
  signal: AbortSignal,
): AsyncGenerator<AdminCopilotEvent> {
  const system = buildAdminSystemPrompt(req);
  const messages = [
    ...req.history.slice(-20).map((turn) => ({ role: turn.role, content: turn.text })),
    { role: "user", content: req.message },
  ];
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal,
      headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
      body: JSON.stringify({ model: ADMIN_COPILOT_MODEL, max_tokens: MAX_TOKENS, stream: true, system, messages }),
    });
  } catch {
    yield { type: "error", message: "Could not reach the assistant just now. Try again in a moment." };
    return;
  }
  if (!res.ok || !res.body) {
    yield { type: "error", message: "The assistant did not answer just now. Try again in a moment." };
    return;
  }
  try {
    for await (const event of sse(res.body)) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") yield { type: "text", text: delta.text };
      }
    }
    yield { type: "done" };
  } catch {
    yield { type: "error", message: "The assistant stopped answering partway through. Try again." };
  }
}
