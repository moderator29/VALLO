"use client";

import Link from "next/link";
import { COPILOT_LIMITS, type DeskCapability } from "@/lib/admin/copilot/capabilities";
import "./admin-copilot.css";

/** Ask the page's conversation something, from outside it. The chat listens for this event. */
export const COPILOT_ASK_EVENT = "vallo:copilot-ask";

/**
 * "WHAT I CAN DO FOR YOU", by desk, with example prompts that start the
 * conversation, and the limits stated plainly. It lists only the desks the
 * person holds; the server decides that and passes the list in.
 */
export function CopilotCapabilities({ desks }: { desks: readonly DeskCapability[] }) {
  const ask = (prompt: string) => window.dispatchEvent(new CustomEvent(COPILOT_ASK_EVENT, { detail: prompt }));
  return (
    <aside className="nf-copilot-can" aria-labelledby="copilot-can-title" data-testid="copilot-capabilities">
      <h2 id="copilot-can-title" className="nf-h3">
        What I can do for you
      </h2>
      <div className="nf-copilot-can__grid">
        {desks.map((desk) => (
          <section key={desk.key} className="nf-copilot-can__desk" aria-label={desk.desk}>
            <h3>
              <Link href={desk.href} className="nf-link">
                {desk.desk}
              </Link>
            </h3>
            <ul>
              {desk.can.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="nf-copilot-can__prompts" role="group" aria-label={`Try asking about ${desk.desk}`}>
              {desk.prompts.map((prompt) => (
                <button key={prompt} type="button" className="nf-copilot-chip nf-tap" onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section aria-labelledby="copilot-limits-title" data-testid="copilot-limits">
        <h2 id="copilot-limits-title" className="nf-h3">
          What I will not do
        </h2>
        <ul className="nf-copilot-limits">
          {COPILOT_LIMITS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
