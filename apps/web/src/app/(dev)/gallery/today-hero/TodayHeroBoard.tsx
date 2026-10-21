"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { HeroBand } from "@/components/ui/HeroBand";
import { IconPlate } from "@/components/ui/IconPlate";
import { StatusChip } from "@/components/ui/StatusChip";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TodayHero } from "@/components/workspace/TodayHero";
/* The workspace sheet that left `globals.css`, imported where it is drawn. */
import "@/app/css/agent.css";
import { Section, Specimen, SystemFrame } from "../_system/SystemFrame";
import "@/app/css/site.css";

/**
 * THE TODAY HERO (reference 7033, north star section 10 G and H).
 *
 * The figure hero on the workspace home's navy band: "needs you today", large
 * and counting once on arrival, then the one next action as a single row. The
 * count is the sum of the count cards beneath it that were READ, so it always
 * decomposes into things the reader can tap; when no queue could be read the
 * caller passes `null` and the figure is not drawn at all, because a zero nobody
 * counted is a lie.
 *
 * THE COUNT IS THE VIEWER'S. It starts at zero (the idle state), and the buttons
 * raise it so the count can be watched arriving and then rolling; it is a test
 * value, not a queue. Captions and lines are slot names. The next-action row
 * links to this very page.
 *
 * Three states, in the order they are likely to be met: busy with a next action,
 * idle (nothing waits, so no row), and unread (null, nothing drawn).
 */

const TAG = "en-NG";

function Band({ children }: { children: ReactNode }) {
  return (
    <HeroBand lap label="Date slot" title="Band title slot">
      {children}
    </HeroBand>
  );
}

export function TodayHeroBoard() {
  const [count, setCount] = useState(0);
  const [mount, setMount] = useState(0);
  return (
    <SystemFrame
      slug="today-hero"
      title="Today hero"
      lede="The question a workspace opens with: what needs me. The count is a test value you raise; the figure counts up once and then rolls."
    >
      <Section title="Busy, with the next action" note="Raise the count to leave the idle state. The next action is the oldest item still waiting and leaves the list beneath, so nothing is listed twice.">
        <div className="nf-sg-row">
          <Button variant="glass" size="sm" onClick={() => setCount((n) => n + 1)}>
            Raise the test count
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setCount(0)}>
            Back to idle
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setMount((n) => n + 1)}>
            Mount again
          </Button>
          <p className="nf-sg-readout" aria-live="polite">
            Test count: {count}
          </p>
        </div>
        <Band>
          <TodayHero
            key={mount}
            caption="Caption slot"
            count={count}
            busy="Busy line slot"
            idle="Idle line slot"
            tag={TAG}
            next={
              count > 0
                ? {
                    href: "/gallery/today-hero",
                    title: "Next action title slot",
                    sub: "Next action detail slot",
                    leading: (
                      <IconPlate tone="brand">
                        <UiIcon name="clock" size={20} />
                      </IconPlate>
                    ),
                    status: <StatusChip state="pending">Pending</StatusChip>,
                  }
                : null
            }
          />
        </Band>
      </Section>

      <Section title="Idle" note="Nothing waits: the figure says so in the caller's quiet line and there is no next row.">
        <Band>
          <TodayHero caption="Caption slot" count={0} busy="Busy line slot" idle="Idle line slot" tag={TAG} next={null} />
        </Band>
      </Section>

      <Section title="Unread" note="No queue behind the figure could be read, so the caller passes null and the hero draws nothing, not a zero.">
        <div className="nf-sg-grid">
          <Specimen label="count null: the band holds no figure">
            <Band>
              <TodayHero caption="Caption slot" count={null} busy="Busy line slot" idle="Idle line slot" tag={TAG} next={null} />
              <p className="nf-sg-readout">Nothing is drawn above this line.</p>
            </Band>
          </Specimen>
        </div>
      </Section>
    </SystemFrame>
  );
}
