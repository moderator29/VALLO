# BRIEF FOR NIGERIAN COUNSEL

Prepared 10 November 2026 for the founder to forward. Updated the same day with the founder's decisions (items 2.1 to 2.5, 2.7 and 2.9 carry a Status line). This is a list of questions, not legal text and not advice. Every reference to a statute or a regulator is there so counsel can confirm it applies, not because we assert it. Nothing here changes a live page.

Company: Vallo Spaces Ltd, Abuja. Live pages named below: https://vallo.ng/terms, /privacy, /cancellations (check the host before sending).

## 1. Context in plain words

Vallo is a marketplace in Nigeria for homes, land, hotels, shortlets and restaurant tables. Agents, landlords and hosts list; renters and guests search, message, book and, for stays, pay.

Money. Vallo does not keep a wallet or a balance for anyone. A guest pays by card through Paystack, and the lister's share goes to their bank account in the same transaction. The fee is taken from the lister's share and shown to the lister in naira before they agree: about 3.5 percent in total on every payment (Vallo 2 percent plus the provider's about 1.5 percent; see 2.5). Renters and guests are charged nothing extra. The member Wallet screens are hidden because there is no wallet provider (switch: `lib/money/wallet-open.ts`). Refunds go back to the card or bank account used, through the payment processor. The previous payment provider has been removed and the privacy notice updated; the protected rail provider is not live, and no payment is held by anyone other than the card processor today.

Data. Members give a name, email or phone, and a profile. Listers who want to be approved as agents upload a government ID document, a NIN, a selfie and bank details, which are reviewed by Vallo staff. Members message each other, save places, get push notifications, and may use an AI assistant powered by Anthropic (United States). Roommates is a new section for finding a roommate or a room, mostly for students and young professionals. The database and files are stored in Ireland (EU). A fuller list is in DATA_INVENTORY.md.

People. Vallo staff can see reports and run desks (support, verification, money records). Every privileged action is written to an audit log.

## 2. Open items

### 2.1 Complaints route to the NDPC and a Data Protection Officer contact

**Status (10 November 2026): handled by Vallo, text to be supplied.** The founder's team will supply the NDPC complaint route and the Data Protection Officer contact. Nothing is invented in the meantime: the Privacy page keeps its general sentence and prints a DPO name and an NDPC registration number only if they are configured (`lib/legal/company.ts`), and neither is. No placeholder is on the live page; when the text arrives it goes into Privacy section 8 and `company.ts`.

Question (kept for the record). Does Vallo need a named Data Protection Officer and a published contact for data requests, and what should the complaints route say?
Why it matters. The NDPA 2023 gives data subjects rights and a route to the Nigeria Data Protection Commission (NDPC). Whether our size and processing require a DPO, and what must be published, is for counsel to confirm.
Today. Privacy section 8 (/privacy#your-rights): "To exercise any of the others, write to us through [the contact form]. We respond within the timelines the NDPA sets. If you are not satisfied with our response, you have the right to complain to the Nigeria Data Protection Commission (NDPC)." Requests go to a contact form that opens a support ticket; there is no dedicated mailbox.
From counsel (only if asked). Whether a DPO and an NDPC registration are required now.

### 2.2 Retention schedule

**Status (10 November 2026): the founder's current schedule, in industry-standard periods, pending counsel. Printed on the Privacy page (section 7, "How long we keep each kind of data") from one source, `apps/web/src/lib/legal/retention.ts`.**

| Data | Period |
|---|---|
| Account profile | While the account is active; after a deletion request, the existing 30-day restore window, then permanent deletion |
| Financial and payment records | 6 years after the transaction (tax and company law) |
| Identity-verification records | 5 years after the relationship ends (anti money laundering practice) |
| Agreements and receipts | 6 years |
| Messages | 24 months after the conversation's last activity |
| Support tickets | 3 years |
| Security and access logs | Up to 12 months |
| Analytics events (sign-up step counts) | Up to 14 months |
| Marketing consent records | Until withdrawn, plus 3 years as proof |
| Backups | Roll off within 35 days |

Things counsel should know the schedule does not yet match, because the code does something else:
- **Messages on account deletion.** The founder's line was "removed on account deletion except where needed for a dispute". The code keeps a deleted member's messages in the other person's conversation, shown as from a deleted account (Privacy section 7 says so). The page states what the code does. Either the code changes (the deletion work) or the sentence does.
- **Money records.** The page now says six years for payment and financial records; the retention desk and `kyc-retention.ts` still use five. Five is the identity-document period and the anti money laundering floor; six was the founder's figure.
- **Shorter in practice.** Sign-up step counts are cleared after 90 days, email delivery records after 90 days, application logs after 90 days; the table states the longest period, and says so.
- **Not in the table.** Assistant conversations, notifications, crash reports and the audit log still have no printed period.

Question. Are these periods right, and which are legal minimums versus our own choices?
Why it matters. The NDPA 2023 storage limitation principle, and record keeping duties under the Money Laundering (Prevention and Prohibition) Act 2022 and tax and company law, for counsel to confirm.
From counsel. Confirmed periods per category, the legal basis for each floor, and whether the audit log and crash reports need a stated period.

### 2.3 Cookies and local storage notice

**Status (10 November 2026): built.** A first-visit bar (Accept all, Only necessary, Choose, equal weight), a choice sheet reachable from Settings (Privacy and security) and the footer ("Cookie settings"), a first-party consent cookie `vallo_consent` with a version (12 months), and a public page `/cookies` (also `/legal/cookies` in the app) listing every item with name, type, purpose and lifetime, generated from one source (`apps/web/src/lib/consent/inventory.ts`) with a test that fails when the code stores something the list does not name. Linked from the Privacy page (section 9) and the footer.

Classification, as built (strict):
- **Necessary (always on).** Sign-in session (Supabase), language, theme, side, motion, data-saver, saved places, passcode and unlock marks, the AI agreement record, drafts, the offline queue, "you have seen this tip" marks, short sign-in-flow cookies, the consent record itself.
- **Preferences (off until agreed).** Recent searches, recently viewed listings, the search view last used, last-visit stamps. Not written before consent; withdrawing clears them.
- **Usage counts (off until agreed).** `nf_visit` (random visit number for the first-party sign-up step counts) and `vallo_via` (which shared listing link was opened first, so the lister is credited). The funnel beacon sends nothing and sets nothing before consent.
- Nothing is advertising. Nothing is third-party analytics.

Questions for counsel. (a) Are the "necessary" items properly so, in particular: remembered choices (language, theme), the "tip seen" marks, the invite code held until sign-up (`vallo_invite`, owned by the referrals work and not gated), and the AI-agreement record? (b) Is `vallo_via` (referral attribution) analytics or necessary? It is gated as analytics. (c) Is a 12 month life for the choice right? (d) Does the NDPA require a banner for necessary-only storage? The bar is shown regardless.
Today, before this change: Privacy section 9 listed items without a table and no banner was shown.

### 2.4 Under-18s

**Status (10 November 2026): founder-decided. No under-18 users.** Vallo is for people aged 18 and over. Terms section 3 and Privacy section 10 now say: you must be at least 18 to create an account or use the platform; if an account is found to belong to someone under 18, it is closed and their personal data is deleted, except for anything the law requires us to keep. The age gate at sign-up is built by another workstream and is not described here. Roommates: the same rule.

Question for counsel (narrowed). Confirm the closure-and-deletion wording; confirm what the law requires us to keep from a minor's account (payment and safety records); and whether a report that names a minor in Roommates needs a longer-lived record.
Today. Terms section 3: "Vallo is for people aged 18 and over. You must be at least 18 years old to create an account or use the platform. If we find that an account belongs to someone under 18, we close it and delete their personal data, except for anything the law requires us to keep." Privacy section 10 says the same, with the support route to report a younger user.

### 2.5 The fee rate statement in the Terms

**Status (10 November 2026): the final fee wording is FOUNDER-DECIDED, flagged for counsel to read.** The Terms now state the rate (section 6, "What the fee is"; section 4A for rent). One source: `apps/web/src/lib/money/fee-schedule.ts`; every statement (Terms, glance, the docs "What Vallo costs" chapter, help, the assistant and copilot knowledge, the lister's fee screen labels, the protected-payment trust page) reads it through `lib/money/copy.ts`.

The wording as printed:
- "A rent payment costs about 3.5% in total: Vallo's service fee of 2% and the payment partner's fee of about 1.5%."
- "Every other payment made on Vallo costs about 3.5% in total: Vallo's service fee of 2% and the payment processor's fee of about 1.5%."
- "The fee comes out of the lister's share and is shown to the lister in naira before they agree. Renters and guests pay exactly the listed price."
- "The payment partner's and the payment processor's fees are their charges, set by them. Vallo does not keep them and does not add to them."
- "The percentages are round figures. The exact amount for your payment is always shown in naira before you agree to it."
- The existing 30-day notice before a rate change is kept (section 6).

Assumptions to confirm (the founder gave the rent split and a 3.5 percent total for the rest): that the other-payment total is Vallo 2% plus the processor about 1.5%; that the lister bears the whole fee, as every existing sentence says; that "about" is acceptable for a fee the provider sets. The partner's own tariff is 1.5% plus a fixed amount, capped, so its exact naira figure can differ slightly from 1.5% of the rent; the screens show the exact naira figure. The live fee table needs one added row to read 1.5 (`supabase/migrations/pending/fee_schedule_2026-11-10.sql`, NOT APPLIED).
A restaurant still pays a fixed fee per seated table; a hotel room the commission set on 13 October 2026. Neither is changed.

Question. Is it acceptable to state a rounded percentage with "about", and is the notice period for changes right?
From counsel. Whether showing the amount before agreement is enough, and wording for changes.

### 2.6 Support decision times and bank times: commitments or estimates

Question. Are these promises we must meet, or estimates, and how should they be worded?
Why it matters. A stated time can be read as a binding commitment; consumer protection law, for counsel to confirm.
Today. Cancellation schedule: "Cancel more than 72 hours before check-in and the full amount you paid goes back to the card or account you paid with. Support decides within five Nigerian business days of your ask." Refund route: "A refund goes back to the card or bank account you paid with, through our payment processor. Banks usually show it within 5 to 10 working days." The five day decision time is in the refund policy (/cancellations) but not in Terms section 5.
Options. Call both estimates ("usually"); keep the decision time as a commitment and the bank time as an estimate; move both into the Terms.
From counsel. Which are commitments, and the matching sentence in both places.

### 2.7 Wording if the protected payment rail is ever switched on

**Status (10 November 2026): proposed wording, written on the founder's instruction, for counsel to approve. The rail stays OFF** (`payments_escrowpay_on`, `RENT_PAYMENT_OPEN = false`, the provider's API undocumented). The wording is in Terms section 4A and the in-app trust page `/docs/how-protection-works`, read from `lib/money/copy.ts` (`TERMS_HELD_*`, `PROTECTED_*`). Every sentence either says "not open yet / when it opens" or describes the arrangement without saying any money is held today. Vallo never holds the money.

Proposed wording (Terms section 4A, "Rent paid as a protected payment (not open yet)"):
1. "Payment held by a licensed bank is not open on Vallo yet. No rent has been paid this way, and until it opens rent cannot be paid on Vallo. When it opens we will say so, and these Terms will be updated with a new version and date."
2. What it is. "A protected payment is a bank transfer that a licensed bank holds under your agreement until the handover you agreed has happened. You make it in naira, from your own Nigerian bank account, to a designated account at that bank."
3. Who holds the money. "The money is held by a licensed bank, arranged through Vallo's licensed payment partner. It is not held by Vallo. Vallo cannot spend, lend or keep it, and Vallo can only ask the bank to release or return it under your agreement."
4. When it is released. "The money is released to the lister when you confirm the handover your agreement names (the keys for a rental, check-in for a stay), when another release condition in your agreement is met, or through the dispute process below. A release is final only when the bank confirms it."
5. Disputes. "If something is wrong, tell us on the payment before you confirm the handover. Release pauses while the problem is reviewed, where the partner's arrangement allows. The lister sees what was reported and can answer. A person at Vallo reads both sides and records the decision and the reason on the payment. The decision follows your agreement and the evidence, it is not a court judgment, and it does not stop either of you going to court or to arbitration under these Terms."
6. Refunds. "A refund goes back to the bank account the money came from, once the bank confirms it. We do not promise how long a review or a refund takes; each step shows on the payment when it is confirmed."
7. Fees. The rent fee statement in 2.5.
8. Limits. "It does not judge the property, it is not insurance, and it does not cover money sent any other way: cash, a transfer to a personal account, or a payment arranged outside Vallo."

In the app, the provider's own funds wording (naming the custodian bank and the central bank) is shown only through `protected-wording.ts`, unaltered, and only on a state the provider confirmed. The Terms deliberately do not name the provider or the custodian: the provider's agreement is not signed and the wording rule forbids naming either outside that module.

Question. What must the Terms, privacy notice and any licence or partner statement say before a payment is held until the renter confirms?
Why it matters. Holding customer money may require a licence or a licensed partner (CBN rules, for counsel to confirm). A wrong sentence could imply Vallo holds money.
From counsel. The licence position, who holds the funds, the dispute process wording, the new notice sections, and whether the partner and the custodian must be named in the Terms before go-live.

### 2.8 The deletion reason code

Question. Is recording a reason code at deletion proportionate, and is the notice enough?
Why it matters. Data minimisation and transparency under the NDPA 2023, for counsel to confirm.
Today. Privacy section 7: we ask why from a short list, the member can skip, nothing typed is kept, and only the code goes in the audit log. Codes: not using it, found a place, did not find one, hard to use, notifications, privacy, safety, second account, other, prefer not to say. The code is kept as long as the audit log; there is no stated period.
Options. Keep; keep with a stated period; remove the question.
From counsel. Whether the code is personal data in context, and the period.

### 2.9 Roommates

**Status (10 November 2026): CLOSED, founder's decision: no separate legal review needed.** Reasoning recorded: the existing disclaimers are the protection and are kept. The house agreement a member can draw up is not a legal contract; Vallo is not a party to any arrangement between members; and no verified claim is made beyond the mechanisms that back it (the claims rule, `lib/trust/claims.ts`). Reports open a staff case with a timeline, restriction and an appeal; a profile or post can be held for review; a card shared into a Circle never carries contact details or an exact address. Under-18s are not allowed (2.4). If counsel reads the Terms for other reasons and has a view, it is welcome, but nothing is waiting on it.

Original questions (kept for the record). Terms and notice coverage for a roommate and student housing section: what duty of care do we have, what must we say about meeting strangers, and who is responsible for a shared listing; the duty when a report names a minor; how long to keep a report record; whether sharing a card into a community needs the profile owner's separate consent.

## 3. What the founder needs back

One reply per item with: the answer, the exact sentence to print, whether it needs a new version date on the page, and whether any registration or filing is needed. Items 2.1, 2.2, 2.4 and 2.9 first.
