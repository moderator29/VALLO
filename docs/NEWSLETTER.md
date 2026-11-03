# The platform newsletter

Vallo's first letter to every member. The words and design are
`apps/web/src/lib/email/newsletter-message.ts` (`platformNewsletter`). Nothing
sends it automatically: no trigger, no cron, no button in the app.

## Preview it

Run the web app in development and open `/preview/email/newsletter` (add
`?name=Ada` to change the greeting). It shows the phone width, the desktop
width and the plain-text part. The images load from `public/`.

## Send it (the founder does this once)

1. Deploy the code first. The drain drops a row whose template the running
   build does not know (`platform.newsletter` is registered in
   `lib/notify/templates.ts`).
2. Make sure the migration `20261103140500_newsletter_enqueue.sql` is applied.
3. Replace the four placeholder banners (below) and deploy, if the real art is
   ready. Emails fetch images from the production site, so the files must be
   live before the first send.
4. In the Supabase SQL editor, run once:

   ```sql
   select public.newsletter_enqueue('2026-11-launch');
   ```

   It answers with the number of rows queued. Running it again with the same
   campaign name queues nothing (the key is `newsletter:<campaign>:<user id>`
   and is UNIQUE). A new letter needs a new campaign name.
5. The outbox cron (`/api/cron/email-outbox`) sends the queued rows in batches.

Who gets a row: every account that is not anonymous, not deleted, has a
confirmed email and has not switched marketing email off. The send step checks
that switch again, so someone who turns it off after queueing is skipped.
Settings shows marketing as off until a member turns it on, but the mail layer
only silences an explicit off. To send only to members who explicitly opted in,
run `select public.newsletter_enqueue('2026-11-launch', true);` instead.

Every email already carries the footer with the notification settings link,
support and legal links, and the marketing channel adds the `List-Unsubscribe`
one-click headers.

## Rate limits

The drain takes 50 rows per run and runs every 15 minutes (`vercel.json`), so
about 200 emails an hour. A large audience therefore takes many hours, and the
queue-backlog alert (rows due for more than 20 minutes) will fire while it
drains. That is expected for this send. Raise `DRAIN_BATCH` in
`lib/notify/outbox.ts` (mind the Resend plan's rate limit) if it should go
faster. Watch progress with `select status, count(*) from email_outbox where
template = 'platform.newsletter' group by 1;`.

## Replace the banners

Four placeholder pictures, 1200 x 480 PNG, shown 520 wide:

- `apps/web/public/brand/email/banners/newsletter-1.jpg`
- `apps/web/public/brand/email/banners/newsletter-2.jpg`
- `apps/web/public/brand/email/banners/newsletter-3.jpg`

Save the new art over the file of the same name, at exactly 1200 x 480 (the test
checks the size). Prompts are in `docs/EMAIL_BANNER_PROMPTS.md`. Keep the text
short: the words of the letter are live text and never live in a picture.

## What the letter may and may not say

No user counts, dates, returns, "insured" or "guaranteed", and nothing
"verified" that the code cannot back. The roadmap is what is being built, not a
promise. The tests in `newsletter-message.test.ts` hold this.
