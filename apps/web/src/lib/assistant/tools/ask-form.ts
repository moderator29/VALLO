import { randomUUID } from "node:crypto";
import { z } from "zod";
import { copilotFormSchema } from "@/lib/chat/question-cards.schema";
import { defineTool, TOOL_FRAMES } from "./types";

/**
 * ASK WITH A CARD (the founder, 16 November 2026, from a ChatGPT screenshot of
 * a travel card: month, length of stay, class, and a Find flights button).
 *
 * The member assistant's way to gather what it needs before it searches or
 * suggests: the area, the budget, bedrooms, the move-in month, the dates of a
 * stay, the size of a table. Nothing is read or changed; the card is checked
 * against the shared schema (`lib/chat/question-cards.ts`) and drawn by the
 * server's own event, and the member's answers come back as their next
 * message.
 */
const shown = z.toJSONSchema(copilotFormSchema) as Record<string, unknown>;
delete shown.$schema;

export const askFormTool = defineTool({
  name: "ask_form",
  description:
    "Ask the member for details with a card they tap instead of typing, when you need two or more facts before you can search or suggest well: for a home the area, the budget, bedrooms and the move-in month; for a stay the dates, guests and area; for a table the day, time and party size. Up to five questions. Kinds: single (one choice of 2 to 8), multi (several), yesno, scale (1 to 5), text (short words), number, date (YYYY-MM-DD). Offer real, sensible choices for Nigeria (naira budgets in ranges, real areas), set initial to your best guess from what they said, and word the button as what happens next (\"Find homes\", \"Show me stays\"). After calling it, end your turn with at most one short sentence: their answers arrive as their next message. Never use it for one simple question, and never to ask for a password, card number or ID number.",
  input: copilotFormSchema,
  inputSchema: shown,
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(_ctx, form) {
    const card = { ...form, id: randomUUID() };
    return {
      data: { shown: true, questions: form.fields.length },
      note: "The card is on their screen now. Stop here with at most one short sentence. Their answers will come as their next message.",
      events: [{ type: "form", form: card }],
    };
  },
});
