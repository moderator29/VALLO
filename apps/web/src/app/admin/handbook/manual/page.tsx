import type { Metadata } from "next";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../../_components/panels";
import { DocCards } from "@/components/docs/DocCard";
import { DocShell } from "@/components/docs/DocShell";
import { MANUAL_PAGES } from "./manual-content";

export const metadata: Metadata = { title: "Staff manual", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE STAFF MANUAL, INDEX. One card per page, on the same kit as the member
 * documentation. Behind the console: the admin layout decides access, and this
 * page asks the guard again so it never renders for a non-console visitor.
 */
export default async function ManualIndexPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div className="nf-console" data-testid="staff-manual">
      <PageHead
        title="Staff manual"
        lede="What each desk is for, who gets in, how to work it, what you may decide alone and what is logged. It sits beside the handbook you acknowledged, which is what staff agreed to."
      />
      <DocShell section="Staff manual" home="/admin/handbook/manual" search={false} crumbs={[{ label: "Handbook", href: "/admin/handbook" }, { label: "Manual" }]}>
        <DocCards
          label="Staff manual pages"
          items={MANUAL_PAGES.map((page) => ({
            href: `/admin/handbook/manual/${page.slug}`,
            title: page.title,
            line: page.summary,
            icon: page.icon,
          }))}
        />
      </DocShell>
    </div>
  );
}
