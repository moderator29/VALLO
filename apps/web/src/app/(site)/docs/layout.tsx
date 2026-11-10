import { CHAPTER_INDEX } from "./chapters";
import { DocsSidebar } from "./DocsSidebar";
import { DocShell } from "@/components/docs/DocShell";

/**
 * The documentation frame, on the kit (DOCS_AND_PRESENCE_UPGRADE.md 2.1 and
 * 4.1): the shell's bar (the Vallo mark, "Documentation", the search sheet)
 * over every chapter and the contents page, so a reader knows they are in
 * the written part of the platform and can search from anywhere in it. The
 * public site's back bar above already draws Back, so the shell does not.
 *
 * A layout rather than a component on every page, so the chapter rail is
 * genuinely persistent on a wide screen: moving between chapters swaps the
 * article and leaves the navigation where it was.
 *
 * The rail is handed the index, not the chapters themselves. `CHAPTER_INDEX` is
 * plain data, so the client component that needs the current pathname carries
 * the titles into the browser and not the entire document.
 *
 * `min-w-0` on the content column is load bearing. A flex child defaults to
 * `min-width: auto`, so one wide code span or one long reference would push the
 * column past the viewport and give the whole page a horizontal scroll at
 * 360px.
 */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DocShell section="Documentation" sectionHref="/docs" back={false} wide>
      <div className="flex flex-col gap-heading lg:flex-row lg:items-start lg:gap-block">
        <DocsSidebar items={CHAPTER_INDEX} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </DocShell>
  );
}
