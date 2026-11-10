# BRIEF FOR NIGERIAN COUNSEL

Prepared 10 November 2026 for the founder to forward. This is a list of questions, not legal text and not advice. Every reference to a statute or a regulator is there so counsel can confirm it applies, not because we assert it. Nothing here changes a live page.

Company: Vallo Spaces Ltd, Abuja. Live pages named below: https://vallo.ng/terms, /privacy, /cancellations (check the host before sending).

## 1. Context in plain words

Vallo is a marketplace in Nigeria for homes, land, hotels, shortlets and restaurant tables. Agents, landlords and hosts list; renters and guests search, message, book and, for stays, pay.

Money. Vallo does not keep a wallet or a balance for anyone. A guest pays by card through Paystack, and the lister's share goes to their bank account in the same transaction. The platform fee is taken from the lister's share and shown to the lister in naira before they agree. Renters and guests are charged nothing extra. Refunds go back to the card or bank account used, through the payment processor. The previous payment provider has been removed and the privacy notice updated; the protected rail provider is not live, and no payment is held by anyone other than the card processor today.

Data. Members give a name, email or phone, and a profile. Listers who want to be approved as agents upload a government ID document, a NIN, a selfie and bank details, which are reviewed by Vallo staff. Members message each other, save places, get push notifications, and may use an AI assistant powered by Anthropic (United States). Roommates is a new section for finding a roommate or a room, mostly for students and young professionals. The database and files are stored in Ireland (EU). A fuller list is in DATA_INVENTORY.md.

People. Vallo staff can see reports and run desks (support, verification, money records). Every privileged action is written to an audit log.

## 2. Open items

### 2.1 Complaints route to the NDPC and a Data Protection Officer contact

Question. Does Vallo need a named Data Protection Officer and a published contact for data requests, and what should the complaints route say?
Why it matters. The NDPA 2023 gives data subjects rights and a route to the Nigeria Data Protection Commission (NDPC). Whether our size and processing require a DPO, and what must be published, is for counsel to confirm.
Today. Privacy section 8 (/privacy#your-rights): "To exercise any of the others, write to us through [the contact form]. We respond within the timelines the NDPA sets. If you are not satisfied with our response, you have the right to complain to the Nigeria Data Protection Commission (NDPC)." The notice prints a DPO name and an NDPC registration number only if configured, and neither is configured. Requests go to a contact form that opens a support ticket; there is no dedicated mailbox.
Options. (a) Keep the contact form and add a named DPO role with a dedicated address. (b) Appoint an outsourced DPO. (c) Keep as is if counsel confirms no DPO is required yet.
From counsel. Whether a DPO and an NDPC registration are required now; the exact wording and timelines to print.

### 2.2 Retention schedule

Question. Are these periods right, and which are legal minimums versus our own choices?
Why it matters. The NDPA 2023 storage limitation principle, and record keeping duties under the Money Laundering (Prevention and Prohibition) Act 2022 and tax and company law, for counsel to confirm.
Today. Privacy section 7 (/privacy#retention) and the internal draft schedule (docs/RETENTION_SCHEDULE.md, marked draft, not approved). What the code does:
- Account deletion: nothing is destroyed for 30 days (a restore window), then a daily job runs the purge. The email address is not kept, only a one-way keyed hash. The user's chosen deletion reason is stored as a short code in the audit log.
- Approved agent identification: kept five years after the account closes (anti money laundering reading), then destroyed by a daily job (`lib/account-deletion/kyc-retention.ts`: files emptied first, rows deleted after, audit row written).
- Rejected applicants: draft schedule proposes 30 days after the appeal window; not yet confirmed.
- Money records (bank and payout accounts, transactions): kept for at least five years after a closed request; a staff retention desk previews what is due and destroys on a typed confirmation.
- Sign-up step counts 90 days; email delivery records 90 days; messages 3 years after last message (draft); assistant conversations 12 months (draft); notifications 12 months (draft); application logs 90 days (draft).
- No period is printed in the privacy notice for hosting and database logs, crash reports or the audit log.
Options. Print a retention table in the notice; or keep the notice general and give the table on request.
From counsel. Confirmed periods per category, the legal basis for each floor, and whether the audit log and crash reports need a stated period.

### 2.3 Cookies and local storage notice

Question. Is the current notice enough, and is a consent banner needed?
Why it matters. NDPA 2023 consent and transparency rules; for counsel to confirm whether strictly necessary storage needs consent.
Today. Privacy section 9 (/privacy#cookies): "We use only cookies and device storage that the product needs to work, and one first-party cookie for the sign-up step counts... There is no analytics from a third party, and no advertising or tracking cookie in Vallo." It lists the sign-in session, display choices, AI agreement, a visit number cookie deleted when the browser closes, and device-only items (saved places, support chat, notification state, data-saver choice). No banner is shown.
Options. Keep notice only; add a short first-visit notice; add a settings page listing each item.
From counsel. Whether the list is complete in form and whether a banner is needed.

### 2.4 Under-18s

Question. What must we do when an account turns out to belong to a minor?
Why it matters. NDPA 2023 provisions on children's data and consent; contract capacity of minors. For counsel to confirm.
Today. Privacy section 10 (/privacy#children): "Vallo is for adults. You must be at least 18 years old to create an account, book a stay or list a property. We do not knowingly collect personal data from children, and we delete any such data we discover." Terms say the same age. The sign-up does not check age beyond the statement. Roommates targets students, who may be under 18 at some schools.
Options. Add a date of birth or an 18+ confirmation at sign-up; state the process when a minor is found (suspend, then delete); keep as is.
From counsel. The minimum safe process and wording, and whether Roommates needs anything extra.

### 2.5 The fee rate statement in the Terms

Question. Is it acceptable that the Terms do not state a fee percentage?
Why it matters. Fairness and transparency of terms; consumer protection rules, for counsel to confirm.
Today. Terms section 6 (/terms#listing): "Vallo charges a fee only when a deal is completed. When a payment is made through the platform, the platform fee comes out of your share as the lister, and it is shown to you in naira before you agree." A restaurant pays a fixed fee per seated table.
Options. Keep; state the current rate in the Terms with a notice period for changes; link to a live fee page.
From counsel. Whether showing the amount before agreement is enough, and wording for changes.

### 2.6 Support decision times and bank times: commitments or estimates

Question. Are these promises we must meet, or estimates, and how should they be worded?
Why it matters. A stated time can be read as a binding commitment; consumer protection law, for counsel to confirm.
Today. Cancellation schedule: "Cancel more than 72 hours before check-in and the full amount you paid goes back to the card or account you paid with. Support decides within five Nigerian business days of your ask." Refund route: "A refund goes back to the card or bank account you paid with, through our payment processor. Banks usually show it within 5 to 10 working days." The five day decision time is in the refund policy (/cancellations) but not in Terms section 5.
Options. Call both estimates ("usually"); keep the decision time as a commitment and the bank time as an estimate; move both into the Terms.
From counsel. Which are commitments, and the matching sentence in both places.

### 2.7 Wording if the protected payment rail is ever switched on

Question. What must the Terms, privacy notice and any licence or partner statement say before a payment is held until the renter confirms?
Why it matters. Holding customer money may require a licence or a licensed partner (CBN rules, for counsel to confirm). A wrong sentence could imply Vallo holds money.
Today. Terms section 4 (/terms): "Payment held by a licensed bank until you confirm is not open yet. When it opens we will say so, and these Terms will be updated with a new version and date." The previous provider has been removed and the privacy notice updated; the protected rail provider is not live. A switch in code keeps the rail off and fails closed.
Options. Draft the sentences now and hold them; wait until a provider and licence are chosen.
From counsel. The licence position, who holds the funds, the dispute process wording, and the new notice sections.

### 2.8 The deletion reason code

Question. Is recording a reason code at deletion proportionate, and is the notice enough?
Why it matters. Data minimisation and transparency under the NDPA 2023, for counsel to confirm.
Today. Privacy section 7: we ask why from a short list, the member can skip, nothing typed is kept, and only the code goes in the audit log. Codes: not using it, found a place, did not find one, hard to use, notifications, privacy, safety, second account, other, prefer not to say. The code is kept as long as the audit log; there is no stated period.
Options. Keep; keep with a stated period; remove the question.
From counsel. Whether the code is personal data in context, and the period.

### 2.9 Roommates

Questions. Terms and notice coverage for a roommate and student housing section: what duty of care do we have, what must we say about meeting strangers, and who is responsible for a shared listing?
Why it matters. Personal safety and harassment risk, data about students and young adults (possibly minors, see 2.4), and content liability. For counsel to confirm.
Today. A member makes a roommate profile (school, area, budget, lifestyle answers; a gender field and a workplace are hidden unless the member chooses to show them) and may post a room. Members can report people and posts; reports open a staff case with a timeline and possible restriction (warning, no messaging, no posting, no roommates, suspension) and an appeal. A profile or post can be held for review. A room post or a person's profile can be shared into a Circle community as a card showing a first name or title, school or area and a one line summary, linked to the real page; the card never carries contact details or an exact address. Listing shares into the social feed are limited to 2 per user (founder rule, to be confirmed against the feed code before relying on it). The Terms and privacy notice do not yet have a Roommates paragraph.
Options. Add a Roommates paragraph to both documents; add a short in-product safety note; add an age line for Roommates.
From counsel. Required disclaimers, the duty when a report names a minor, how long to keep a report record, and whether sharing a card into a community needs the profile owner's separate consent.

## 3. What the founder needs back

One reply per item with: the answer, the exact sentence to print, whether it needs a new version date on the page, and whether any registration or filing is needed. Items 2.1, 2.2, 2.4 and 2.9 first.
