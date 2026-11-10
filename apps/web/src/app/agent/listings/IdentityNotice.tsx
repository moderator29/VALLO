import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ListerIdentityStatus } from "@/lib/verification/lister-identity";

/**
 * "Verify your identity to publish" (founder, 10 November 2026). A lister can
 * draft and send a listing for review without being verified, but it is
 * approved only once their identity is. Said at the top of the workspace, with
 * the way into the existing verification flow.
 */
const WORDS: Record<Exclude<ListerIdentityStatus, "approved">, { title: string; body: string; action: string }> = {
  none: {
    title: "Verify your identity to publish",
    body: "You can keep drafting and send listings for review. They go live once your identity is approved.",
    action: "Verify your identity",
  },
  failed: {
    title: "Your ID check did not pass",
    body: "Send a new ID so your listings can go live. Drafts and listings in review are kept.",
    action: "Send a new ID",
  },
  pending: {
    title: "Your ID is waiting for review",
    body: "Your listings can be reviewed now and go live once your identity is approved.",
    action: "See your verification",
  },
};

export function IdentityNotice({ status }: { status: ListerIdentityStatus }) {
  if (status === "approved") return null;
  const words = WORDS[status];
  return (
    <div className="nf-agent-identity" data-testid="lister-identity-notice" data-status={status} role="note">
      <UiIcon name="info" size={20} />
      <div>
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{words.title}</p>
        <p className="nf-caption text-[var(--nf-content-muted)]">{words.body}</p>
      </div>
      <ButtonLink href="/verification" variant={status === "pending" ? "secondary" : "primary"} size="sm">
        {words.action}
      </ButtonLink>
    </div>
  );
}
