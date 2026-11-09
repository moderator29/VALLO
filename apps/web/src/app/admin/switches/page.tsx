import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { getFeatureFlags } from "@/lib/admin/queries";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { SwitchRow } from "./SwitchRow";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.switches.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function AdminSwitchesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.switches;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const flags = await getFeatureFlags();

  return (
    <div className="nf-console">
      <PageHead title={copy.title} lede={copy.lede} />

      <p className="nf-panel nf-panel--card nf-admin-card mb-md flex gap-xs p-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        {/*
          NOT A BELL, AND NOT THE PENDING COLOUR.

          Same defect F2-057 names on `QueueUnavailable` and `CheckRow`, on a
          third object in the same console. `--nf-state-warning` resolves to
          `--nf-cyan-400`, which is the token `--nf-status-pending` is defined
          as, so a standing note about what these controls do was painted in the
          colour this product reserves for "still going through". And a bell
          means "you have a notification" everywhere else on the platform.

          NOT ROSE EITHER, which was the other candidate. Nothing here has
          failed and nothing is in flight: it is a note about the consequence of
          a control the operator has not touched yet. Painting it as an error
          would cry wolf on a screen an operator opens every day. The weight is
          in the sentence, which says the surface goes away from everyone
          immediately, and `info` is the glyph that means exactly this.
        */}
        <UiIcon name="info" size={16} className="mt-3xs shrink-0 text-[var(--nf-content-secondary)]" />
        <span>{copy.warning}</span>
      </p>

      {flags.state !== "ok" ? (
        <ui.QueueUnavailable />
      ) : (
        <ul className="nf-queue-list">
          {flags.data.map((flag) => (
            <SwitchRow key={flag.key} flag={flag} copy={copy} common={common} ui={ui} />
          ))}
        </ul>
      )}
    </div>
  );
}
