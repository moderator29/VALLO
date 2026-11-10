-- STAFF ROLES, STEP 1 OF 2: THE FOUR NEW ACCESS SCOPES (founder, 10 November
-- 2026). Marketing Manager, Content Manager, Technical Administrator and
-- Customer Support Lead.
--
-- NOT APPLIED. Run this file ALONE, as its own statement, and let it FINISH
-- (commit) before anything in `staff_roles_step2_2026-11-10.sql` is run. A new
-- enum value cannot be used by anything in the same transaction that adds it,
-- so the two files must never be pasted together. Step 2 depends on this one.
--
-- Additive and safe to run twice (`if not exists`). No existing scope is
-- touched, renamed or narrowed.

alter type public.staff_scope add value if not exists 'marketing';
alter type public.staff_scope add value if not exists 'content';
alter type public.staff_scope add value if not exists 'technical';
alter type public.staff_scope add value if not exists 'support_lead';
