import Link from "next/link";
import type { Dictionary } from "@vallo/i18n";
import type { MyBusiness, MyBusinessLadder } from "@/lib/host/queries";
import type { ResolvedProfileSettings } from "@/lib/profile/model";
import { Row, RowList, Section, Stack, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PageFrame } from "@/components/app/PageFrame";
import { BusinessTierFan } from "@/components/app/artefact/BusinessTierFan";
import { AccountNotificationsCard } from "../../(app)/settings/AccountToggles";
import { forAccountToggles } from "@/lib/i18n/slice";

/**
 * The body of /host/settings, apart from its reads, so a harness can draw it
 * from fixtures. Nothing here fetches anything.
 */
export function HostSettingsBody({
  t,
  businesses,
  ladders = [],
  notifications,
}: {
  t: Dictionary;
  businesses: MyBusiness[];
  /** Each business's ladder, in the same order, or null where the read failed. */
  ladders?: (MyBusinessLadder | null)[];
  /** Null when the preference document could not be read. */
  notifications: ResolvedProfileSettings["notifications"] | null;
}) {
  const words = t.experienceHost;
  const page = words.settingsPage;
  return (
    /* The Grade 1 page frame: the large title with Back and its line. */
    <PageFrame title={page.title} subtitle={page.sub} fallback="/host">
      <Stack>
        <Section title={t.hostWorkspace.settings.businessesTitle}>
          {businesses.length === 0 ? (
            <div className="nf-panel nf-panel--card p-panel">
              <p className={TYPE.rowMeta}>{t.hostWorkspace.nothingYet.settings}</p>
              <div className="mt-sm">
                <ButtonLink href="/profile/setup?side=stays" variant="secondary" size="sm">
                  {t.hostWorkspace.doors.startApplication}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <RowList boxed>
              {businesses.map((business) => (
                <Row key={business.id} className="flex-col items-stretch gap-xs py-md">
                  <div className="grid gap-2xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-sm">
                    <span className="min-w-0">
                      <span className={`block ${TYPE.rowTitle}`}>{business.name}</span>
                      <span className={`block ${TYPE.rowMeta}`}>
                        {page.kindTier
                          .replace("{kind}", words.businessKind[business.kind as keyof typeof words.businessKind] ?? business.kind)
                          .replace("{tier}", String(business.verificationTier))}
                      </span>
                    </span>
                    <StatusPill
                      tone={toneForStatus(business.status)}
                      className="justify-self-start sm:justify-self-end"
                    >
                      {words.businessStatus[business.status as keyof typeof words.businessStatus] ?? business.status}
                    </StatusPill>
                  </div>
                  <div className="flex flex-wrap gap-inline">
                    {business.kind === "restaurant" ? (
                      <Link href="/host/reservations" className="nf-chip">
                        {words.businessDoors.tables}
                      </Link>
                    ) : (
                      <Link href={`/host/rooms?business=${business.id}`} className="nf-chip">
                        {words.businessDoors.rooms}
                      </Link>
                    )}
                    <Link href={`/host/photos?business=${business.id}`} className="nf-chip">
                      {words.businessDoors.photos}
                    </Link>
                    {business.kind !== "restaurant" && (
                      <Link href={`/host/arrival?business=${business.id}`} className="nf-chip">
                        {words.businessDoors.arrival}
                      </Link>
                    )}
                    <Link href="/host/transfer" className="nf-chip">
                      {words.businessDoors.handOver}
                    </Link>
                  </div>
                </Row>
              ))}
            </RowList>
          )}
        </Section>

        {ladders.some(Boolean) ? (
          <Section title={t.experienceFeatures.trustTiers.selector}>
            <div className="grid gap-lg">
              {ladders.map((ladder) =>
                ladder ? (
                  <div key={ladder.businessId} className="grid gap-xs">
                    {ladders.filter(Boolean).length > 1 ? <p className={TYPE.rowTitle}>{ladder.name}</p> : null}
                    <BusinessTierFan ladder={ladder} businessName={ladder.name} t={t} />
                  </div>
                ) : null,
              )}
            </div>
          </Section>
        ) : null}

        {notifications ? (
          <AccountNotificationsCard t={forAccountToggles(t)} initial={notifications} variant="host" />
        ) : (
          <div className="nf-panel nf-panel--card p-panel">
            <p className={TYPE.rowMeta}>{page.notificationsUnreachable}</p>
          </div>
        )}

        <Link href="/host/assistant" className="nf-panel nf-panel--card nf-host-choice">
          <span className="nf-host-choice__mark" aria-hidden="true">
            <UiIcon name="bot" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block ${TYPE.rowTitle}`}>{page.assistantTitle}</span>
            <span className={`block ${TYPE.rowMeta}`}>{page.assistantSub}</span>
          </span>
          <UiIcon name="chevron-right" size={20} className="shrink-0 text-[var(--nf-content-muted)]" />
        </Link>

        <div className="nf-panel nf-panel--card block p-panel">
          <p className="nf-overline">{page.elseLabel}</p>
          <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
            {page.elseBody}
          </p>
          <Link href="/settings" className="nf-btn nf-btn--glass nf-btn--sm mt-md">
            {page.elseOpen}
          </Link>
        </div>
      </Stack>
    </PageFrame>
  );
}
