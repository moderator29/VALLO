# Compliance runbook: what staff do, and in what order

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Vallo's AML/CFT duties as a DNFBP (Dealers in Real Estate) under the Money
Laundering (Prevention and Prohibition) Act 2022, from the SCUML-EFCC checklist.
Each section names its checklist item. Everything here is staff only. **Nothing
here is legal advice; the solicitor confirms it.**

The desk is `/admin/compliance`, one tab per obligation.

## Never tip off

A person whose name matched a list, who is under review, or about whom a report
is filed sees nothing different, and is told nothing that names sanctions, a
list, a review or a report. If a hold is placed on the account, they see only
the neutral line "No payment can be made from this account for now, and payout
details cannot be changed" (hold reason `plain`, which names nothing, and no
date; `hold.bodyPlain` in `packages/i18n/src/locales/platform.en.ts`). Staff
say nothing more on the phone, in support or by email.

## SCUML items 8 and 9: sanctions screening

**What runs by itself.**

- Every person is screened against the UN Consolidated List and the Nigeria
  Sanctions List when they:
  - submit or change an agent application (lister verification);
  - have an identity check recorded;
  - add a bank account or payout account, or when the bank returns its name;
  - make any transaction: a card payment and its settlement line, a rent
    payment and a business transfer. (The wallet entry and escrow triggers
    went with those tables into `retired_custody` on 25 September 2026, and
    nothing writes there now.)
- Triggers queue the screening, and the `sanctions-screen` job runs it every 15
  minutes. Nothing about a payment waits on it.
- Every screening is recorded, clean ones included, in `sanctions_screenings`,
  with the list versions it used.
- A new list version re-screens everybody (item 9). Versions come from the
  daily `sanctions-lists` job when `SANCTIONS_UN_URL` / `SANCTIONS_NG_URL` are
  set, or from a staff upload on the Sanctions tab.

**Keeping the lists current (item 9).**

1. The founder registers with the Nigeria Sanctions Committee Alert System.
2. When an alert says the Nigeria list changed, load the new file on the
   Sanctions tab as CSV with these columns: `reference, name, aliases,
   date_of_birth, nationality, listed_on, type`. Separate multiple values with `;`.
   End the file with a row `END,<number of entries>`: a count that does not
   match is refused, and a file fetched from a URL without it waits for staff.
3. Set `SANCTIONS_UN_URL` to the UN's published XML address, and the UN list
   refreshes itself daily. Otherwise, upload the XML.
4. A file identical to the one in force changes nothing. A file that does not
   read as its list (including one cut off before its closing tag) is refused,
   and nothing changes.
5. **An uploaded file loads inactive.** A different staff member must activate
   it on the desk, and only activation re-screens anyone (item 19). A URL
   fetch activates itself unless it has fewer than 90% of the entries in force
   (checked again at activation) or cannot prove it is whole; a short one needs
   a proposer and a different person to activate it. An older file can never
   replace a newer one already in force. The file limit is 4 MB. The desk
   lists only versions someone can still activate: an older version (a newer
   one is in force) or one that cannot prove it is whole is not waiting, and
   activating it is refused. Load the whole file again instead. An upload
   without its END row is answered at once: "This file does not prove it is
   whole".
6. **De-listing.** When a new version no longer carries the reference of a
   confirmed match, the desk flags it. Consider a release (below).

**When a match appears (the escalation path).**

1. **Nothing happens to the person automatically.** Neither an exact nor a
   close match places a hold, because a name is not an identity.
   How a close match is found: each word of the list name must be paired
   with a different word of ours (one to one) that is the same after
   transliteration folding (Mohammed/Muhammad, Abdurrahman/Abdulrahman,
   Aliyu/Aliu, Ould/Wuld), differs by at most 15% of its letters, or has the
   same consonants from the same first letter with the letters mostly in place
   (Yousef/Yusuf, Khaled/Khalid). Names that only share consonants stay apart
   (Karim/Akram, Muhammad/Mahmud); so do Hassan and Hussein, which are two
   names. "Abdul Rahman" is read as Abdulrahman, and Abdullah, Abdullahi and
   Abdallah are one name, but a shared "Abdul" alone never counts. Short list
   names (three words or fewer) need every word; longer ones need two thirds
   by rarity, including one uncommon word unless the whole of a three-word or
   longer name of ours is in the listing.
   **Common names.** A close match resting only on names many Nigerians carry
   is still a match: it appears under "Common name, check identifiers", after
   the others. Decide it the same way, on the date of birth, nationality and
   documents. An exact match on a list name made only of common names
   ("Muhammad Yusuf" exactly) is in that group too: until two people confirm
   it, it is treated like a close match.
   **Padding and long names.** Stray one- and two-letter tokens are ignored
   (not Al, El, Ul or Md) when scoring a close match, but never to make a
   match exact ("Iyad Ghali" is close to "Iyad Ag Ghali", not exact); a
   final y after a consonant reads as i (Ghaly/Ghali); a list name found word
   for word is scored on those words alone; and a long name is never passed
   over for its length.
   **Risk class (SCUML item 15).** A match changes a person's risk class only
   once it is confirmed by two people, or while it is an open exact match on
   a name that is not made only of common names. An open close match, and an
   open exact match on common names only, never does, so it never blocks a
   listing or a payout account. A decision on a match puts the person in the
   next risk run.
2. **Check it.** Compare the list entry's date of birth, nationality and
   aliases with what Vallo holds: the NIN name on an agent application, the
   bank-resolved account name, and the documents.
3. **Propose.** Choose "Not the same person" or "It is the same person" and
   write what you checked. The note is required.
4. **A second staff member approves, or rejects.** The person who proposed
   cannot approve or reject their own proposal (item 19); the database refuses
   it. A rejected proposal leaves the match open for a new one. Nobody decides
   a match about themselves: a staff member who is the matched person cannot
   propose, approve or reject on it.
5. **If it is the same person, the approval freezes the account.** It sets the
   sanctions desk's own claim (`private.hold_claims`, owner `sanctions`),
   thirty days, renewed by every screening run while the match stands. The
   audit's hold row (`account_money_holds`) follows every desk's claims under
   the reason code `plain`, which names nothing (the member can read it); a
   "this was not me" hold keeps its own words and is only lengthened. No money
   leaves and no payout account changes.
6. **Report it.**
   - Open the STR from the match ("Open a suspicious transaction report", SCUML
     item 6).
   - The Compliance Officer files with the NFIU through goAML and informs the
     Nigeria Sanctions Committee, both outside Vallo.
   - Record the references in the STR register.
7. **Releasing a hold** (de-listing, or the solicitor's advice) is two-person
   too: one proposes "Release the hold" with the reason, a second approves.
   The match becomes released and, if the person has no other confirmed match,
   the sanctions claim ends. An STR hold (item 6) or a "not me" hold is its
   own claim and stands.

**What the job raises on Operations.**

- `sanctions.hits_raised` (warning) when a run raised new matches. It carries
  counts only, never a name.
- `sanctions.lists_unreadable` (critical) when the lists could not be read.
  Nothing was screened, and nothing should be read as clear.
- `sanctions.list_refresh_failed` (warning) when a configured URL could not be
  loaded.
- `sanctions.list_waiting` (warning) when a version waits for a second person
  to activate it; `sanctions.list_incomplete` when a fetched file could not
  prove it is whole; `sanctions.list_waiting_unreadable` when the waiting count
  could not be read (treat it as needing a look, not as zero).

**Accepted limitation.** The triggers that queue a screening swallow every
error, but a statement cancelled from outside (a timeout or an operator
cancel, `query_canceled`) is deliberately not caught by PL/pgSQL, so such a
cancel still fails the write it rides on. The 200ms lock timeout keeps the
queue from causing one.

**Retention.** Screenings, matches and decisions are kept for at least five
years. See `docs/RETENTION_SCHEDULE.md` section 3.1a.
