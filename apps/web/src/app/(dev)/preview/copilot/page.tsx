import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AdminFrame } from "@/app/admin/_components/AdminFrame";
import { PageHead } from "@/app/admin/_components/panels";
import { CopilotPreview } from "./CopilotPreview";
import { RECORDED, RECORDED_KEYS } from "./fixtures";

/**
 * THE COPILOT'S ANSWERS, FROM RECORDED TOOL RESULTS.
 *
 * The real renderer (`CopilotAnswer`), the real buttons, the real proposal
 * card and the real chips, on the console's own frame, fed answers written out
 * by hand with the destinations a tool would have returned for that person.
 * Nothing is fetched and no key is needed, so the look can be checked at 390px
 * and at desktop without a model behind it.
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
  const locale = await getLocale();
  const t = getDictionary(locale);
  const picked = only ? RECORDED.filter((turn) => turn.key === only) : RECORDED;

  return (
    <AdminFrame
      identity={{ name: "Example Operator", role: t.admin.shell.bar.owner, initial: "E", avatarUrl: null, tier: null }}
      counts={{ escalations: 1, listings: 7, alerts: 2 }}
      unread={0}
      navLabel={t.admin.console.navLabel}
      navLabels={t.admin.nav}
      searchLabel={t.admin.common.searchLabel}
      bellLabel={t.uiCommon.console.notifications}
      shell={t.admin.shell}
      experience={{ palette: t.experienceAdmin.palette, deskLedes: t.experienceAdmin.deskLedes, waitingTotal: t.experienceAdmin.shell.waitingTotal }}
    >
      <div className="nf-console" data-testid="preview-copilot">
        <PageHead
          title="Copilot answers"
          lede="Recorded tool results, drawn by the real renderer. A destination becomes a button only when a tool returned it; anything else stays plain words."
        />
        <nav aria-label="Preview answers" className="mb-block flex flex-wrap gap-xs">
          <Link href="/preview/copilot" className="nf-btn nf-btn--glass nf-btn--sm" aria-current={only ? undefined : "page"}>
            all
          </Link>
          {RECORDED_KEYS.map((key) => (
            <Link key={key} href={`/preview/copilot?only=${key}`} className="nf-btn nf-btn--glass nf-btn--sm" aria-current={only === key ? "page" : undefined}>
              {key}
            </Link>
          ))}
        </nav>
        <CopilotPreview turns={picked.length > 0 ? picked : RECORDED} />
      </div>
    </AdminFrame>
  );
}
