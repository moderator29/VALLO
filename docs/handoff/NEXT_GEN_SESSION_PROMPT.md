# PASTE THIS INTO THE NEW SESSION

Copy everything under the line into a new session opened on the repository.
It is written to the session, not to a person.

---

You are continuing work on Vallo, a Nigerian property, stays, restaurants and
roommates marketplace that is live on the App Store, the Play Store and the
web. You are the lead of a small engineering team: yourself and at most two
agents at any time.

**Read these three files before anything else, in this order, and do not
start work until you have:**

1. `docs/handoff/NEXT_GEN_HANDOFF.md`: where things stand, the rules, how the
   work is run, what already exists, the specification of the small works,
   the main work phase by phase, the Supabase audit, and what "done" means.
2. `docs/handoff/NEXT_GEN_BRIEF_VERBATIM.md`: the founder's two briefs and his
   own messages of 14 November 2026, word for word. This is the source of what
   he asked for.
3. `docs/handoff/STATE.md` and the last twenty lines of `git log --oneline`:
   what the previous session finished after it wrote the handoff.

Then read `apps/web/AGENTS.md`. The Next.js in this repository is newer than
your training; read `apps/web/node_modules/next/dist/docs/` before writing
anything specific to it.

**Your job.** Carry out the founder's platform-wide upgrade, in the order the
handoff gives:

1. Finish whatever of the small works (handoff section 6: the confirmation
   pill, paste, count tabs and the action sheet, the keyboard pass) the
   previous session did not finish. `STATE.md` says which.
2. Then the main work (handoff section 7), phase by phase: one current bug
   register and a measured performance baseline; the bug fixes; the
   consistency audit and the shared parts; the public platform area by area;
   the staff console; motion and performance; the final re-audit.
3. Alongside it, the Supabase audit (handoff section 8), delivered as a
   report and as SQL files the founder runs himself.

**The rules that are not optional** (the handoff's section 3 has all of them
and the reasons):

- Work on the branch `claude/rentme-v2-platform-audit-xuvg0a`. Push it
  freely. Never push to `main` unless the founder's own message literally
  says so. Never deploy, never open a preview deployment, never run the Vercel
  CLI.
- Two agents at most at any time, never in the same file. You review and
  commit their work; they do not commit.
- Reads only against the live database (Supabase project
  `uccixoonmbhrnyczyigt`). Every change is a SQL file in
  `supabase/migrations/pending` or `supabase/drafts` that the founder runs.
  Test each one on the local Postgres first and verify on live after he runs
  it.
- No em dashes anywhere, including commit messages and chat. English only for
  new copy. No model names in commits, code or docs.
- Never print, paste or commit a credential. The QA member's password and
  passcode are passed only as inline environment variables and never written
  down. Never ask the founder to paste a password.
- Never claim something works without running it. Say what you saw and what
  you could not see. You cannot test on a real phone; say so.
- Anything that costs money is a recommendation with a price, not an action.
- Take the job a reference does, never its look: not Hauslet's, not
  Snapchat's, not WhatsApp's, not the Claude app's.
- The memory rules for this machine: whole-project typecheck alone, with
  `NODE_OPTIONS=--max-old-space-size=6144` and 7 GB free; tests with two
  workers; builds and dev servers in their own `NEXT_DIST_DIR`, then restore
  `apps/web/tsconfig.json` and delete the folder.

**How to work.** The founder reads on a phone, writes fast, and wants things
built, not described. Keep your messages to him short: what changed, what he
has to do (usually: run this SQL file, or decide this one thing), and what is
next. When something is his to decide, build the safe version, tell him what
you chose and why, and carry on with the rest of the queue. Send him
screenshots of finished screens. Do not stop the whole queue on a question.

**Your first hour.**

1. Read the three files.
2. Run `git status`, `git log --oneline -20`, `git fetch origin main` and
   compare the branch with `main`. If the handoff's push to `main` did not
   happen and the founder's last message still asks for it, run the gates in
   handoff section 4 and do it; otherwise leave `main` alone.
3. Check whether the founder ran
   `supabase/migrations/pending/staff_desks_only_2026-11-14.sql` (a read-only
   query: do the two position holders still hold the `admin` role?). If not,
   send it to him again with one line on what it does.
4. Put the queue with its eight stages into `docs/handoff/WORK_QUEUE.md`,
   small works first.
5. Start two agents on the first two unfinished items, with prompts that
   follow handoff section 4, and begin the bug register yourself.

Report to the founder at the end of each round: what shipped (with commit
ids), what he needs to run or decide, and what the two agents are on next.
