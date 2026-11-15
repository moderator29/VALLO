import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { aboutVallo } from "@/app/admin/manual/_chapters/role-shared";
import { COPILOT_CAPABILITIES, COPILOT_LIMITS } from "@/lib/admin/copilot/capabilities";
import { MANUAL_AREA_LABEL } from "@/lib/admin/manual/chapters";
import { JOB_DESCRIPTIONS, type StaffPosition } from "@/lib/admin/staff-positions";
import { desksForScopes } from "./desks";
import { A } from "./parts";
import { auditLog, escalation, gettingHelp, publishedClock, signingIn } from "./shared";
import type { HandbookBody, HandbookSection, RoleWords } from "./types";

/**
 * ONE HANDBOOK, BUILT FROM ONE POSITION'S WORDS (15 November 2026).
 *
 * The frame is written once here and every position passes in its own words
 * (`roles/*.tsx`), which is how eighteen handbooks stay the same document
 * eighteen times rather than eighteen documents. What is DERIVED is derived
 * and never typed twice:
 *
 *   - the title, the summary, who the position reports to, what it is
 *     responsible for, what is expected of it and what it escalates come from
 *     `JOB_DESCRIPTIONS`, so the handbook carries the whole job description
 *     rather than a second copy of it;
 *   - the desks come from the position's own scopes through `desks.ts`;
 *   - the access areas are named with the console's own labels;
 *   - the copilot's abilities come from `COPILOT_CAPABILITIES` and its limits
 *     from `COPILOT_LIMITS`, so the handbook and the copilot cannot disagree
 *     about what it will do;
 *   - the shared sections come from the staff manual's `role-shared.tsx` and
 *     from `shared.tsx`.
 *
 * Nothing here says a thing the code does not do.
 */

/**
 * A SUB-HEADING INSIDE A SECTION. The documentation kit styles a section's
 * prose but not an `h3` inside it, so a sub-heading would read as another
 * paragraph; the platform's own h4 class gives it the display face and the
 * weight at the right step below the section title.
 */
const H3 = "nf-h4 mt-xs text-[var(--nf-content-primary)]";

const DESK_COLUMNS = [
  { key: "desk", label: "Desk" },
  { key: "what", label: "What it is for" },
  { key: "you", label: "What you do there" },
];

function deskRows(position: StaffPosition): DocTableRow[] {
  return desksForScopes(JOB_DESCRIPTIONS[position].scopes).map((desk) => ({
    id: desk.href,
    cells: {
      desk: (
        <Link href={desk.href} className={A}>
          {desk.name}
        </Link>
      ),
      what: desk.what,
      you: desk.you,
    },
  }));
}

function whatThisJobIsFor(position: StaffPosition, role: RoleWords): HandbookSection {
  const job = JOB_DESCRIPTIONS[position];
  return {
    id: "what-this-job-is-for",
    title: "What this job is for",
    body: (
      <>
        {role.purpose}
        <p>
          In one line: {job.summary} Reports to: {job.reportsTo}. Your access areas are{" "}
          {job.scopes.map((scope) => MANUAL_AREA_LABEL[scope]).join(", ")}.
        </p>
        <h3 className={H3}>What you are responsible for</h3>
        <ul role="list">
          {job.responsibilities.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <h3 className={H3}>What is expected of you</h3>
        <ul role="list">
          {job.expectations.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p>
          File your weekly report every week. It opens on Saturday and is due Monday at 12:00, Lagos time.{" "}
          <Link href="/admin/manual/weekly-report" className={A}>
            How the weekly report works
          </Link>
          .
        </p>
      </>
    ),
  };
}

function firstWeek(role: RoleWords): HandbookSection {
  return {
    id: "first-week",
    title: "Your first day, and your first week",
    body: (
      <>
        <h3 className={H3}>Your first day, in order</h3>
        <ol role="list">
          {role.firstDay.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <h3 className={H3}>Your first week</h3>
        <ol role="list">
          {role.firstWeek.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <DocCallout tone="note" title="Nobody expects you to know it on day one">
          Ask. A question costs a colleague two minutes; a wrong decision costs a member much more and is read back
          later with your name on it.
        </DocCallout>
      </>
    ),
  };
}

function yourDesks(position: StaffPosition): HandbookSection {
  const job = JOB_DESCRIPTIONS[position];
  return {
    id: "your-desks",
    title: "Every desk you can open",
    body: (
      <>
        <p>
          Your access areas are{" "}
          <strong>{job.scopes.map((scope) => MANUAL_AREA_LABEL[scope]).join(", ")}</strong>. They open these desks and
          nothing else. The database asks again every time a desk opens, so a desk that is not here stays closed even
          if you type its address.
        </p>
        <DocTable caption="The desks this position opens" columns={DESK_COLUMNS} rows={deskRows(position)} />
        <p>
          Every desk in the console is listed in{" "}
          <Link href="/admin/manual/desks" className={A}>
            chapter 2 of the staff manual
          </Link>
          . Reading about a desk you do not hold is fine; opening it is not possible.
        </p>
      </>
    ),
  };
}

function decisions(role: RoleWords): HandbookSection {
  return {
    id: "decisions",
    title: "What you decide alone, what needs somebody else, and what you never decide",
    body: (
      <>
        <h3 className={H3}>You may decide these alone</h3>
        <p>Inside your own access areas, and only on an item that is not yours:</p>
        <ul role="list">
          {role.alone.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <h3 className={H3}>These need somebody else</h3>
        <ul role="list">
          {role.withSomebody.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <h3 className={H3}>You never decide these</h3>
        <ul role="list">
          {role.never.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <DocCallout tone="warning" title="Three rules above all of it">
          <ul role="list">
            <li>
              <strong>Nobody decides their own case.</strong> Not your own listing, document, application, report,
              agreement or appeal, and not one belonging to anybody you know. The console refuses what it can see; the
              rest is on you. Say why in the internal notes and leave it.
            </li>
            <li>
              <strong>Decide on the evidence in the console</strong>, never on who the person is or what they promise.
            </li>
            <li>
              <strong>Where a reason is asked for, the member reads it word for word.</strong> Write it for them.
            </li>
          </ul>
        </DocCallout>
        <p>
          The whole table of what needs a second person and what only an admin decides is{" "}
          <Link href="/admin/manual/decisions" className={A}>
            chapter 4 of the staff manual
          </Link>
          .
        </p>
      </>
    ),
  };
}

function theWork(role: RoleWords): HandbookSection {
  return {
    id: "the-work",
    title: "Step by step, the work itself",
    body: (
      <>
        <p>Every routine task of this position, in the order the screens ask for it.</p>
        {role.tasks.map((task) => (
          <div key={task.id}>
            <h3 id={`task-${task.id}`} className={H3}>{task.title}</h3>
            <ol role="list">
              {task.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            {task.note}
          </div>
        ))}
      </>
    ),
  };
}

function whatGoodLooksLike(role: RoleWords): HandbookSection {
  return {
    id: "what-good-looks-like",
    title: "What good looks like",
    body: (
      <>
        <DocTable
          caption="The standard for this position"
          columns={[
            { key: "what", label: "What is measured" },
            { key: "good", label: "What good looks like" },
          ]}
          rows={role.standards.map((standard, index) => ({
            id: `standard-${index}`,
            cells: { what: standard.what, good: standard.good },
          }))}
        />
        <p>
          Behind every desk&apos;s own standard sit the answer times Vallo publishes to members. They are the floor,
          not the target, and the queue computes each row&apos;s due time from them, so a late row rises to the top by
          itself.
        </p>
        {publishedClock()}
        <p>
          Your lead reads your work on{" "}
          <Link href="/admin/oversight" className={A}>
            Team oversight
          </Link>
          : each queue&apos;s backlog and its oldest item, and every staff member&apos;s decisions over thirty days. A
          promise of speed that costs accuracy is not good work here. A slower right answer is better than a quick
          wrong one, every time.
        </p>
      </>
    ),
  };
}

function theWords(role: RoleWords): HandbookSection {
  return {
    id: "the-words",
    title: "The words you use, and the words nobody at Vallo uses",
    body: (
      <>
        <h3 className={H3}>The words you use</h3>
        <ul role="list">
          {role.wordsUsed.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <h3 className={H3}>The words nobody at Vallo uses</h3>
        <DocCallout tone="warning" title="Never write these">
          <ul role="list">
            <li>That Vallo holds, keeps, safeguards or looks after anybody&apos;s money.</li>
            <li>
              That a payment, a listing, a person or a place comes with a promise of safety, unless a real check behind
              that exact claim is named. Say what was looked at and by whom.
            </li>
            <li>That a member will get a refund, a payout or a particular outcome that another desk decides.</li>
            <li>A date by which something will be ready, or any form of &quot;soon&quot;. Say what is true today.</li>
            <li>An em dash, in a message, a note or a reason. Vallo writes in short sentences and commas.</li>
          </ul>
        </DocCallout>
        <ul role="list">
          {role.wordsNever.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </>
    ),
  };
}

function privacyHere(role: RoleWords): HandbookSection {
  return {
    id: "privacy-here",
    title: "Privacy and safety rules that bite in this job",
    body: (
      <>
        <p>
          The privacy rules above hold everywhere in the console. These are the ones this position runs into most, and
          the ones most likely to cost somebody their job.
        </p>
        <ul role="list">
          {role.privacy.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <DocCallout tone="warning" title="Personal data is the law, not a preference">
          Personal data on Vallo is protected by the Nigeria Data Protection Act 2023. Look only at what your task
          needs. Never copy, screenshot, export or share a member&apos;s information except through the console&apos;s
          own export, and only for the purpose your role names. Never contact a member outside Vallo, and never use
          anything you saw here for any purpose of your own. Breaking this ends your access and may be reported to the
          authorities.
        </DocCallout>
      </>
    ),
  };
}

function yourCopilot(position: StaffPosition, role: RoleWords): HandbookSection {
  const scopes = JOB_DESCRIPTIONS[position].scopes;
  const mine = COPILOT_CAPABILITIES.filter(
    (capability) => capability.scopes.length === 0 || capability.scopes.some((scope) => scopes.includes(scope)),
  );
  return {
    id: "your-copilot",
    title: "Your copilot",
    body: (
      <>
        <p>
          A copilot button sits at the corner of every desk, and it has a page of its own at{" "}
          <Link href="/admin/copilot" className={A}>
            Copilot
          </Link>
          . It knows your position, your access areas, the figures on your desks and this handbook word for word. Ask
          it in plain words. It reads only what you may read: a desk you do not hold is closed to it as it is to you.
        </p>
        <h3 className={H3}>What it can do for this position</h3>
        <DocTable
          caption="What the copilot can do on this position's desks"
          columns={[
            { key: "desk", label: "Desk" },
            { key: "can", label: "What it can do" },
          ]}
          rows={mine.map((capability) => ({
            id: capability.key,
            cells: { desk: capability.desk, can: capability.can.join(". ") },
          }))}
        />
        <h3 className={H3}>What it will not do</h3>
        <ul role="list">
          {COPILOT_LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <ul role="list">
          {role.copilotCannot.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <h3 className={H3}>Three good questions to ask it</h3>
        <ol role="list">
          {role.copilotAsk.map((question) => (
            <li key={question}>&quot;{question}&quot;</li>
          ))}
        </ol>
        <DocCallout tone="note" title="Check what it tells you">
          The copilot answers from this handbook, the staff manual and the figures on your desks. It can still read a
          question wrongly. Where its answer and the screen disagree, the screen is right. Where its answer and the
          staff handbook disagree, the handbook is the rule. Tell the founder either way.
        </DocCallout>
      </>
    ),
  };
}

/** One position's whole handbook, in the order a new person reads it. */
export function buildHandbook(position: StaffPosition, role: RoleWords): HandbookBody {
  const job = JOB_DESCRIPTIONS[position];
  return {
    intro: (
      <p>
        Everything this position needs to know, and everything it can reach: what the job is for, how to get in, what
        to do on your first day, every desk you can open, what you may decide, the work step by step, the standard you
        are held to, the words to use, how to escalate, what your copilot will do, and who to go to. Read all of it
        once, then come back to the part you need. Save it to your phone from the button at the top.
      </p>
    ),
    glance: [
      ...role.glance,
      `Reports to: ${job.reportsTo}.`,
      "Nobody decides their own case, and every reason you write is read by the member exactly as you wrote it.",
      "When you are unsure, press Escalate rather than guess.",
    ],
    sections: [
      whatThisJobIsFor(position, role),
      signingIn(role),
      firstWeek(role),
      ...aboutVallo({ who: role.who, keeps: role.keeps }),
      yourDesks(position),
      decisions(role),
      theWork(role),
      whatGoodLooksLike(role),
      theWords(role),
      privacyHere(role),
      auditLog(role),
      escalation(role, job.escalate),
      yourCopilot(position, role),
      gettingHelp(role),
    ],
  };
}
