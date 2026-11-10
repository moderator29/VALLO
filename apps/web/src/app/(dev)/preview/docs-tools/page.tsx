import { DocShell } from "@/components/docs/DocShell";
import { DocHelpful } from "@/components/docs/DocHelpful";
import { CopyButton } from "@/components/docs/CopyButton";
import { DocFlow } from "@/components/docs/DocFlow";
import { StepPlayer } from "@/app/(site)/guides/StepPlayer";
import { guideBySlug } from "@/lib/guides/articles";
import { RENT_PAYMENT_NOT_OPEN } from "@/lib/money/copy";
import { SUPPORT_EMAIL } from "@/lib/support-email";

/**
 * The documentation tools, drawn for screenshots in both themes at 390 and
 * 360 (DOCS_AND_PRESENCE_UPGRADE.md 4.6 and section 11). Real content only:
 * the how-to-list guide's own steps, the one support address. "Was this
 * helpful?" is drawn directly here; on the public pages it waits for the
 * desk's table (supabase/migrations/pending/docs_page_feedback_2026-11-10.sql),
 * so a press here reports that the answer could not be saved.
 */
export default function DocsToolsPreview() {
  const guide = guideBySlug("how-to-list");
  return (
    <DocShell section="Documentation" sectionHref="/docs">
      <p className="flex flex-wrap items-center gap-2xs">
        <span>Email us at</span>
        <span className="nf-doc-xlink">{SUPPORT_EMAIL}</span>
        <CopyButton text={SUPPORT_EMAIL} label="Email address" />
      </p>
      {guide ? (
        <StepPlayer
          label="Walk through the listing"
          icon="key"
          steps={guide.sections.map((s) => ({
            id: s.id,
            title: s.title,
            text: s.blocks.find((b): b is string => typeof b === "string") ?? "",
            shot: s.shot,
          }))}
        />
      ) : null}
      <DocFlow
        label="From viewing to agreed terms"
        steps={[
          { icon: "calendar-check", title: "View the place", href: "/docs/viewings", outcome: "Money moves only after you have seen the place and decided." },
          { icon: "clipboard-list", title: "Submit the inspection report", outcome: "It records what you saw and when." },
          { icon: "file-check", title: "Confirm the agreement", href: "/agreements", outcome: "You and the owner or agent each confirm the same version." },
        ]}
        end={RENT_PAYMENT_NOT_OPEN}
      />
      <DocHelpful page="/docs/what-vallo-costs" />
    </DocShell>
  );
}
