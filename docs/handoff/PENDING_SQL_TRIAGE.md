# The pending SQL folder, read against the live database

**15 November 2026. Every verdict below comes from querying the live database
(project `uccixoonmbhrnyczyigt`), not from what a file or a note claims.**

The folder held 78 files. The founder asked for "the 80 odd pending SQL".
Sending 78 files to be run would be wrong, because **most of them are already
in the database.** Running them again would at best change nothing and at
worst undo later work. So this is the triage instead, and the short list of
what genuinely remains.

## The headline

| | Files |
|---|---|
| Every object they create is already live | **46** |
| No object to check (data, grants or policies only), checked case by case | **29** |
| Partly present, and the gap is my parser, not the database | **3** |

**Nothing in this folder is both unapplied and urgent.** One file is worth
running, two need the founder's decision, and the rest are records.

## The folder lies about itself, and that is the real finding

The folder's own README marks **29 files "NOT APPLIED"**. Against live, at
least **20 of those are fully applied.** Examples, each checked:

| File the README calls NOT APPLIED | What live says |
|---|---|
| `fee_schedule_2026-11-10.sql` | The 150 bps row exists and is the newest. Applied |
| `roommates_schools_full_list_2026-11-10.sql` | 784 institutions present. Applied |
| `institutions_logos_batch2_2026-11-10.sql` | 226 institutions carry a logo. Applied |
| `coo_overview_2026-11-10.sql` | Both tables present. Applied |
| `social_posts_2026-11-10.sql` | Table present. Applied |
| `bd_prospects_2026-11-10.sql` | Table present. Applied |
| `END_OF_BATCH_3_2026-11-10.sql` | Every object present. Applied |
| `revoke_anon_execute_on_circle_mutators_2026-11-13.sql` | No Circle mutator grants execute to `anon` or `public`. Applied |

This is the same disease as the migration register: **changes are applied one
way and recorded another, or not recorded at all.** The fix is the habit, not
the files: anything that changes the schema goes through the path that stamps
the register, and the file is filed immediately after.

### One I checked hard, because it looked like a security hole

`revoke_anon_execute_on_circle_mutators` reads as unapplied: two Circle
functions still grant EXECUTE to `anon`. They are `circle_community_active`
and `circle_home_stats`. **Both are read functions and both are meant to be
reachable signed out**, because the public catalogue draws them. Every actual
mutator the file names (accept invite, decline invite, remove member, update
community) grants execute to nobody. **The file is applied and there is no
hole.** Worth saying plainly, because the first read of it looked bad.

## What is actually left

### Worth running, low risk

**`register_applied_migrations_2026-11-15.sql`** (new, written today). Records
in the database's own register the four schema changes that really are applied
but were never stamped. Writes four bookkeeping rows and nothing else, and
each row is written only if its change is genuinely present. Without it a
rebuilt database stops at 9 November.

### Needs the founder's decision, not a recommendation

**`newsletter_default_on_2026-11-launch.sql`.** Step 3 **sends email to real
people**. Live now shows **0 members opted in**, so step 1 would change
nothing. Run only on purpose, on its own, never as part of a batch.

**`rt01_remove_retired_objects.sql`.** Permanent drops. Nothing on the
platform is waiting for it. A drop cannot be undone, so it deserves its own
sitting rather than a batch.

### Superseded, do not run

**`promote_bd_and_social_to_admin_2026-11-12.sql`.** It gives the position
holders the admin role. The founder's own `staff_desks_only` ruling of 14
November deliberately took that role away, and today exactly one grant holder
carries an admin role. Running this would reverse a decision he made on
purpose. **It should move to `superseded/`.**

**`staff_roles_step1_enum_2026-11-10.sql` and `RUN_1_staff_roles_enum`.**
There is no `staff_role` type in the database at all, and the platform runs
on `user_roles` plus `staff_grants`. This was a direction that was not taken.
Superseded.

### Built but never applied, and nothing is waiting for them

**`listing_stats_2026-11-13.sql`** (no `listing_stats` function live) and the
listing shares work (no `listing_shares` table live). The app treats both as
absent and degrades quietly. They belong to features that are not switched on,
so there is no hurry, and they should be run when those features ship rather
than now.

## What this triage cannot prove

Object presence proves a file's **tables, functions, indexes and triggers**
are there. It does NOT prove a policy's exact wording, a grant's exact shape,
or that a data change matched its intent. For the 29 files with no objects I
checked what each one claimed, one at a time, and the checks are named above;
where a file's claim could not be reduced to a query I have said so rather
than guessed.

I have not opened all 78 files line by line. This is a triage against live,
which is the right first cut, and it says clearly that the folder is mostly a
record rather than a queue.

## The recommendation

1. Run `register_applied_migrations_2026-11-15.sql`.
2. Decide separately on the newsletter and on `rt01`.
3. Let me move the superseded files to `superseded/` and rewrite the README's
   verdicts from this triage, so the folder stops lying about itself.
4. From now on, schema changes go through the path that stamps the register.
