import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 11. Read from `app/admin/technical`, `lib/admin/technical` and
 * `lib/admin/desk-entries` on 10 November 2026: what the health panel reads,
 * the incident log's moves, the secret check on every text field, and the
 * refusals each action returns. When those change, this chapter changes.
 */
export const TECHNICAL: ManualBody = {
  intro: (
    <p>
      This chapter is for the Technical Administrator. You watch how the platform is doing from the console, keep the
      record of technical incidents, write the runbooks and notes that let the next person act without starting cold, and
      read deployment information where you are authorised. You report to the COO. This desk is read only about the
      platform: it shows no key, password or credential, and it changes no infrastructure.
    </p>
  ),
  glance: [
    "Your desk is Technical, in the Departments group. Its tabs are Health, Errors, Incidents, Runbooks, Releases, Reminders, On call and status, and Reviews.",
    "Health shows scheduled jobs, open alerts, error counts, which services are set up and the release code. A part that cannot be read says so and is never drawn as zero.",
    "The incident log is the record: what you knew, when, and what you did. Resolving needs a written summary, and any text that looks like a key, token or password is refused.",
    "You hand anything that needs a change to infrastructure, a key or the database to the people who hold that access, with the facts you saw.",
    "A suspected leak of a key goes to the COO immediately and is not written in the log.",
    "Every action shows one banner at the top, and resolving an incident carries an Undo.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Technical Administrator",
      keeps:
        "Members do not see your work when it goes well. They see it when a booking is slow, a page will not load or a payment seems stuck. Vallo's promise to answer on time depends on a platform that is working, and on a team that knows quickly when it is not.",
    }),
    {
      id: "the-desk",
      title: "The desk and its tabs",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/technical" className={A}>
              Technical
            </Link>
            . It opens on Health. If any reminder is due within thirty days, a box at the top says so.
          </p>
          <DocTable
            caption="The Technical desk, tab by tab"
            columns={[
              { key: "tab", label: "Tab" },
              { key: "use", label: "What it is for" },
              { key: "when", label: "When you use it" },
            ]}
            rows={[
              { id: "health", cells: { tab: "Health", use: "Four headline counts, every scheduled job with its newest run and outcomes over fourteen days, which services are set up, and the release code.", when: "First thing, every day." } },
              { id: "errors", cells: { tab: "Errors", use: "Error types seen per day for fourteen days with a comparison to the week before, and the most frequent open error types: type, place, release and times.", when: "Daily, and after every release." } },
              { id: "incidents", cells: { tab: "Incidents", use: "The incident log: declare, update, resolve, reopen, with severity, status and timeline.", when: "When something is wrong, and every update after." } },
              { id: "runbooks", cells: { tab: "Runbooks", use: "Step lists for things that go wrong the same way twice.", when: "After an incident, and before one." } },
              { id: "releases", cells: { tab: "Releases", use: "The environment and short release code that is running, and release notes in plain words.", when: "At every release." } },
              { id: "reminders", cells: { tab: "Reminders", use: "Things that quietly run out: certificates, domains, dependencies, licences, plans. When, and where to renew.", when: "Weekly." } },
              { id: "handover", cells: { tab: "On call and status", use: "On-call handover notes, and status page wording drafts that need approval.", when: "At each handover and in an incident." } },
              { id: "reviews", cells: { tab: "Reviews", use: "Post-incident reviews: what happened, why, what went well, what changes.", when: "Within a few days of a serious incident." } },
            ]}
          />
        </>
      ),
    },
    {
      id: "health",
      title: "Reading Health and Errors",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>The four counts.</strong> Jobs late, jobs whose last run failed, open error types, open alerts. A
              count marked Not available could not be read; say so rather than assume it is fine.
            </li>
            <li>
              <strong>Scheduled jobs.</strong> Each job has a state. <em>On time</em> means its newest run is inside its
              allowed gap and did not fail. <em>Late</em> means no run for longer than allowed. <em>Last run failed</em>{" "}
              means exactly that. <em>No run seen</em> means nothing in fourteen days. The last column counts ok,
              needs-attention and failed runs over fourteen days.
            </li>
            <li>
              <strong>Services configured.</strong> Whether a connection (database, email, card payments, calls, push,
              error reporting) is set up. It never shows a key. To test a provider live, use{" "}
              <Link href="/admin/operations/providers" className={A}>
                Provider checks
              </Link>
              , which is read only or cleans up after itself.
            </li>
            <li>
              <strong>What is running.</strong> The environment, the release code (the first seven characters of the
              commit) and the runtime. That is all the console says about a deployment.
            </li>
            <li>
              <strong>Errors.</strong> The table counts error types by the day they were last seen, which is a different
              thing from how many times each happened. The sentence under it compares the last seven days with the seven
              before. The second table lists open error types most frequent first. The message, the stack and the people
              affected stay in the Crash log under Operations; you see types, places and counts.
            </li>
          </ul>
          <DocCallout tone="warning" title="A calm page is not proof">
            Health shows what the console can read. A job that ran and did the wrong thing looks on time. If members report
            a problem the panel does not show, believe the members and open an incident.
          </DocCallout>
        </>
      ),
    },
    {
      id: "incidents",
      title: "The incident log, step by step",
      body: (
        <>
          <DocFlow
            label="One incident"
            steps={[
              { icon: "alert-triangle", title: "Declare", outcome: "A title, a severity and what you know.", href: "/admin/technical?tab=incidents" },
              { icon: "bell", title: "Tell", outcome: "The COO for severity 1 or 2." },
              { icon: "history", title: "Update", outcome: "A line each time the position changes." },
              { icon: "check-circle", title: "Resolve", outcome: "With a written summary." },
              { icon: "file-text", title: "Review", outcome: "A post-incident review within days." },
            ]}
          />
          <DocTable
            caption="Severity, in plain words"
            columns={[
              { key: "level", label: "Level" },
              { key: "means", label: "Means" },
              { key: "tell", label: "Tell" },
            ]}
            rows={[
              { id: "s1", cells: { level: "Severity 1", means: "Members cannot use Vallo, or money or data is at risk.", tell: "The COO and the CEO at once." } },
              { id: "s2", cells: { level: "Severity 2", means: "A main journey (searching, messaging, booking, paying) is broken for many.", tell: "The COO at once." } },
              { id: "s3", cells: { level: "Severity 3", means: "A feature is degraded or broken for some.", tell: "The COO in your next update." } },
              { id: "s4", cells: { level: "Severity 4", means: "Minor, with a workaround.", tell: "Note it in your report." } },
            ]}
          />
          <ol role="list">
            <li>
              <strong>Declare.</strong> Under <em>Declare an incident</em> write a short title, choose the severity, and
              write what you know: what is wrong, who is affected, since when. Say what you do not know. Do not guess a
              cause. The incident gets a reference like <em>INC-1A2B3C</em> with a Copy button.
            </li>
            <li>
              <strong>Update.</strong> On the incident, write what changed since the last update and, if the position
              changed, move it to Investigating, Mitigated or Open. The timeline is in order and each line carries the time
              and your name.
            </li>
            <li>
              <strong>Resolve.</strong> Write what happened and what was done, at least a sentence, and press{" "}
              <strong>Resolve incident</strong>. The banner offers Undo, which reopens it. An incident cannot be resolved
              without a summary.
            </li>
            <li>
              <strong>Reopen.</strong> If it comes back, press <strong>Reopen</strong>. It returns to Investigating and a
              line records it.
            </li>
          </ol>
          <DocCallout tone="warning" title="Never write a secret in the log">
            The desk refuses text that looks like a key, a token, a password or a connection string, and says so. Describe
            what you saw instead. If a real key may have leaked, tell the COO now, by voice if you can, and do not write
            the detail in any log.
          </DocCallout>
        </>
      ),
    },
    {
      id: "notes",
      title: "Runbooks, releases, reminders, handovers and reviews",
      body: (
        <ul role="list">
          <li>
            <strong>Runbook.</strong> Name the situation (<em>Scheduled job has not run for three hours</em>), then write
            the steps one per line; they show as a numbered list. Add who to call first (a role, not a number) and how you
            know it worked. Write it for a tired person at night. Never put a key or a password in a runbook.
          </li>
          <li>
            <strong>Release note.</strong> One per release: the version or release code, the date, what changed in plain
            words and whether it was mostly a feature, a fix or behind the scenes. Support reads these.
          </li>
          <li>
            <strong>Expiry reminder.</strong> What expires, on what date, where it lives and how to renew it, in words.
            Not the login. Mark it renewed when it is. Anything due in thirty days shows at the top of the desk.
          </li>
          <li>
            <strong>On-call note.</strong> The handover: open incidents, jobs to watch, planned changes, who is reachable
            and when. Mark it handed over when the next person has read it.
          </li>
          <li>
            <strong>Status page draft.</strong> Wording for a notice during an incident: a headline, who is affected, what
            is being done and when the next update is due. Choose the stage. It is a draft until the COO or an admin
            approves it, and nothing is published from the console. Do not name a cause you are not sure of.
          </li>
          <li>
            <strong>Post-incident review.</strong> After a serious incident: a timeline, who was affected as counts, why it
            happened, what went well, what to change, and actions with an owner and a date. It blames a process, never a
            person.
          </li>
        </ul>
      ),
    },
    {
      id: "rhythm",
      title: "Your day, week and month",
      body: (
        <DocTable
          caption="The rhythm of the Technical Administrator"
          columns={[
            { key: "when", label: "When" },
            { key: "what", label: "What you do" },
          ]}
          rows={[
            { id: "day", cells: { when: "Every day", what: "Open My desk, then Technical. Read Health, then Errors. Anything late or failing? Any open incident needing an update? Any reminder due soon?" } },
            { id: "after", cells: { when: "After every release", what: "Write the release note. Watch Errors for a rise in the first hours. If it rises, declare an incident rather than wait." } },
            { id: "week", cells: { when: "Every week", what: "Review reminders. Tidy runbooks. Write the on-call handover. Write your weekly report." } },
            { id: "month", cells: { when: "Every month", what: "Read the month's incidents together and look for a pattern. Retire stale runbooks. Check every certificate, domain and plan with a date." } },
          ]}
        />
      ),
    },
    {
      id: "weekly-report",
      title: "Your weekly report",
      body: (
        <p>
          Your{" "}
          <Link href="/admin/my-desk/weekly" className={A}>
            weekly report
          </Link>{" "}
          is prefilled with incidents declared and resolved, post-incident reviews, runbooks and release notes written.
          Add what the desk cannot count: trends you saw, what worries you, and what you need from others. Keep it free of
          any key, host name or detail an outsider could use.
        </p>
      ),
    },
    {
      id: "copilot",
      title: "Using the Copilot",
      body: (
        <>
          <p>
            The Copilot can read health, error trends, the incident log, runbook titles and reminders, and draft an
            incident update, status page wording or a post-incident review. It never reads or shows a key, refuses to
            draft with text that looks like one, saves nothing and publishes nothing.
          </p>
          <ul role="list">
            <li>&ldquo;Is anything late or failing today?&rdquo;</li>
            <li>&ldquo;How are errors trending compared with last week?&rdquo;</li>
            <li>&ldquo;Which reminders run out in the next thirty days?&rdquo;</li>
            <li>&ldquo;Draft an update for the open incident: bookings are slow, we are investigating, next update in an hour.&rdquo;</li>
            <li>&ldquo;Draft status page wording for the same incident. Do not name a cause.&rdquo;</li>
          </ul>
        </>
      ),
    },
    {
      id: "situations",
      title: "Common situations, with a model answer",
      body: (
        <DocTable
          caption="Situations and what to do"
          columns={[
            { key: "situation", label: "Situation" },
            { key: "answer", label: "What to do" },
          ]}
          rows={[
            { id: "late", cells: { situation: "A job shows Late.", answer: "Check the Crash log and the audit log for its last run. Check Provider checks if it talks to a provider. If it cannot be explained in a short time, declare a severity 3 incident and tell the COO." } },
            { id: "spike", cells: { situation: "Errors doubled after a release.", answer: "Declare an incident, note the release code, tell the COO, and hand the facts to whoever deploys. Do not roll back or change anything yourself; you cannot, and that is deliberate." } },
            { id: "key", cells: { situation: "A colleague pastes a key into chat.", answer: "Tell them to stop, tell the COO now, and do not repeat it. Do not write the detail in the log. The key is rotated by the people who hold that access." } },
            { id: "question", cells: { situation: "Someone asks you for access to production.", answer: "That is not yours to give or to ask for. Pass the request, with the reason, to the COO." } },
            { id: "support", cells: { situation: "Support says members cannot pay.", answer: "Ask for a few examples as references, not names. Look at Health and Errors. If many members are affected it is severity 1 or 2: declare it and tell the COO and CEO at once." } },
            { id: "quiet", cells: { situation: "Health shows everything green but members complain.", answer: "Believe the members. Declare an incident at the severity the reports suggest. The panel shows what it can read, not what members feel." } },
          ]}
        />
      ),
    },
    {
      id: "never",
      title: "What you must never do, and when to escalate",
      body: (
        <>
          <ul role="list">
            <li>Never show, ask for, copy or store a key, password, token, connection string or credential, anywhere.</li>
            <li>Never act on infrastructure, the database or a deployment from this desk. It has no such tools.</li>
            <li>Never write an unconfirmed cause as fact in the log or on a status page.</li>
            <li>Never act on money, identity checks, restrictions or access.</li>
            <li>Never report a count you could not read as zero.</li>
          </ul>
          <DocTable
            caption="Where to take it"
            columns={[
              { key: "what", label: "What" },
              { key: "who", label: "Who" },
              { key: "how", label: "How fast" },
            ]}
            rows={[
              { id: "outage", cells: { what: "An outage, a data incident or a payment failure affecting many members", who: "The COO and the CEO", how: "At once" } },
              { id: "leak", cells: { what: "A key or credential may have leaked", who: "The COO", how: "Immediately, without writing the detail" } },
              { id: "change", cells: { what: "Anything that needs infrastructure, a key or the database changed", who: "The people who hold that access, through the COO", how: "With the facts you saw" } },
            ]}
          />
        </>
      ),
    },
    {
      id: "glossary",
      title: "Glossary",
      body: (
        <DocTable
          caption="Words used on this desk"
          columns={[
            { key: "word", label: "Word" },
            { key: "means", label: "Means" },
          ]}
          rows={[
            { id: "incident", cells: { word: "Incident", means: "Something wrong with the platform that needs a person's attention, with a start and an end." } },
            { id: "sev", cells: { word: "Severity", means: "How serious an incident is, from 1 (worst) to 4 (minor)." } },
            { id: "mitigated", cells: { word: "Mitigated", means: "The harm is reduced but the cause is not fixed." } },
            { id: "job", cells: { word: "Scheduled job", means: "Work the platform does on a timer, such as sending emails or sweeping old data." } },
            { id: "runbook", cells: { word: "Runbook", means: "A step list for a known problem." } },
            { id: "release", cells: { word: "Release code", means: "The first seven characters of the commit that is running." } },
            { id: "pir", cells: { word: "Post-incident review", means: "A written look back that finds what to change, without blame." } },
          ]}
        />
      ),
    },
  ],
};
