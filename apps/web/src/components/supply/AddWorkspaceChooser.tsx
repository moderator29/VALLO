"use client";

import { useState } from "react";
import { ProgressPath } from "./ProgressPath";
import { NEED_TILES } from "./path-tiles";
import { useRouter } from "next/navigation";
import type { ChooserCopy } from "./supply-copy";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { OptionCards } from "@/components/ui/OptionCards";
import { StepFrame } from "@/components/ui/StepFrame";
import { TYPE } from "@/components/app/Screen";
import { SUPPLY_DOOR_ORDER, STAYS_DOOR_ORDER } from "@/lib/supply/roles";
import type { Side } from "@/lib/side.constants";
import { hrefFor } from "./AddWorkspaceChooser.href";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";

export { hrefFor };

/**
 * ADD A WORKSPACE, and it is the door this platform did not have.
 *
 * `GOVERNING-02` is the target, all three screens: the three supplier doors,
 * the selected state with its one primary control, and the "what we will ask
 * you for" overview.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS REPLACES A CHOOSER THAT ALREADY EXISTED
 *
 * `/profile/setup` offered TWO cards, "List or sell your own property" and
 * "Work as an agent or estate manager", and the navigation offered one row
 * into it reading "Become an agent". A landlord with one flat in Bwari is not
 * becoming an agent and never will be, and the product was correctly showing
 * him the door rather than the room: there is exactly one `agents` row in the
 * whole database and it is the example lister.
 *
 * So the doors are named in the first person, as a person would say them about
 * themselves, and the owner is FIRST, because owner direct supply is the thing
 * this direction exists to build.
 *
 * ---------------------------------------------------------------------------
 * WHAT WE WILL ASK YOU FOR, BEFORE ANYTHING IS ASKED
 *
 * The second screen is a checklist and that is deliberate. "A short
 * application, then a government issued ID and proof the property is yours" is
 * a sentence somebody skims; the same facts as four rows is a list somebody can
 * look at their desk and CHECK against, which is the actual decision being
 * made here: do I have this to hand now, or do I come back later.
 *
 * The owner's list says there is an honest answer for somebody who holds no
 * document, because over nine in ten Nigerian landlords hold none and a form
 * that does not say so is a form they abandon. No figure is printed: both
 * titling numbers rest on a search summary rather than a primary source and a
 * lawyer confirms them before any number becomes copy.
 *
 * ---------------------------------------------------------------------------
 * WHERE EACH DOOR GOES, STATED PLAINLY RATHER THAN IMPLIED
 *
 * All three property doors now open their own form: `GOVERNING-03` for the
 * owner, `04` for the agent, `05` for the firm. B1 wrote this comment when
 * only the first of those existed and the other two fell through to the
 * professional application, and it carried the chosen door forward in the URL
 * so that nothing here would have to change when they landed. They have
 * landed, and the answer is now the route rather than a query string.
 *
 * `/profile/setup/professional` is untouched and still serves the six step
 * application, which several older surfaces still link to.
 */

/**
 * THE OBJECT ON EACH DOOR, AND IT IS A WHOLE GLASS OBJECT.
 *
 * `GOVERNING-02` draws a lit three dimensional house, a key and a building,
 * each one nearly filling its plate. The owner and the agent doors carried
 * `home-ring` and `key-ring`, a faint glass ring with a thin line drawing
 * inside it, and on a phone they read as nothing (the founder, 25 September
 * 2026). So every door now carries a whole object, drawn larger (the
 * `.nf-door__mark--glass` box in controls.css), and in light mode it stands
 * on the white card with no plate behind it.
 *
 *   owner       `modern-house`, the render's own lit house.
 *   agent       `keys-tag`, a key on its tag: the agent holds the keys.
 *   firm        `cluster-home`, glass towers, which reads as an office at this
 *               size where `apartment-block` is drawn small and faint and
 *               `office-space` is a desk. The firm door is not offered today
 *               (`SUPPLY_DOOR_ORDER`); the object waits with its copy.
 *   hotel, shortlet, restaurant   kept. They were whole objects already, and
 *               they are what the market chips and the Stays pages give these
 *               three. The glass library has no restaurant; the bell on the
 *               desk is the nearest, and it is the restaurant's object on the
 *               host desk too.
 *
 * The register forms each door opens carry the same object (the owner's step
 * mark, the agent's and the firm's done screens), so the thing you chose is
 * the thing you see on the form.
 */
const DOOR_OBJECT: Record<string, BrandIconName> = {
  owner: "modern-house",
  agent: "keys-tag",
  firm: "cluster-home",
  hotel: "hotel",
  shortlet: "shortlet",
  restaurant: "concierge-bell",
};

/**
 * The founder's 3D object on each door (30 September): a picker is where an
 * object helps. The overview rows under it stay plates (rows are UiIcon).
 */
const DOOR_ART: Record<string, Icon3DName> = {
  owner: "home-verified",
  agent: "keys",
  firm: "city",
  hotel: "hotel",
  shortlet: "shortlet",
  restaurant: "restaurant",
};

/**
 * THE OBJECT ON EACH OVERVIEW ROW, KEYED BY THE DOOR.
 *
 * `GOVERNING-02` screen three draws a glass object beside every line, and
 * each object says what its line asks for: a person for who you are, a pin
 * for where the property is, a document with a shield for what proves it is
 * yours. The clock is not here: the timing is the calm panel below the rows,
 * which is where the image puts it.
 *
 * The rows used to take one positional list for every door, so once the
 * objects were drawn large (the founder, 25 September 2026: bigger and
 * clearer) a hotel's "Photographs of the place" stood beside a wallet and an
 * agent's fees beside the bank account's wallet. So each door has its own
 * list, in the order its `needs` are written. The order is the copy's, and
 * the Hausa, Yoruba and Igbo lists keep it, because they are translations of
 * the same lines. A door with more lines than objects gives the document to
 * the rest, because more lines means more paperwork and never more accounts.
 *
 * Every object is a whole glass object. `id-card-check` draws its card on a
 * glow that fills its canvas; in daylight the canvas edge is faded out
 * (light.css, for every glass object), so it reads as a card and not as a
 * lilac square.
 */
const NEED_OBJECTS: Record<string, readonly BrandIconName[]> = {
  owner: ["user-check", "id-card-check", "doc-shield", "wallet"],
  agent: ["user-check", "id-card-check", "pin-map", "tag-percent", "wallet"],
  /* The RC number is a number, the certificate is the document, and the
     proof that you work there is usually a staff card. */
  firm: ["user-check", "tag-hash", "doc-shield", "id-card-check"],
  hotel: ["user-check", "tag-hash", "hotel-room", "camera"],
  shortlet: ["user-check", "pin-map", "doc-home", "camera"],
  restaurant: ["user-check", "tag-hash", "calendar-clock", "camera"],
};
const OVERVIEW_FALLBACK: BrandIconName = "doc-shield";

export function AddWorkspaceChooser({ t, side }: { t: ChooserCopy; side: Side }) {
  const router = useRouter();
  /*
   * UX-05: BOTH SETS OF DOORS, ALWAYS, in two labelled groups. The chooser
   * used to show the property doors or the stays doors depending on an
   * invisible side cookie, so a landlord who had last tapped a shortlet could
   * not find "I own the property". The current side's group comes first; the
   * other is never hidden.
   */
  const groups: { key: Side; title: string; doors: readonly string[] }[] = [
    { key: "property", title: t.supply.chooser.groupProperty, doors: SUPPLY_DOOR_ORDER },
    { key: "stays", title: t.supply.chooser.groupStays, doors: STAYS_DOOR_ORDER },
  ];
  if (side === "stays") groups.reverse();

  const [chosen, setChosen] = useState<string | null>(null);
  const [step, setStep] = useState<"choose" | "overview">("choose");

  const copy = t.supply.chooser;
  const doorCopy = (id: string) => t.supply.doors[id as keyof typeof t.supply.doors];

  function onContinue() {
    if (!chosen) return;
    if (step === "choose") {
      setStep("overview");
      return;
    }
    router.push(hrefFor(chosen));
  }

  const overviewRows = chosen
    ? doorCopy(chosen).needs.map((need, index) => ({
        object: NEED_OBJECTS[chosen]?.[index] ?? OVERVIEW_FALLBACK,
        label: need,
      }))
    : [];

  /* SW5 and SW6 (round 3): the chooser is the first screen of the flow the
     three registrations finish, so it stands in the same STEP FRAME (back,
     close, the 3px bar, the title, Continue in the sticky foot), and each
     group of doors is the platform's OPTION CARDS: one choice, a thin glyph,
     the name, one grey line, the radio that fills. */
  const overview = step === "overview";
  return (
    <StepFrame
      overlay
      testId="workspace-chooser"
      step={overview ? 2 : 1}
      total={3}
      /* The founder's 3D object for the door (30 September: a picker is
         where an object helps), now the step's own object above the title:
         the chosen door's, or the first door's before a choice. */
      art={<Icon3D name={DOOR_ART[chosen ?? groups[0]?.doors[0] ?? "owner"] ?? "home-verified"} size={56} priority />}
      title={overview ? copy.overviewTitle : copy.title}
      subtitle={overview ? copy.overviewSub : copy.sub}
      direction={overview ? "forward" : "back"}
      {...(overview ? { onBack: () => setStep("choose") } : {})}
      closeHref="/profile"
      primary={{ label: copy.continueLabel, onClick: onContinue, disabled: !chosen, testId: "workspace-continue" }}
      {...(overview ? { secondary: { label: copy.chooseAgain, onClick: () => setStep("choose") } } : {})}
    >
      {!overview ? (
        <div className="grid gap-block">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`doors-${group.key}`} className="grid gap-inline">
              <h2 id={`doors-${group.key}`} className={TYPE.rowTitle}>
                {group.title}
              </h2>
              <OptionCards
                label={group.title}
                value={chosen && group.doors.includes(chosen) ? chosen : null}
                onChange={setChosen}
                testId={`doors-${group.key}`}
                options={group.doors.map((id) => ({
                  value: id,
                  label: doorCopy(id).title,
                  detail: doorCopy(id).blurb,
                  icon: lineGlyphFor(DOOR_OBJECT[id] ?? "modern-house"),
                }))}
              />
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-block">
          {/* THE PATH AHEAD (reference 2, the learning path): every line this
              door will ask for, as a card with its 3D tile and its number,
              joined by the connector. Nothing is done yet, so every step is
              upcoming and none is a button. */}
          <ProgressPath
            steps={overviewRows.map((row) => ({
              id: row.label,
              label: row.label,
              tile: NEED_TILES[row.object],
            }))}
            at={-1}
            copy={{ done: "", current: "", upcoming: "" }}
          />
          {/* The calm explanatory panel with its small round glyph: a GLYPH,
              not a control, so the shape law does not reach it. */}
          {chosen && (
            <div className="nf-calmpanel">
              <span className="nf-calmpanel__glyph" aria-hidden="true">
                <UiIcon name="history" size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${TYPE.rowTitle}`}>{copy.howLongTitle}</span>
                <span className={`mt-inline-tight block ${TYPE.rowMeta}`}>{doorCopy(chosen).howLong}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </StepFrame>
  );
}
