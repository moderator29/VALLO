"use client";

import { CopilotAnswer } from "@/components/admin/copilot/CopilotAnswer";
import { ProposalCard } from "@/components/admin/copilot/ProposalCard";
import { SUPER_ADMIN_STARTERS, starterPromptsFor } from "@/lib/admin/copilot/capabilities";
import type { RecordedTurn } from "./fixtures";
import "@/components/admin/copilot/admin-copilot.css";

/**
 * The thread, drawn by the real renderer from recorded turns. A client
 * component because the proposal card takes its Confirm and Dismiss handlers,
 * which do nothing here: this is the proof of the look, never of a write.
 */
const PROPOSAL = {
  id: "preview-1",
  tool: "create_my_task",
  label: "Add a task to my list",
  summary: "Adds a task to follow up on the oldest listing tomorrow.",
  args: { title: "Follow up on the oldest waiting listing", dueDate: "2026-11-17", priority: "high" },
  mode: "act" as const,
  deskHref: "/admin/my-desk/tasks",
  token: "preview",
  expiresAt: "2026-11-16T10:00:00Z",
};

export function CopilotPreview({ turns }: { turns: readonly RecordedTurn[] }) {
  return (
    <div className="nf-copilot" data-variant="page">
      <div className="nf-copilot__bar">
        <p className="nf-copilot__hint">Console assistant</p>
      </div>

      <div className="nf-copilot-thread" data-testid="preview-thread">
        <div className="nf-copilot-row" data-role="assistant">
          <div className="nf-copilot-empty">
            <p className="nf-copilot-greeting">Hello Tunde. Ask me what needs you first today, or pick a question below.</p>
            <div className="nf-copilot-chips" role="group" aria-label="Suggested questions">
              {SUPER_ADMIN_STARTERS.map((prompt) => (
                <button key={prompt} type="button" className="nf-copilot-chip nf-tap">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {turns.map((turn) => (
          <div key={turn.key} data-testid={`preview-turn-${turn.key}`}>
            <div className="nf-copilot-row" data-role="user">
              <p className="nf-copilot-turn" data-role="user">
                {turn.asked}
              </p>
            </div>
            <div className="nf-copilot-row" data-role="assistant">
              <div className="nf-copilot-turn" data-role="assistant">
                <CopilotAnswer text={turn.answer} destinations={turn.destinations} testId={`preview-go-${turn.key}`} />
              </div>
              <p className="nf-caption">{turn.proves}</p>
            </div>
          </div>
        ))}

        <div className="nf-copilot-row" data-role="assistant">
          <div className="nf-copilot-turn" data-role="assistant">
            <CopilotAnswer text="I can add that to your own list. Nothing happens until you press Confirm." destinations={[]} />
          </div>
          <ProposalCard state={{ proposal: PROPOSAL, status: "pending" }} onConfirm={() => {}} onDismiss={() => {}} />
        </div>

        <p className="nf-copilot-status" role="status">
          <span className="nf-copilot-typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Reading the whole platform
        </p>
      </div>

      <p className="nf-caption mt-group">
        These chips are a super admin&apos;s. A support agent sees: {starterPromptsFor("support").join(", ")}.
      </p>
    </div>
  );
}
