import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocTable } from "@/components/docs/DocTable";
import { DocCallout, DocHeader, DocSection, DocSummary } from "@/components/docs/DocArticle";
import { DocToc } from "@/components/docs/DocToc";
import { DocHelpPanel, DocShell } from "@/components/docs/DocShell";

/**
 * The documentation kit, every part on one page, for screenshots in both
 * themes at 390 and 360 (DOCS_AND_PRESENCE_UPGRADE.md section 11). Sample
 * words only; the real documents move onto these parts page by page.
 */
export default function DocsKitPreview() {
  return (
    <DocShell section="Legal" sectionHref="/legal">
      <DocHeader
        category={{ icon: "scale", label: "Legal" }}
        title="Payouts and refunds"
        updated="2026-11-09"
        related={[
          { href: "/cancellations", label: "Cancellations" },
          { href: "/terms", label: "Terms of use" },
        ]}
      >
        <p>How the money from a booking reaches a host, and how a refund comes back to a guest.</p>
      </DocHeader>
      <DocSummary
        items={[
          "Card payments are processed by Paystack and split at the moment of payment.",
          "Vallo never holds your money.",
          "A refund goes back to the card you paid with.",
        ]}
      />
      <DocToc
        sections={[
          { id: "states", title: "What each state means" },
          { id: "protected", title: "Protected payment" },
        ]}
      />
      <DocSection id="states" number={1} title="What each state means">
        <DocTable
          caption="Payout states"
          columns={[
            { key: "state", label: "State", kind: "state" },
            { key: "means", label: "What it means" },
            { key: "out", label: "In your bank?", kind: "yesno" },
          ]}
          rows={[
            { id: "c", icon: "hourglass", cells: { state: { state: "Clearing", tone: "pending" }, means: "The card payment is clearing at the processor.", out: { yes: false } } },
            { id: "s", icon: "bank", cells: { state: { state: "Settling", tone: "active" }, means: "Your share is on its way to the bank on your payout details.", out: { yes: false } } },
            { id: "p", icon: "circle-check", cells: { state: { state: "Paid", tone: "success" }, means: "The money is in your bank account.", out: { yes: true } } },
            { id: "r", icon: "circle-x", cells: { state: { state: "Reversed", tone: "danger" }, means: "The payer's bank reversed the payment.", out: { yes: false } } },
          ]}
        />
      </DocSection>
      <DocSection id="protected" number={2} title="Protected payment">
        <DocCallout tone="not-live" title="Not live yet">
          Protected payment through a licensed bank is built and switched off. Today every payment is by card.
        </DocCallout>
      </DocSection>
      <DocCardGrid label="Related documents">
        <DocCard href="/terms" icon="file-text" title="Terms of use" description="The rules for using Vallo, in plain words." />
        <DocCard href="/privacy" icon="shield-lock" title="Privacy policy" description="What we collect, why, and how to have it removed." />
      </DocCardGrid>
      <DocHelpPanel />
    </DocShell>
  );
}
