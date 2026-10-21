import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { InspectionHero, InspectionSheet } from "@/components/app/inspections/InspectionSheet";
import { INSPECTION, INSPECTION_FACTS } from "../fixtures";

/** F6A8A482: one inspection, as the requester sees it, expanded. */
export const dynamic = "force-dynamic";

export default async function PreviewInspection() {
  const locale = await getLocale();
  return (
    <div className="nf-shell py-section-tight">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Inspections" fallback="/home" />
        <InspectionHero title="inspection" sub="Check the property, confirm the details, record how it went." />
        <InspectionSheet inspection={INSPECTION} side="requester" facts={INSPECTION_FACTS} locale={locale} open viewingCopy={getDictionary(locale).threads.rental} flowCopy={getDictionary(locale).memberFlows.inspection} />
      </div>
    </div>
  );
}
