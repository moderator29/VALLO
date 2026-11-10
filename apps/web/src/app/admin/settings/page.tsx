import Link from "next/link";
import { IconPlate } from "@/components/ui/IconPlate";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { NavIcon } from "../_components/AdminGlyph";
import { PageHead, Panel } from "../_components/panels";
import { ADMIN_SETTINGS, labelFor } from "../_components/nav";
import { SampleEmails } from "./SampleEmails";
import { CONTACT_EMAIL } from "@/lib/support-email";

/**
 * Settings, the row the renders pin to the rail's foot.
 *
 * The console had no settings page: the platform's own configuration lived
 * in three desks reachable only from a band of the old rail. This page is
 * their door, so the rail can carry the renders' twelve rows and still reach
 * every one of them. It reads nothing; each desk reads and writes its own.
 */
const LEDES: Record<string, string> = {
  switches: "Turn a surface of the product off in an incident, and back on. Every change is written to the audit log.",
  reference: "The occupations and local governments every profile picks from.",
  examples: "The example listings that show the product before real supply arrives, and the date each is due to retire.",
  /* The three doors that had no line, so three of the six rows read as a
     different kind of row (C1 sweep). Each line is what its desk says of
     itself: the staff desk's lede, the handbook's docstring, the help route. */
  staff: "Who holds access to which desks. Only the founder's super admin account can change it.",
  handbook: "What every staff member reads and acknowledges before any desk unlocks.",
  help: "The help centre and support, as a member reaches them.",
};

export default async function AdminSettingsPage() {
  const shell = getDictionary(await getLocale()).admin.shell;
  return (
    <div className="nf-admin-stack">
      <PageHead title={shell.settings.title} lede={shell.settings.lede} />
      <div className="nf-admin-grid nf-admin-grid--halves">
        {(ADMIN_SETTINGS.children ?? []).map((desk) => (
          <Panel key={desk.key}>
            <Link href={desk.href} className="nf-admin-hub">
              <IconPlate tone="brand" size="md">
                <NavIcon icon={desk.icon} size={24} />
              </IconPlate>
              <span className="nf-admin-hub__text">
                <span className="nf-admin-panel__title">{labelFor(desk, shell)}</span>
                {LEDES[desk.key] && <span className="nf-admin-hub__lede">{LEDES[desk.key]}</span>}
              </span>
              {/* shrink-0: beside a two-line lede the chevron was squeezed to a sliver. */}
              <UiIcon name="chevron-right" size={20} className="shrink-0" />
            </Link>
          </Panel>
        ))}
      </div>
      {/* The founder's own check of how every email looks: marked samples only. */}
      <Panel>
        <span className="nf-admin-panel__title">See every email</span>
        <p className="nf-body-sm mb-sm text-[var(--nf-content-secondary)]">
          Sends about 30 sample emails, one or more of every design, each marked Sample, to the addresses you write. Founder only. No member is emailed.
        </p>
        <SampleEmails initial={CONTACT_EMAIL} />
      </Panel>
    </div>
  );
}
