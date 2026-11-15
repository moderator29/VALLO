"use client";

import { ButtonLink } from "@/components/ui/Button";
import { splitDestinations, type Destination } from "@/lib/admin/copilot/destinations";
import { CopilotMarkdown } from "./markdown-lite";

/**
 * ONE ANSWER: the words, then the places to go.
 *
 * The copilot ends an answer by naming the pages it was talking about, each as
 * a marker (`destinations.ts`). A marker becomes a BUTTON only when its
 * address is one the tools handed back this turn, already filtered against
 * this person's own access on the server. Anything else the model writes
 * leaves its words behind in the sentence and nothing to press: no link, no
 * button, nothing that looks like a dead end.
 *
 * Used by the conversation and by the preview, so what a reviewer sees in the
 * preview is the same component the desk draws.
 */
export function CopilotAnswer({
  text,
  destinations = [],
  onNavigate,
  testId,
}: {
  text: string;
  /** The pages the tools offered this turn. A marker outside this list is plain words. */
  destinations?: readonly Destination[];
  onNavigate?: () => void;
  testId?: string;
}) {
  const { prose, destinations: offered } = splitDestinations(text, destinations);
  return (
    <>
      <CopilotMarkdown text={prose} {...(onNavigate ? { onNavigate } : {})} />
      {offered.length > 0 ? (
        <nav className="nf-copilot-go" aria-label="Where to go next" data-testid={testId ?? "copilot-destinations"}>
          {offered.map((link) => (
            <ButtonLink
              key={link.href}
              href={link.href}
              variant="secondary"
              size="sm"
              trailingIcon="arrow-right"
              className="nf-copilot-go__btn nf-tap"
              onClick={onNavigate}
              data-testid="copilot-destination"
            >
              {link.label}
            </ButtonLink>
          ))}
        </nav>
      ) : null}
    </>
  );
}
