import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { BADGE_ICON, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type BadgeKind } from "@/lib/features/roommates/model";

const TIP_ICON: UiIconName[] = ["eye", "user-check", "file-text", "banknote", "location", "chat-bubble"];
const BADGES: BadgeKind[] = ["identity", "phone", "student_email", "student_id", "nysc", "workplace"];
const CIRCLES = [
  { href: "/circle/c/finding-roommates", icon: "users" as const },
  { href: "/circle/c/student-accommodation", icon: "id-card" as const },
  { href: "/circle/c/nysc-accommodation", icon: "certificate" as const },
];

export function SafetyView({ copy }: { t: RoommatesCopy }) {
  return (
    <PageFrame title={copy.safety.title} subtitle={copy.ui.safety.subtitle} fallback={ROOMMATES_ROUTES.home} width="default">
      <div className="nf-rmp" data-testid="roommates-safety">
        <ol className="nf-rms-list">
          {copy.safety.tips.map((tip, i) => (
            <li key={tip} className="nf-rms-item">
              <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
                <UiIcon name={TIP_ICON[i] ?? "shield-check"} size={24} />
              </span>
              <span className="nf-rms-item__words">
                <span className="nf-rms-item__n">{String(i + 1).padStart(2, "0")}</span>
                <span className="nf-rms-item__text">{tip}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="nf-rm-panel" aria-labelledby="rms-badges">
          <h2 id="rms-badges" className="nf-rm-panel__title">
            {copy.ui.safety.verifyTitle}
          </h2>
          <p className="nf-rm-panel__sub">{copy.verification.honest}</p>
          <ul className="nf-rm-badges">
            {BADGES.map((b) => (
              <li key={b} className="nf-rm-badge">
                <UiIcon name={BADGE_ICON[b]} size={14} />
                {copy.verification.kinds[b]}
              </li>
            ))}
          </ul>
          <div>
            <ButtonLink href={ROOMMATES_ROUTES.verify} variant="primary" size="md" leadingIcon="shield-check">
              {copy.ui.safety.verifyCta}
            </ButtonLink>
          </div>
        </section>

        <section className="nf-rm-panel" aria-labelledby="rms-report">
          <h2 id="rms-report" className="nf-rm-panel__title">
            {copy.ui.safety.reportTitle}
          </h2>
          <p className="nf-rm-panel__sub">{copy.ui.safety.reportBody}</p>
          <p className="nf-rms-emergency">
            <UiIcon name="phone" size={18} />
            {copy.ui.safety.emergency}
          </p>
        </section>

        <section className="nf-rm-section" aria-labelledby="rms-circle">
          <h2 id="rms-circle" className="nf-rm-section__title">
            {copy.ui.safety.circleTitle}
          </h2>
          <ul className="nf-rmp-schools">
            {CIRCLES.map((c, i) => (
              <li key={c.href}>
                <Link href={c.href} className="nf-rmp-school">
                  <span className="nf-rm-plate" aria-hidden="true">
                    <UiIcon name={c.icon} size={20} />
                  </span>
                  <span className="nf-rmp-school__words">
                    <span className="nf-rmp-school__name">{copy.ui.safety.circles[i]}</span>
                  </span>
                  <UiIcon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageFrame>
  );
}
