import { randomUUID } from "node:crypto";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { copilotFormSchema } from "../forms";
import { defineTool } from "./types";

/**
 * ASK WITH A CARD (16 November 2026). The copilot's way to gather details
 * before it acts: a card of up to five questions with choices to tap and one
 * button. Nothing is read or changed here; the card is checked against the
 * schema and handed to the person's screen, and their answers come back as
 * their next message (`lib/admin/copilot/forms.ts`).
 */
export const askForm = defineTool({
  name: "ask_form",
  description:
    "Ask the person for details with a card they tap instead of typing, when you need two or more facts before you can answer or act (which desk, which period, which item, how to handle it, how a reply should sound). Up to five questions. Kinds: single (one choice of 2 to 8), multi (several), yesno, scale (1 to 5), text (short words), number, date (YYYY-MM-DD). Give choices you read from the desks where you can, set initial to your best suggestion, and give the button words that say what happens next (\"Show me the tickets\"). After calling it, end your turn with at most one short sentence: their answers arrive as their next message. Never use it for a single yes or no you could just ask, and never to confirm a change (a proposal card does that).",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Preparing a few questions",
  input: copilotFormSchema,
  handler: async (input) => ({
    ok: true,
    data: { shown: true, questions: input.fields.length },
    note: "The card is on their screen now. Stop here with at most one short sentence. Their answers will come as their next message, beginning with the card's title.",
    form: { ...input, id: randomUUID() },
  }),
});

export const ASK_TOOLS = [askForm];
