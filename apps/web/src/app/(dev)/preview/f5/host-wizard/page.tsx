import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostWizard } from "@/components/host/HostWizard";
import { emptyHostDraft } from "@/lib/host/onboarding";
import { PERSON } from "../../_fixtures/people";

/** The Host wizard on its first step, from an empty draft. Nothing writes until Next. */
export const dynamic = "force-dynamic";

export default async function PreviewHostWizard() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false}>
      <HostWizard
        initial={{ ...emptyHostDraft(), hostType: "business", kind: "hotel" }}
        userId={PERSON.id}
        policies={[
          {
            id: "00000000-0000-4000-8000-00000000e001",
            name: "Flexible",
            summary: "Free until 24 hours before",
            isFreeUntilHours: 24,
          },
        ]}
        locale={locale}
      />
    </HostShell>
  );
}
