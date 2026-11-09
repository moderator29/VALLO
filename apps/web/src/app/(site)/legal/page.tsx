import type { Metadata } from "next";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocHelpPanel, DocShell } from "@/components/docs/DocShell";
import { formatDocDate } from "@/components/docs/DocArticle";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Legal and policies",
  description: "The terms, policies and standards that govern Vallo, each one dated and in plain words.",
  alternates: { canonical: "/legal" },
};

/**
 * THE LEGAL INDEX (DOCS_AND_PRESENCE_UPGRADE.md 2.2): every document as a
 * card a nervous reader can scan in seconds, a paragraph saying what Vallo is
 * and what the documents cover, and a person one tap away. Public, signed out
 * included: a visitor can read every policy before creating an account.
 */
export default function LegalIndexPage() {
  return (
    <DocShell section="Legal" sectionHref="/legal" back={false} wide>
      <header className="grid gap-sm">
        <h1 className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-title-lg)] font-bold leading-tight">
          Legal and policies
        </h1>
        <p className="max-w-measure-body text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
          Vallo is a marketplace for homes to rent and buy, shortlets, hotels and restaurant tables in Nigeria. These
          documents say how the platform works, how we keep the community safe, and your rights and responsibilities as a
          renter, guest, buyer, owner, agent or host. Each one shows the date it last changed.
        </p>
      </header>
      <DocCardGrid label="Documents">
        {LEGAL_DOCUMENTS.map((doc) => (
          <DocCard
            key={doc.href}
            href={doc.href}
            icon={doc.icon}
            title={doc.title}
            description={doc.description}
            meta={doc.updated ? `Updated ${formatDocDate(doc.updated)}` : undefined}
          />
        ))}
      </DocCardGrid>
      <DocHelpPanel />
    </DocShell>
  );
}
