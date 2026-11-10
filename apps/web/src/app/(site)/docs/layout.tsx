import { CHAPTER_INDEX } from "./chapters";
import { DocsSidebar } from "./DocsSidebar";
import { SiteHead } from "@/components/site/SiteHead";
import { DocShell } from "@/components/docs/DocShell";

/**
 * The documentation frame.
 *
 * A layout rather than a component on every page, so the chapter rail is
 * genuinely persistent: moving between chapters swaps the article and leaves
 * the navigation exactly where it was, which is the whole difference between a
 * documentation site and a pile of pages that happen to link to each other.
 *
 * The rail is handed the index, not the chapters themselves. `CHAPTER_INDEX` is
 * plain data, so the client component that needs the current pathname carries
 * the titles into the browser and not the entire document.
 *
 * `min-w-0` on the content column is load bearing. A flex child defaults to
 * `min-width: auto`, so one wide code span or one long reference would push the
 * column past the viewport and give the whole page a horizontal scroll at
 * 390px.
 */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* The plate carries the family name as a paragraph: every chapter under
          it, and the index, keeps its own h1. */}
      <SiteHead
        plate="bg-blue-wave"
        icon="listing-review"
        chip="Documentation"
        title="Vallo docs"
        heading="p"
      />
      <div className="nf-shell pb-section">
        <div className="mx-auto max-w-6xl">
          <DocShell section="Docs" home="/docs">
            <div className="flex flex-col gap-heading lg:flex-row lg:items-start lg:gap-block">
              <DocsSidebar items={CHAPTER_INDEX} />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </DocShell>
        </div>
      </div>
    </>
  );
}
