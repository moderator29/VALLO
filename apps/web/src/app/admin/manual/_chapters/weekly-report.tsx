import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 8. Read from the weekly report's own code on 10 November 2026
 * (`lib/admin/weekly-reports/week.ts` for the week and its times,
 * `model.ts` for the fields, limits and who may review, `prefill.ts` for the
 * counted figures, `actions.ts` for every refusal named below). If a rule in
 * those files changes, this chapter changes with it.
 */
export const WEEKLY_REPORT: ManualBody = {
  intro: (
    <p>
      Every member of staff and every admin writes one report a week: what was achieved, the numbers, what is in the
      way, what happens next week, and proof. It is saved week by week, so there is a record of each one. This chapter
      explains when the form opens, what each part asks, what the console fills in for you, how to add proof, and what
      a reviewer does with it.
    </p>
  ),
  glance: [
    "The form opens every Saturday at midnight, Lagos time, and is due on the Monday after, at 12:00.",
    "A week runs Monday to Sunday, Lagos time. You write one report for each week.",
    "Save a draft as often as you like. Press Submit when it is ready. A report sent after Monday 12:00 is saved and marked late.",
    "Some numbers are counted for you from your own desk and are marked as prefilled. You can change them; the original count stays visible.",
    "Proof is a link or a file. Only links that start with https are kept. Files are images, PDFs or short videos.",
    "After you submit you can keep editing until a reviewer has marked the report reviewed. A reviewer can reopen it.",
  ],
  sections: [
    {
      id: "when",
      title: "When it opens and when it is due",
      body: (
        <>
          <ol role="list">
            <li>
              Open{" "}
              <Link href="/admin/my-desk/weekly" className={A}>
                Weekly report
              </Link>{" "}
              from My desk. A strip at the top of My desk tells you where this week stands.
            </li>
            <li>
              Before Saturday the page says <strong>Opens Saturday</strong> with the date, and shows what the report
              will ask. You cannot save anything until it opens.
            </li>
            <li>
              From Saturday 00:00 Lagos time the form is open for the week in progress. You can write on Saturday and
              Sunday, or wait until Monday morning.
            </li>
            <li>
              The report is due on Monday at 12:00, Lagos time. From Monday 00:00 the page shows the week that just
              ended, until the next Saturday.
            </li>
          </ol>
          <DocCallout tone="note" title="How the week is counted">
            A week starts on Monday at 00:00 and ends on Sunday at 23:59, Lagos time. A report is named by the Monday
            of its week. The same time is used for everyone, wherever they are working from.
          </DocCallout>
        </>
      ),
    },
    {
      id: "parts",
      title: "What each part asks",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>What I achieved this week.</strong> Write what you finished, against the targets you were given.
              Plain sentences are fine. This part is needed before you can submit.
            </li>
            <li>
              <strong>My numbers.</strong> One row for each figure: its name, the number, and the target if you have
              one. Add a row for anything you want your reviewer to see.
            </li>
            <li>
              <strong>Blockers and what I need.</strong> What got in the way, and what you need from someone to move on.
            </li>
            <li>
              <strong>Next week&apos;s plan.</strong> What you will do next week, most important first.
            </li>
            <li>
              <strong>Proof.</strong> Screenshots, links and files that show the work.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "numbers",
      title: "What is filled in for you, and what you type",
      body: (
        <>
          <p>
            The console counts what it can from your own desk and puts it in your numbers as rows marked{" "}
            <strong>Prefilled from the desk</strong>. A reader can then tell what the system counted from what you typed.
          </p>
          <ul role="list">
            <li>
              <strong>Everyone:</strong> tasks completed, from{" "}
              <Link href="/admin/my-desk/tasks" className={A}>
                your tasks
              </Link>
              , for tasks assigned to you and finished that week.
            </li>
            <li>
              <strong>Social Media Manager:</strong> posts planned and posted, and the same by feed post, reel and story,
              from the{" "}
              <Link href="/admin/social-media" className={A}>
                social media desk
              </Link>
              .
            </li>
            <li>
              <strong>Business Development Director:</strong> prospects identified, businesses contacted, follow-ups,
              businesses onboarded and listings submitted, from the{" "}
              <Link href="/admin/business-development" className={A}>
                business development desk
              </Link>
              .
            </li>
          </ul>
          <p>
            You can change any prefilled number. If you do, the row keeps what the desk counted, so the reviewer sees
            both. <strong>Refresh the desk counts</strong> replaces the prefilled rows with the latest counts and leaves
            the rows you typed alone. Targets are always yours to type; the console does not guess them.
          </p>
          <p>
            If a desk is not set up yet, or cannot be read just now, its rows are left out rather than shown as zero.
            Type the figures yourself.
          </p>
        </>
      ),
    },
    {
      id: "proof",
      title: "Adding proof: a link or a file",
      body: (
        <>
          <p>Proof sits under the numbers. Add as many as the week needs, up to twenty. Give each one a short caption saying what it shows.</p>
          <h3>A link</h3>
          <ol role="list">
            <li>Copy the address from the browser or the app.</li>
            <li>Paste it under Link. It must start with https://. A link with a login in it is refused.</li>
            <li>Type what it shows and press Add link.</li>
          </ol>
          <h3>A file</h3>
          <ol role="list">
            <li>Press the file chooser and pick an image (JPEG, PNG, WebP or GIF), a PDF or a short video (MP4, MOV or WebM).</li>
            <li>Images and PDFs can be up to 10MB. Videos can be up to 100MB.</li>
            <li>Type what it shows and press Upload file. Files are kept in a private store. You and the people who review reports can open them, through a link that lasts ten minutes.</li>
          </ol>
          <h3>Examples for the Social Media Manager</h3>
          <ul role="list">
            <li>A link to each post that went live, with the caption &quot;Reel on Lekki shortlets, Instagram&quot;.</li>
            <li>A screenshot of the platform&apos;s insights page for the week, as a file.</li>
            <li>The week&apos;s planning sheet as a PDF.</li>
          </ul>
          <h3>Examples for the Business Development Director</h3>
          <ul role="list">
            <li>A screenshot of a signed partner agreement or a confirmation message from a landlord, as a file.</li>
            <li>A link to a listing a partner submitted this week.</li>
            <li>A photo of the meeting notes, or a PDF of the proposal you sent.</li>
          </ul>
          <DocCallout tone="warning" title="Keep personal details out of proof">
            Do not upload a member&apos;s identity document, bank details or private messages as proof. Hide or crop
            what is not needed. A reviewer needs to see the work, not a person&apos;s private information.
          </DocCallout>
          <p>
            You can remove a piece of proof while the report is a draft or has been reopened. Once the report is
            submitted you can add proof but not remove it.
          </p>
        </>
      ),
    },
    {
      id: "steps",
      title: "Saving a draft and submitting, step by step",
      body: (
        <>
          <ol role="list">
            <li>Open Weekly report once the form is open.</li>
            <li>Write what you achieved. Check the prefilled numbers and add your own rows and targets.</li>
            <li>Write your blockers and next week&apos;s plan, then add proof.</li>
            <li>Press <strong>Save draft</strong> at any point. The console tells you it was saved. You can leave and come back.</li>
            <li>When it is ready, press <strong>Submit report</strong>. The page shows the status as Submitted, with the time.</li>
          </ol>
          <p>
            Adding a proof saves your proof, but not the words you have typed. Press Save draft before you leave the page.
          </p>
        </>
      ),
    },
    {
      id: "late",
      title: "Late, editing after you submit, and reopening",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Late.</strong> A report submitted after Monday 12:00 Lagos time is saved in full and marked
              late. You can still file a past week whose form has opened; nothing is lost by being late, but the mark stays.
            </li>
            <li>
              <strong>Editing after you submit.</strong> The button becomes Save changes. You can change the words,
              the numbers and add proof until a reviewer marks the report reviewed.
            </li>
            <li>
              <strong>Reviewed.</strong> A reviewed report is read-only. Your reviewer&apos;s note, if there is one,
              is shown above it.
            </li>
            <li>
              <strong>Reopened.</strong> If a reviewer reopens the report, the page shows their reason. Make the change
              and submit again. The late mark from the first submission stays as it was.
            </li>
          </ul>
          <p>Past weeks are listed at the foot of the page, newest first. Open one to read it or, if it is not reviewed, to finish it.</p>
        </>
      ),
    },
    {
      id: "reviewers",
      title: "What a reviewer does, and who sees a report",
      body: (
        <>
          <p>
            Admins, super admins and the COO review reports at{" "}
            <Link href="/admin/reports/weekly" className={A}>
              Weekly reports
            </Link>
            . Nobody else sees another person&apos;s report.
          </p>
          <ol role="list">
            <li>Pick a week. The newest is shown first.</li>
            <li>
              The table lists every current member of staff with Submitted, Draft, Not started or Reopened, a Late mark
              where it applies, and a line at the top: submitted n of m, late n.
            </li>
            <li>Press Open on a row to read the report with its numbers and proof.</li>
            <li>Write a note if useful and press <strong>Mark reviewed</strong>, or write the reason and press <strong>Reopen</strong> so the person can change it.</li>
            <li>Download as CSV gives the week as a plain text file.</li>
          </ol>
          <p>
            A reviewer cannot mark their own report reviewed; another reviewer does that. Submitting, editing, adding
            and removing proof, reviewing and reopening are each written to the audit log with the name of the person who did it. If you
            see &quot;not on this database yet&quot;, the weekly reports table has not been switched on. Tell the lead. For where to take
            anything else, read{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalation and out of hours
            </Link>
            .
          </p>
        </>
      ),
    },
  ],
};
