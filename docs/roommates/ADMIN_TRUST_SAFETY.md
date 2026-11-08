# Vallo Trust and Safety: the admin for Roommates, Circle and every module

Built 8 November 2026 on top of the existing console (no rebuild). The SQL is
part 7 of `supabase/migrations/pending/ROOMMATES_ALL.sql`; the end to end test
is `supabase/tests/roommates/e2e_trust.sql` (passes on the local stub).

## 1. What existed, and what was added

| Existing (kept, reused) | Added |
|---|---|
| `reports` (every report form, the Unified queue's Reports lane) | A CASE per thing reported: `moderation_cases`, opened by a trigger on every new report, joined by later reports on the same thing |
| `queue_claims` (claim an item) | Case ownership: assign to me or a colleague, with a deadline by severity |
| `audit_log` | Every case action and restriction writes to it |
| `staff_grants` scopes + `private.staff_can` (handbook ack, console step up) | Four scopes: `trust_safety`, `roommates`, `circle`, `analyst`; one rule `private.case_can(user, module, action)` |
| Held content lane, posts `HELD`/`REMOVED` | Case actions hold, remove and restore content (feed, Circle, room posts, profiles, groups, communities) |
| `agent_suspensions` (listers only) | `member_restrictions` for every member: warning, messaging, posting, roommates, suspended; enforced in the database |
| `review_contests` (reviews only) | `moderation_appeals` for any restriction, decided by someone else |
| `/admin/people/[id]` | Linked from every case's member panel |

Old open reports were back-filled into cases when the SQL runs.

## 2. Navigation (Moderation group of the console rail)

| Desk | Route | Who opens it |
|---|---|---|
| Cases (every module, one queue) | `/admin/cases`, `/admin/cases/[id]` | trust_safety, moderation, roommates, circle, support, listing_approval (each sees only modules their scope allows) |
| Trust overview | `/admin/trust` | everyone above plus analyst |
| Appeals | `/admin/appeals` | trust_safety and admins |
| Roommates | `/admin/roommates` | roommates, trust_safety (documents tab: kyc_review, trust_safety) |
| Circle | `/admin/circle` | circle, moderation, trust_safety |
| Member: Account standing | `/settings/standing` | the member |

Staff with a scope (not admins) get the short StaffFrame, which now lists these
desks for the new scopes.

## 3. The roles matrix (`private.case_can`)

| Action | trust_safety / admin | roommates | circle / moderation | listing_approval | support | kyc_review | analyst |
|---|---|---|---|---|---|---|---|
| View cases | all modules | Roommates | Circle, feed (moderation also stays, messages, account) | property | all (view only) | no | no |
| Note, escalate | yes | own module | own module | own module | yes | no | no |
| Message a member on a case | yes | own module | own module | own module | yes | no | no |
| Assign, status, resolve, act on content | yes | own module | own module | own module | no | no | no |
| Restrict (warning, messaging, posting, roommates) up to 30 days | yes | own module | own module | no | no | no | no |
| Suspend, or restrict longer than 30 days or with no end | yes | no | no | no | no | no | no |
| Verification documents | yes | no | no | no | no | yes | no |
| Decide appeals | yes (never their own decision) | no | no | no | no | no | no |
| Overview numbers | yes | yes | yes | no | no | no | yes |

Every rule is enforced in the database (SECURITY DEFINER functions calling
`case_can`, RLS on every table). The screens only decide which buttons to
draw, from the same answer (`admin_case_view.can`).

## 4. The case workflow

1. A member reports (any existing report form). The trigger opens a case or
   joins the open one for the same thing; module, category, severity and the
   team are set from what was reported; deadlines: critical 4 hours, high 24,
   medium 72, low 7 days. Three or more reports raise severity one level.
2. New (top of the queue by severity and deadline). A moderator takes it
   (Under review). Notes are internal. "Awaiting information" while waiting
   on a member; "Message a member" sends a notice from Vallo Trust and
   Safety (never a chat, never naming the reporter).
3. Escalate (with a reason): severity at least high, 24 hour deadline, Trust
   and Safety team.
4. Act on the content (hold, remove, restore, close a group, pause a
   community, revoke a verification), each with a reason, each reversible.
5. Restrict the member (they are told at once with the reason, and can
   appeal from Settings, Account standing).
6. Resolve with an outcome and a note; linked reports close with it;
   reporters are told the outcome in plain words ("action taken" or
   "reviewed, no breach"). Close, or reopen with a reason.
7. Appeals: a different staff member decides; overturning lifts the
   restriction and tells the member.

The timeline (`moderation_case_events`) records every step: who, what,
when and why. Evidence files go to the private `moderation-evidence` bucket
and open through five minute signed links after the database says yes.

## 5. Privacy

- A case shows the reported item only: the reported message, not the thread;
  a group's members and board only when the group itself is reported.
- Roommate preferences and private profile fields are never shown on the
  desks; the signals view is counts only.
- Verification documents: kyc_review and trust_safety only, five minute
  links, every opening in the audit log, never your own.
- Members see their own restrictions and the outcome of their own reports,
  never who reported them or what happened to someone else.

## 6. Scale

Indexes on case status, severity, deadline, module, assignee and subject;
the case list pages 50 at a time; one open case per reported thing (a unique
index), so a pile-on of reports never becomes a pile of cases.

## 7. Next (proposed, not built)

- Two-person approval for permanent suspensions (today: Trust and Safety
  only, with a required reason and a full audit trail).
- SLA breach alerts into `/admin/alerts` and the staff's own notifications.
- Saved replies for common member messages.
- Bulk resolve for spam waves (with a mandatory shared reason).
- Realtime refresh of the queue (the console's LiveRefresh component).
