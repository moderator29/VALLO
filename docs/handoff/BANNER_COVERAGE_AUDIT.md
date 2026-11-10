# BANNER COVERAGE AUDIT: Circle, Feed and social, Admin

November 2026. Founder: one native-feeling feedback pattern everywhere, the
Inbox archive as the reference ("Archived. It is under Archived. Undo", with a
close button). Scope: Circle, the Feed and social (Around, posts, comments,
stories, profile), the admin panel (not copilot, my-desk/weekly, reports).

Result of the audit: the banner was already on nearly every action (the
November banner sweep). What was missing was (1) a few silent successes and
(2) Undo almost everywhere. Undo is one helper, `lib/ui/undo-banner.ts`
(`bannerWithUndo`): says the outcome, offers Undo, Undo calls the real
inverse, reports through a banner, ignores a second press, says the server's
own sentence if the inverse is refused (so a stale Undo is safe).

Columns: A = outcome said by a banner; R = a real inverse exists server side;
U = banner carries Undo now. "state" means the control shows the result itself
(a heart, a pressed button) and the action is cheap to repeat.

## Circle (`app/(app)/circle/_parts/CircleActions.tsx`)

| Action | A | R | U | Note |
|---|---|---|---|---|
| Join a community | yes | leave | yes (added) | request to a private community: banner only, there is no withdraw-request action |
| Leave a community | yes | join | yes (added), public only | private: banner says a new request is needed, no Undo |
| Mark helpful / remove | added | same toggle | yes (added) | |
| Accept / unaccept answer | added | accept null / accept id | yes (added) | |
| Follow / unfollow a question | added | same toggle | yes (added) | |
| Send invite | yes | withdraw invite | yes (added) | invitee may have seen the notice, banner says so |
| Accept / decline invite | yes | none | no | decision tied to the other person |
| Withdraw invite | yes | none (needs invitee) | no | |
| Vouch / withdraw vouch | yes | none (note is gone) | no | |
| Approve / decline join request | added | none | no | the person is notified; Remove is a separate action |
| Remove member | yes (confirm first) | none | no | irreversible, confirm kept |
| Save settings, post, reply, create community | yes | n/a | no | publishing/creating |

## Feed and social

| Action | A | R | U | Note |
|---|---|---|---|---|
| Save / unsave post (Feed, thread) | added | same toggle | yes (added) | |
| Mute / block from a post (Feed, thread, comments, story) | yes | unmute / unblock | yes (added) | story block now says it before leaving the page |
| Mute from profile menu | yes | unmute | yes (added both ways) | |
| Block from profile | page state (designed screen with its own Undo) | unblock | kept | unblock now also says it |
| Follow / unfollow (profile, lists) | added | toggle | yes (added) | |
| Join / leave an area | yes | leave / join | yes (added) | |
| Save a story | added | toggle (no `want`) | no | the story toggle has no `want` argument, so a stale Undo could flip a later tap |
| Like, repost (post, story, comment) | state | same toggle | no | the heart/count is the outcome, a banner each tap is noise |
| Withdraw moderator application | yes | needs the reason again | no | |
| Apply to moderate, propose area, publish, edit, reply, comment | yes | n/a | no | publishing |
| Delete post / story / comment | yes (slide confirm) | none | no | irreversible, DeleteSheet kept |
| Report post / profile / comment | yes | none | no | |

## Admin

| Action | A | R | U | Note |
|---|---|---|---|---|
| Ticket: take / hand back | added | the other one | yes (added) | |
| Case: awaiting information / back to review | yes | the other one | yes (added) | |
| Case: close | yes | reopen | yes (added) | Undo reopens with a recorded reason |
| Case: take, note, escalate, message, act, restrict, resolve | yes | none or decision | no | decisions, messages and restrictions are not undone |
| My desk: task status | yes | previous status | yes (added) | server checks the status is still what it was |
| My desk: reassign | yes | previous assignee | yes (added) | only when there was one |
| My desk: pin / unpin announcement | yes | toggle | yes (added) | |
| My desk: mark announcement read | yes | none | no | there is no delete grant on `staff_announcement_reads`; would need SQL (not applied) |
| Social media: cancel a post | yes (now says where it went) | none existed | yes (added) | new `restoreCancelledPost`, returns it as a DRAFT only; approval must be redone |
| Safety hold: clear / extend | added | none | no | a decision on record |
| Alert acknowledge, queue take/release, bulk, saved views | yes (arrival banner for queue forms) | take/release exist | no | queue forms are server redirects (BannerOnArrival cannot hold a function); left |
| Every other desk (money, KYC, compliance, appeals, standing, referrals, staff, chargebacks, etc.) | yes | decisions | no | approving, rejecting, money, restriction: no Undo by rule |

## Exceptions list (`no-inline-outcome.test.ts`)

Every remaining row is a page state or data. The two TO CONVERT NEXT rows
(`PhoneField`, `SupportChat`) are outside Circle, social and admin and were
left. No counts changed.

## Native feel (what exists)

All banners go through `lib/ui/toast.ts` and are drawn by `ToastHost` in the
root layout, so /admin, Circle and Roommates share one banner. The host has an
X on every banner, swipe up or sideways to dismiss, and a longer dwell when
the banner has an action. The host fires NO haptic itself: haptics are called
by the action handlers through `lib/ui/feedback.ts` (`useDesk` and the case
desk fire `confirm`; Feed like/save fire `select`). So haptic coverage is
per caller, not per banner, and the Undo helper does not add one. No new
native plugin was added; a haptic on the shared host or on `bannerWithUndo`
would be the one place to make it uniform, and was not done here.
