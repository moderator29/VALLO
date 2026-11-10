"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import type { ProposalState } from "./use-copilot-chat";

/**
 * A SUGGESTED CHANGE, drawn as a card. It says in plain words what will
 * happen, shows the fields it will use, and offers Confirm, Edit in the desk
 * and Dismiss. Nothing has happened until Confirm is pressed. A draft (a
 * ticket reply or a case note) has no Confirm: it shows the text to copy.
 */
export function ProposalCard({
  state,
  onConfirm,
  onDismiss,
  onNavigate,
}: {
  state: ProposalState;
  onConfirm: () => void;
  onDismiss: () => void;
  onNavigate?: () => void;
}) {
  const { proposal, status } = state;
  const isDraft = proposal.mode === "draft";
  const text = typeof proposal.args.text === "string" ? proposal.args.text : null;
  const fields = Object.entries(proposal.args).filter(([key, value]) => value !== null && value !== "" && !(isDraft && key === "text"));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      banner.success("Draft copied. Read it, change it and send it from the desk.");
    } catch {
      banner.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  if (status === "dismissed") return null;

  return (
    <section className="nf-copilot-card" data-status={status} aria-label={proposal.label} data-testid="copilot-proposal">
      <p className="nf-copilot-card__label">{proposal.label}</p>
      <p className="nf-copilot-card__summary">{proposal.summary}</p>
      {fields.length > 0 ? (
        <dl className="nf-copilot-card__fields">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase()}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {isDraft && text ? <pre className="nf-copilot-card__draft">{text}</pre> : null}

      {status === "done" ? (
        <p className="nf-copilot-card__outcome" data-testid="copilot-proposal-done">
          {state.message ?? "Done."}{" "}
          {state.href ? (
            <Link href={state.href} className="nf-link" onClick={onNavigate}>
              Open it
            </Link>
          ) : null}
        </p>
      ) : status === "expired" ? (
        <p className="nf-copilot-card__outcome">This suggestion expired. Ask again, or make the change on the desk.</p>
      ) : (
        <div className="nf-copilot-card__actions">
          {isDraft ? (
            <Button type="button" variant="primary" size="sm" onClick={() => void copy()}>
              Copy draft
            </Button>
          ) : (
            <Button type="button" variant="primary" size="sm" onClick={onConfirm} disabled={status === "confirming" || status === "failed"} data-testid="copilot-confirm">
              {status === "confirming" ? "Working..." : "Confirm"}
            </Button>
          )}
          <Link href={proposal.deskHref} className="nf-btn nf-btn--secondary nf-btn--sm" onClick={onNavigate}>
            {isDraft ? "Open in the desk" : "Edit in the desk"}
          </Link>
          <Button type="button" variant="quiet" size="sm" onClick={onDismiss} disabled={status === "confirming"}>
            Dismiss
          </Button>
        </div>
      )}
      {status === "failed" && state.message ? <p className="nf-copilot-card__outcome">{state.message} You can make the change on the desk instead.</p> : null}
    </section>
  );
}
