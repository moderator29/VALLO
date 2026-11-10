import { carriesToolOutput } from "@/lib/assistant/untrusted";
import type { AdminCopilotTurn } from "./engine";

/** Only plain user and assistant prose from the browser; never a replayed tool result. */
export function cleanHistory(history: unknown): AdminCopilotTurn[] {
  if (!Array.isArray(history)) return [];
  const turns: AdminCopilotTurn[] = [];
  for (const raw of history.slice(-20)) {
    const turn = raw as Partial<AdminCopilotTurn> | null;
    if (!turn || (turn.role !== "user" && turn.role !== "assistant") || typeof turn.text !== "string") continue;
    const text = turn.text.trim().slice(0, 4000);
    if (!text) continue;
    if (turn.role === "assistant" && carriesToolOutput(text)) continue;
    turns.push({ role: turn.role, text });
  }
  while (turns.length > 0 && turns[0]!.role !== "user") turns.shift();
  return turns;
}

