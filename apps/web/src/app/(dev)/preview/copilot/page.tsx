import { PageHead } from "@/app/admin/_components/panels";
import { CopilotPreview } from "./CopilotPreview";
import { RECORDED } from "./fixtures";

/**
 * THE COPILOT'S ANSWERS, FROM RECORDED TOOL RESULTS.
 *
 * The real renderer (`CopilotAnswer`), the real buttons, the real proposal
 * card and the real chips, fed answers written out by hand with the
 * destinations a tool would have returned for that person. Nothing is fetched
 * and no key is needed, so the look can be checked at 390px and at desktop
 * without a model behind it.
 *
 *   /preview/copilot        every recorded answer, one after another
 *   ?only=<key>             one of them: desk, where, invented, super, handbook, unread
 *
 * The one to look at is `invented`: the Staff desk was never returned by a
 * tool for that person, so the copilot's own words for it stay plain text with
 * nothing to press, while Escalations is a button.
 */
export const dynamic = "force-dynamic";

export default async function PreviewCopilot({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  const { only } = await searchParams;
  const picked = only ? RECORDED.filter((turn) => turn.key === only) : RECORDED;

  return (
    <div className="nf-console" data-testid="preview-copilot">
      <PageHead
        title="Copilot answers"
        lede="Recorded tool results, drawn by the real renderer. A destination becomes a button only when a tool returned it; anything else stays plain words."
      />
      <CopilotPreview turns={picked.length > 0 ? picked : RECORDED} />
    </div>
  );
}
