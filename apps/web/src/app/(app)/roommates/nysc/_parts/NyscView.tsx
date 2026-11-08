import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { SectionHead, STATE_OPTIONS, fill, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";

const CIRCLE_NYSC = "/circle/c/nysc-accommodation";

export function NyscView({ copy }: { t: RoommatesCopy }) {
  return (
    <PageFrame title={copy.nysc.title} subtitle={copy.nysc.intro} fallback={ROOMMATES_ROUTES.home} width="wide">
      <div className="nf-rmp" data-testid="roommates-nysc-page">
        <section className="nf-rm-section" aria-labelledby="rmn-state">
          <SectionHead id="rmn-state" title={copy.nysc.state} />
          <p className="nf-rm-panel__sub">{copy.ui.nysc.pick}</p>
          <ul className="nf-rmn-states">
            {STATE_OPTIONS.map((s) => (
              <li key={s.code}>
                <Link href={`${ROOMMATES_ROUTES.discover}?who=corps_member&state=${s.code}`} className="nf-rmn-state" aria-label={fill(copy.ui.nysc.people, { state: s.name })}>
                  <UiIcon name="pin" size={16} />
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="nf-rm-panel" aria-labelledby="rmn-tips">
          <h2 id="rmn-tips" className="nf-rm-panel__title">
            {copy.ui.nysc.tipsTitle}
          </h2>
          <ol className="nf-rms-tips">
            {copy.ui.nysc.tips.map((tip, i) => (
              <li key={tip}>
                <span className="nf-rms-tips__n" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="nf-rm-panel nf-rmp-strip" aria-labelledby="rmn-circle">
          <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
            <UiIcon name="circle-people" size={24} />
          </span>
          <div className="nf-rmp-strip__words">
            <h2 id="rmn-circle" className="nf-rm-panel__title">
              {copy.ui.nysc.circle}
            </h2>
            <p className="nf-rm-panel__sub">{copy.ui.nysc.circleBody}</p>
          </div>
          <ButtonLink href={CIRCLE_NYSC} variant="secondary" size="md" arrow>
            {copy.ui.nysc.circleCta}
          </ButtonLink>
        </section>
      </div>
    </PageFrame>
  );
}
