import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";
import { aboutVallo } from "./role-shared";

/**
 * Chapter 14. Read from `app/admin/social-media` and `lib/admin/social-media`
 * (model, actions, queries) on 14 November 2026: the tabs, the states a post
 * moves through, what each action refuses, and the file limits of the media
 * library. When those change, this chapter changes.
 */
export const SOCIAL_MEDIA: ManualBody = {
  intro: (
    <p>
      This chapter is for the Social Media Manager. You plan what Vallo posts, write and prepare it, get it approved,
      post it by hand on the platform itself, and keep the record of what went out. Your desk is Social media. It is a
      planning and reporting desk: nothing on it connects to a social platform, and it holds no platform password.
    </p>
  ),
  glance: [
    "Your desk is Social media, in the Departments group. Its tabs are Calendar, Drafts and campaigns, Media library and Report.",
    "A post moves from Draft to Awaiting approval to Approved to Posted. A post that will not go out is Cancelled.",
    "The calendar is Monday to Friday with four posting slots a day. A post with no slot sits under No fixed slot.",
    "You post by hand on the real platform, then mark the post as Posted here with its link and time. That is the permanent record.",
    "A post sent back comes with a written reason and returns to Draft.",
    "Platform passwords are never typed into the console, a draft or a note.",
  ],
  sections: [
    ...aboutVallo({
      who: "the Social Media Manager",
      keeps:
        "What Vallo posts is read as a promise. A post about fees, review or how money moves has to say what the platform does today, in the same words the product uses, and nothing it cannot yet do.",
    }),
    {
      id: "getting-in",
      title: "Getting to your desk",
      body: (
        <>
          <DocFlow
            label="From signing in to your desk"
            steps={[
              { icon: "user", title: "Sign in", outcome: "With your own Vallo account, the one that was given staff access." },
              { icon: "grid", title: "Open the console", outcome: "The console is the Vallo address followed by /admin.", href: "/admin" },
              { icon: "key", title: "Confirm with your security key", outcome: "Once each time you sign in, and again after twelve hours." },
              { icon: "document", title: "Read the handbook", outcome: "Acknowledge it once; a new version asks again.", href: "/admin/handbook" },
              { icon: "camera", title: "Open Social media", outcome: "It opens on this week's calendar.", href: "/admin/social-media" },
            ]}
          />
          <DocCallout tone="note" title="If your security key does not answer">
            Your key is the Face ID, fingerprint or screen lock of the device where you set it up. On another device,
            press Confirm and choose the option to use a phone or tablet, then scan the code with the phone that holds
            the key. If the device is lost, ask a super admin to clear the key on the Staff desk.
          </DocCallout>
        </>
      ),
    },
    {
      id: "the-desk",
      title: "The desk and its tabs",
      body: (
        <DocTable
          caption="The Social media desk, tab by tab"
          columns={[
            { key: "tab", label: "Tab" },
            { key: "use", label: "What it is for" },
            { key: "when", label: "When you use it" },
          ]}
          rows={[
            { id: "calendar", cells: { tab: "Calendar", use: "This week, Monday to Friday, with four posting slots a day: 8am to 11am, 11am to 2pm, 2pm to 6pm and 6pm to 9pm.", when: "Every morning, and when planning the week." } },
            { id: "drafts", cells: { tab: "Drafts and campaigns", use: "Write a new draft and see every post with its status: platform, category, format, campaign, caption and files.", when: "Whenever you write, send for approval, or record a post." } },
            { id: "media", cells: { tab: "Media library", use: "The images and short videos you may attach to a post.", when: "Before writing a draft that needs a picture or a video." } },
            { id: "report", cells: { tab: "Report", use: "This week's figures, and what was posted this month by platform and by category.", when: "For your weekly report and the monthly review." } },
          ]}
        />
      ),
    },
    {
      id: "a-post",
      title: "One post, from draft to posted",
      body: (
        <>
          <DocFlow
            label="One post"
            steps={[
              { icon: "pencil", title: "Draft", outcome: "Platform, category, format, planned date, slot, campaign, caption and files.", href: "/admin/social-media?tab=drafts" },
              { icon: "send", title: "Send for approval", outcome: "The post waits for a decision and can no longer be edited." },
              { icon: "circle-check", title: "Approved, or sent back", outcome: "Sent back returns it to Draft with a written reason." },
              { icon: "camera", title: "Post it by hand", outcome: "On the platform itself, in its own app or browser tab." },
              { icon: "history", title: "Mark as posted", outcome: "With the link to the live post and the time it went out." },
            ]}
          />
          <ul role="list">
            <li>
              <strong>A draft needs</strong> a platform, a category and a planned date. The caption can come later. A
              campaign name groups posts that belong together.
            </li>
            <li>
              <strong>Editing.</strong> Only a draft can be edited. To change a post that is awaiting approval, have it
              sent back first.
            </li>
            <li>
              <strong>Approval.</strong> Anybody who holds the Social media area, or an admin, can approve or send back.
              Sending back needs a reason of at least five characters, and you read it on the post.
            </li>
            <li>
              <strong>Marking as posted.</strong> Only an approved post can be marked. Paste the post&apos;s link if the
              platform gives one, and set the date and time it went out.
            </li>
            <li>
              <strong>Cancelling.</strong> A post that will not go out is cancelled, with an Undo on the banner. A
              restored post comes back as a Draft and goes through approval again.
            </li>
          </ul>
          <DocCallout tone="note" title="A second pair of eyes">
            The desk does not stop a person approving a post they wrote. For anything about fees, money, a named person
            or a partner, ask a colleague or the COO to read it and approve it rather than approving your own.
          </DocCallout>
        </>
      ),
    },
    {
      id: "media-library",
      title: "The media library",
      body: (
        <ul role="list">
          <li>
            <strong>What it takes.</strong> Images as JPEG, PNG, WebP or GIF up to 10 MB, and videos as MP4, MOV or WebM
            up to 100 MB.
          </li>
          <li>
            <strong>Attaching.</strong> Upload first, then choose the file when you write the draft. A post can carry up
            to twenty files.
          </li>
          <li>
            <strong>Removing.</strong> A file attached to a post cannot be removed. Take it off the post first.
          </li>
          <li>
            <strong>Whose pictures.</strong> Use only pictures and video Vallo may use: its own, or a member&apos;s with
            their written agreement. A listing photograph belongs to its lister; ask before it goes on a public channel.
          </li>
        </ul>
      ),
    },
    {
      id: "wording",
      title: "What a post may say",
      body: (
        <>
          <ul role="list">
            <li>Say what the product does today. Never promise a feature, a date or a price the app does not have today.</li>
            <li>Use the product&apos;s own money wording. If you are not sure how to describe a fee or a payment, ask before you post.</li>
            <li>Never post a member&apos;s name, face, phone number, address or message without their written agreement.</li>
            <li>A complaint in the comments is a support matter. Point the person to Help in the app and tell the support team.</li>
          </ul>
          <p>
            Where to take what you cannot decide is in{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalation and out of hours
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "reporting",
      title: "Your report, and what is written down",
      body: (
        <>
          <p>
            The Report tab counts only posts marked as Posted, so mark each one the day it goes out. Your weekly report
            is described in{" "}
            <Link href="/admin/manual/weekly-report" className={A}>
              Weekly report
            </Link>
            .
          </p>
          <p>
            Creating, sending, approving, sending back, posting and cancelling are each written to the audit log with
            your name and the time.
          </p>
        </>
      ),
    },
  ],
};
