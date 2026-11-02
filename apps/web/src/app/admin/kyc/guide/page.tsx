import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { DeskHead, Panel } from "../../_review/parts";
import { REVIEW_CHECKLIST } from "../IdentityAtAGlance";
import { GUIDE_INTRO, GUIDE_SECTIONS } from "./guide-content";
import "../../_review/review.css";

export const metadata: Metadata = {
  title: "Reviewer guide",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * THE REVIEWER GUIDE, for the people who hold `kyc_review` (KYC reviewer,
 * Trust and Safety lead, Compliance officer) and admins. Nobody else opens it:
 * it describes what the desk looks for, which is not something to publish.
 */
export default async function ReviewerGuidePage() {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <DeskHead title="Reviewer guide" sub="Your account cannot open this. It is for the verification team." />
      </div>
    );
  }

  return (
    <div className="nf-console" data-testid="reviewer-guide">
      <DeskHead
        title="How we verify people"
        sub={GUIDE_INTRO}
        trail={
          <Link href="/admin/kyc" className="text-[length:var(--nf-text-body-sm)] font-semibold underline">
            Back to the verification desk
          </Link>
        }
      />

      <nav aria-label="Sections of the guide" className="mb-block flex flex-wrap gap-xs">
        {GUIDE_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="nf-badge">
            {section.title}
          </a>
        ))}
      </nav>

      <div className="grid gap-block">
        <Panel title="The checklist on every person" labelledBy="guide-checklist">
          <ol className="list-decimal space-y-2xs p-md pl-xl text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
            {REVIEW_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </Panel>

        {GUIDE_SECTIONS.map((section) => {
          const List = section.ordered ? "ol" : "ul";
          return (
            <section key={section.id} id={section.id} className="scroll-mt-xl">
              <Panel title={section.title} labelledBy={`guide-${section.id}`}>
                <div className="p-md">
                  {section.lede ? (
                    <p className="mb-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">{section.lede}</p>
                  ) : null}
                  <List
                    className={`${section.ordered ? "list-decimal" : "list-disc"} space-y-2xs pl-lg text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]`}
                  >
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </List>
                </div>
              </Panel>
            </section>
          );
        })}
      </div>
    </div>
  );
}
