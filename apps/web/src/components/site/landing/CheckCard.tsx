import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import { LANDING_OBJECT_SIZE } from "./landing-objects";
import { CheckForm } from "@/app/(site)/check/CheckForm";

/**
 * A7. "CHECK BEFORE YOU PAY" AS A FRONT-DOOR FEATURE.
 *
 * `/check` answers "is this a Vallo agent?" for anybody, with no account, and
 * it was linked from nowhere a stranger looks. This card puts the field itself
 * on the landing: paste a number or a VA- code and the answer is drawn in
 * place, through the same rate-limited action the page uses
 * (`lib/doors/agent-check-actions.ts`). A "no match" offers the fixed warning
 * share, which never carries the number.
 *
 * It lives in the community room ("Built for both sides of the deal"), in the
 * column the photograph used to take, rather than in a room of its own: the
 * landing's height budget (A15) and the room's own point, that both sides of
 * the deal can be checked, ask for the same place. One card, the clean
 * unified material (`.nf-pd-card`), one column at every width.
 */
export function CheckCard({ t, locale }: { t: Dictionary; locale: Locale }) {
  const c = t.publicDoors.checkCard;
  return (
    <div className="nf-pd-card nf-check-card" data-chapter="check">
      <div className="nf-check-card__head">
        <span className="nf-obj nf-check-card__obj">
          <Icon3D classic name="id-check" size={LANDING_OBJECT_SIZE.check} />
        </span>
        <div className="nf-check-card__heading">
          <p className="nf-section-label">{c.label}</p>
          <h3 className="nf-check-card__title">
            {c.title}
          </h3>
        </div>
      </div>
      <p className="nf-check-card__body">{c.body}</p>
      <div className="nf-check-card__form">
        <CheckForm copy={t.trustDoors.check} locale={locale} initial="" warning={t.publicDoors.warning} compact />
      </div>
      <div className="nf-check-card__links">
        <Link href="/r" className="nf-pd-link">
          <UiIcon name="receipt" size={16} aria-hidden />
          {c.receipt}
        </Link>
        <Link href="/check" className="nf-pd-link">
          {c.open}
          <UiIcon name="arrow-right" size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
