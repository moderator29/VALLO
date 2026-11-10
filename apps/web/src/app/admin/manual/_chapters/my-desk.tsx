import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 7. Read from My Desk's own code on 10 November 2026
 * (`app/admin/my-desk`, `lib/admin/my-desk/model.ts` for who may assign and
 * who may post, `lib/admin/my-desk/actions.ts` for every refusal named
 * below). If a rule in `model.ts` changes, this chapter changes with it.
 */
export const MY_DESK: ManualBody = {
  intro: (
    <p>
      My desk is your own page in the console. Every member of staff and every admin has one. It tells you who you are
      here, what needs you today, and where to find help. Beside it are two tools: tasks, for the work you owe or have
      handed on, and announcements, for what the company needs everyone to know.
    </p>
  ),
  glance: [
    "Open My desk first thing. The first button in your frame and the second group in the sidebar both lead to it.",
    "You can make a task for yourself at any time. Handing a task to a colleague is for the COO, the operations team and admins.",
    "Only the person a task is assigned to changes its status. Anyone involved can comment.",
    "Only the COO and admins post announcements. Everyone reads what is addressed to all staff or to their own access area.",
    "Everything you create or change here is written to the audit log with your name.",
  ],
  sections: [
    {
      id: "opening",
      title: "Opening My desk",
      body: (
        <>
          <ol role="list">
            <li>
              Sign in and prove your security key as usual. If you are a staff member, acknowledge the{" "}
              <Link href="/admin/handbook" className={A}>
                staff handbook
              </Link>{" "}
              first. Until you do, My desk tells you to read it and shows nothing else.
            </li>
            <li>
              Press <strong>My desk</strong>, the first button in your frame. Operators find it in the sidebar under the
              My Desk group, and under Overview.
            </li>
            <li>
              You arrive at{" "}
              <Link href="/admin/my-desk" className={A}>
                My desk
              </Link>
              . Four tabs sit under the title: My desk, Tasks, Announcements and Weekly report. The weekly report has its own chapter.
            </li>
          </ol>
        </>
      ),
    },
    {
      id: "reading-it",
      title: "Reading your desk",
      body: (
        <>
          <p>The page is laid out from top to bottom in the order you need it.</p>
          <ul role="list">
            <li>
              <strong>Who you are.</strong> Your name, your position, your department, who you report to and the access
              areas you hold. An admin has no named position and reads as Admin or Super admin.
            </li>
            <li>
              <strong>Needs your attention.</strong> Your open tasks and how many are overdue, your unread
              announcements, and one row for each desk your access opens. Where the console can count the work waiting on
              a desk, the row shows the figure. Where it cannot, the row is a link and says nothing about a number. A
              figure that cannot be read just now is left out rather than guessed.
            </li>
            <li>
              <strong>This week.</strong> How many tasks you completed since Monday.
            </li>
            <li>
              <strong>What you are responsible for, and what is expected of you.</strong> The same words as your
              position page, so you never have to hunt for them.
            </li>
            <li>
              <strong>Where to find guidance.</strong> Links to your position page, the handbook and this manual.
            </li>
          </ul>
          <p>
            The copilot button sits at the corner of the page. Open it and ask in plain words, for example &quot;What
            should I do first today?&quot; or &quot;Where do I record a refund?&quot; It knows your position and the
            figures on this page. It does not make decisions for you.
          </p>
        </>
      ),
    },
    {
      id: "tasks",
      title: "Tasks, step by step",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/my-desk/tasks" className={A}>
              Tasks
            </Link>
            . Your own work is under Assigned to me, with overdue tasks first, then the rest by priority and due date.
            Finished tasks sit at the bottom.
          </p>
          <h3>Make a task for yourself</h3>
          <ol role="list">
            <li>Under New task, type a title. The title is the only required field.</li>
            <li>Add a detail if the title is not enough, a due date, and a priority from Low to Urgent.</li>
            <li>
              If the task is about a desk, choose it under Related desk. If there is a console page to open, paste its
              address under Console link. It has to start with /admin. Anything else is refused.
            </li>
            <li>Press Create task. A banner at the top confirms it, and the task appears in your list.</li>
          </ol>
          <h3>Move a task along</h3>
          <ol role="list">
            <li>Find the task in Assigned to me.</li>
            <li>Change the Status: To do, In progress, Blocked or Done.</li>
            <li>A banner at the top says what changed, with Undo for a few seconds if you picked the wrong status.</li>
            <li>
              Choosing Done stamps the finish time and counts the task in Completed this week. You can move a finished
              task back if it was closed by mistake.
            </li>
          </ol>
          <p>
            Only the person a task is assigned to can change its status. If you made a task for a colleague and want to
            know where it stands, add a comment.
          </p>
          <h3>Comment on a task</h3>
          <ol role="list">
            <li>Type under Comments on the task and press Comment.</li>
            <li>
              The assignee, the person who created the task and any admin can comment. Comments cannot be edited or
              removed, so write them as you would in a case note.
            </li>
          </ol>
          <h3>Hand a task to a colleague</h3>
          <p>
            The Assign to list appears only if you hold the COO position, the operations access area or an admin role.
            Choose the person and create the task as above. The person must be a member of staff. You can move an
            unfinished task to someone else with Reassign, and Undo on the banner hands it back. Tasks you hand on appear under Handed to others.
          </p>
          <DocCallout tone="note" title="If you do not see Assign to">
            It is not a fault. Ask your COO or an admin to create the task for the person, or to give you the access area.
          </DocCallout>
        </>
      ),
    },
    {
      id: "announcements",
      title: "Announcements, step by step",
      body: (
        <>
          <p>
            Open{" "}
            <Link href="/admin/my-desk/announcements" className={A}>
              Announcements
            </Link>
            . You see everything addressed to all staff, and everything addressed to an access area you hold. Pinned
            announcements come first, then the newest.
          </p>
          <h3>Reading and marking read</h3>
          <ol role="list">
            <li>An unread announcement carries an Unread label. The count of unread ones is on My desk and at the top of this page.</li>
            <li>Press Mark as read on one, or Mark all as read to clear the list.</li>
            <li>Marking read is personal. Nobody sees whether you did, and it is not written to the audit log.</li>
          </ol>
          <h3>Posting one (COO and admins only)</h3>
          <ol role="list">
            <li>Under Post an announcement, write a title and the message.</li>
            <li>Choose Who it is for: all staff, or one access area.</li>
            <li>Tick Pin to the top if it must stay above newer ones, then press Post announcement.</li>
            <li>Pin or unpin it later from the same card.</li>
          </ol>
          <p>
            An announcement cannot be edited after it is posted. If it was wrong, post a corrected one and pin it. Do not
            put a member&apos;s personal details in an announcement.
          </p>
        </>
      ),
    },
    {
      id: "rules",
      title: "What is written down, and what is refused",
      body: (
        <>
          <ul role="list">
            <li>Creating a task, reassigning it, changing its status, commenting, posting and pinning are each written to the audit log with your name.</li>
            <li>The server asks again who you are every time you press a button. A button you can see but are not allowed to use is refused with a plain sentence.</li>
            <li>If the audit line cannot be written, the console tells you so after the action. The action itself has still happened. Tell operations.</li>
            <li>If you see &quot;not on this database yet&quot;, the tasks tables have not been switched on. This is not your fault. Tell the lead.</li>
          </ul>
          <p>
            For where to take what you cannot decide, read{" "}
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
