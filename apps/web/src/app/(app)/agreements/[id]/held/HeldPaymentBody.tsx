import { formatMoney, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import { heldModel, type HeldFacts } from "@/lib/money/held-model";
import { HELD_BY_LINE } from "@/lib/money/copy";
import { ReleaseControl } from "./ReleaseControl";
import "./held-payment.css";

/**
 * The held payment itself (STEP 8, FUNDED): the card, what releases it, the
 * stages and the release control, drawn from the provider's record. Split out
 * of the page so the preview harness mounts the same markup with recorded
 * facts; the page keeps the read, the guards and the redirect.
 */
export function HeldPaymentBody({
  facts: f,
  locale,
  agreementId,
  arrangementId,
}: {
  facts: HeldFacts;
  locale: Locale;
  agreementId: string;
  arrangementId: string;
}) {
  const m = heldModel(f);
  const money = (minor: number) => formatMoney(minor, locale, "NGN");
  /* The figure huge, its unit softer at the same size (Plasma): the naira
     sign is the unit, the number is the figure. */
  const full = money(f.amountMinor);
  const figure = full.replace(/^₦\s?/, "");

  return (
    <section
      className="nf-held"
      aria-labelledby="held-title"
      data-testid="held-payment"
      data-role={f.role}
      data-status={f.status}
    >
      <header>
        <p className="nf-held__eyebrow">{f.placeTitle}</p>
        <h1 id="held-title" className="nf-held__title">
          {m.title}
        </h1>
      </header>

      <div className="nf-held__card" data-testid="held-card">
        <span className="nf-held__badge" data-tone={m.badge.tone}>
          <UiIcon
            name={m.badge.tone === "done" ? "check" : "shield-lock"}
            size={16}
          />
          {m.badge.label}
        </span>
        <p className="nf-held__figure" aria-label={full}>
          <span className="nf-held__unit" aria-hidden>
            ₦
          </span>
          <span aria-hidden>{figure}</span>
        </p>
        <p className="nf-held__by">
          <UiIcon name="shield-check" size={ICON.inline} />
          {HELD_BY_LINE}
        </p>
        {f.role === "lister" && (
          <div className="nf-held__split">
            <div>
              <p className="nf-held__label">Held for you</p>
              <p className="nf-held__value">{full}</p>
            </div>
            <hr aria-hidden />
            <div>
              <p className="nf-held__label">You receive</p>
              <p className="nf-held__value">
                {m.receiveMinor !== null
                  ? money(m.receiveMinor)
                  : "After the partner's fee"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="nf-held__eyebrow">What releases it</h2>
        <ol className="nf-held__steps mt-sm">
          {m.steps.map((step, i) => (
            <li
              key={step.title}
              className="nf-held__step"
              data-state={step.state}
            >
              <span className="nf-held__dot" aria-hidden>
                {step.state === "done" ? (
                  <UiIcon name="check" size={16} />
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <p className="nf-held__step-title">{step.title}</p>
                <p className="nf-held__step-body">
                  {i === 0 && f.moveIn
                    ? `${step.body} Move-in: ${f.moveIn}.`
                    : step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {f.milestones.length > 0 && (
        <div>
          <h2 className="nf-held__eyebrow">Released in stages</h2>
          <ul className="nf-held__milestones mt-sm">
            {f.milestones.map((ms) => (
              <li key={ms.position} className="nf-held__milestone">
                <span>{ms.title}</span>
                <span className="nf-held__value">
                  {money(ms.amountMinor)} ·{" "}
                  {ms.status === "released"
                    ? "Released"
                    : ms.status === "pending"
                    ? "Held"
                    : "Releasing"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.note && <p className="nf-held__note">{m.note}</p>}

      {m.canRelease && (
        <ReleaseControl
          agreementId={agreementId}
          arrangementId={arrangementId}
        />
      )}
      {m.nextMilestone && (
        <ReleaseControl
          agreementId={agreementId}
          arrangementId={arrangementId}
          milestonePosition={m.nextMilestone.position}
          label={`Swipe to release ${money(m.nextMilestone.amountMinor)}: ${
            m.nextMilestone.title
          }`}
        />
      )}
    </section>
  );
}
