import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PAY_ONLY_THROUGH_VALLO } from "@/lib/money/copy";
import { SHOWCASE } from "./sections";
import "./showcase.css";

/**
 * DISCOVER VALLO, a proposal (the founder's brief, section 11).
 *
 * Five sections, not seventeen. The reasons for the twelve that are not here
 * are in `sections.ts`, beside the five that are.
 *
 * ONE SCREEN, ONE JOB (CRAFT_DOCTRINE section 4): what else Vallo does for
 * you, and a door into each. The subject of every row is the capability; the
 * glyph is quieter than the words and the door is quieter still, so nothing
 * competes with the sentence a person is actually reading.
 *
 * NOTHING HERE IS A CLAIM VALLO CANNOT KEEP. No figure, no photograph
 * standing in for a listing, no feature that does not exist: every door is a
 * route in this repository. The money line is `PAY_ONLY_THROUGH_VALLO` from
 * `lib/money/copy.ts`, the only wording the Terms allow, and it is the
 * closing line rather than a badge, because it is advice and not a boast.
 *
 * MOTION. Each row rises once as it arrives, on the shared ladder
 * (`nf-rise`), capped so the sixth does not wait for the fifth. Under reduced
 * motion, Calm and Off the tokens collapse and the rows simply appear.
 */
export function ShowcaseBody() {
  return (
    <main className="nf-showcase">
      <header className="nf-showcase__head nf-rise nf-rise-1">
        <p className="nf-showcase__eyebrow">Discover Vallo</p>
        <h1 className="nf-showcase__title">More than the one thing you came for</h1>
        <p className="nf-showcase__lede">
          Vallo is a marketplace for places to live, stay and eat in Nigeria, and the tools to deal
          with the people who own them. Here is the rest of it.
        </p>
      </header>

      <ol className="nf-showcase__list">
        {SHOWCASE.map((section, i) => (
          <li key={section.key} className={`nf-rise nf-rise-${Math.min(i + 2, 5)}`}>
            <Panel variant="card" className="nf-showcase__row">
              <span className="nf-showcase__mark" aria-hidden="true">
                <UiIcon name={section.icon} size={22} />
              </span>
              <div className="nf-showcase__text">
                <p className="nf-showcase__for">{section.eyebrow}</p>
                <h2 className="nf-showcase__name">{section.title}</h2>
                <p className="nf-showcase__body">{section.body}</p>
              </div>
              <Link href={section.door.href} className="nf-showcase__door">
                {section.door.label}
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </Panel>
          </li>
        ))}
      </ol>

      <Panel variant="card" className="nf-showcase__close nf-rise nf-rise-5">
        <p className="nf-showcase__closeLine">{PAY_ONLY_THROUGH_VALLO}</p>
      </Panel>
    </main>
  );
}
