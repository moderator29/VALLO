import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../../../_components/panels";
import { DocCrossLink } from "@/components/docs/DocCrossLink";
import { DocHeader } from "@/components/docs/DocHeader";
import { DocShell } from "@/components/docs/DocShell";
import { DocSummary } from "@/components/docs/DocSummary";
import { DocToc } from "@/components/docs/DocToc";
import { WasThisHelpful } from "@/components/docs/WasThisHelpful";
import { MANUAL_PAGES, manualBySlug } from "../manual-content";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return MANUAL_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = manualBySlug(slug);
  return { title: page ? `${page.title} (staff manual)` : "Staff manual", robots: { index: false, follow: false } };
}

/** One page of the staff manual, on the documentation kit. */
export default async function ManualPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = manualBySlug(slug);
  if (!page) notFound();
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div className="nf-console" data-testid="staff-manual-page">
      <DocShell
        section="Staff manual"
        home="/admin/handbook/manual"
        search={false}
        crumbs={[{ label: "Handbook", href: "/admin/handbook" }, { label: "Manual", href: "/admin/handbook/manual" }, { label: page.title }]}
      >
        <div className="nf-dk-layout" data-toc="true">
          <div className="nf-dk-layout__main">
            <DocHeader category="Staff manual" categoryIcon={page.icon} title={page.title} updated={page.updated}>
              <p>{page.summary}</p>
              <p>
                Desks covered:{" "}
                {page.desks.map((desk, index) => (
                  <span key={desk.href}>
                    {index > 0 ? ", " : ""}
                    <DocCrossLink href={desk.href}>{desk.label}</DocCrossLink>
                  </span>
                ))}
              </p>
            </DocHeader>
            <DocSummary points={page.glance} />
            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="nf-dk-section">
                <h2 className="nf-h3">{section.heading}</h2>
                <div className="nf-dk-prose">{section.body}</div>
              </section>
            ))}
            <WasThisHelpful path={`/admin/handbook/manual/${page.slug}`} title={page.title} />
          </div>
          <aside className="nf-dk-layout__aside">
            <DocToc items={page.sections.map((s) => ({ id: s.id, heading: s.heading }))} />
          </aside>
        </div>
      </DocShell>
    </div>
  );
}
