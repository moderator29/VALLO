-- PART 4: WRITE GRANTS MATCH THE POLICIES (probe db-06).
--
-- Some tables added on 7 and 8 November grant members a write that no
-- row level security policy allows. RLS already refused those writes (no
-- policy, no row), so nothing a member can do changes here; the grant is
-- simply taken away so the privileges say the same as the policies, which
-- is what probe db-06 holds the database to. The writes these tables do
-- take go through their own database functions.

revoke update on public.circle_vouches from authenticated;
revoke update on public.circle_shared_shortlists from authenticated;
revoke insert, update, delete on public.circle_communities from authenticated;
revoke insert on public.circle_memberships from authenticated;
revoke update on public.post_helpful from authenticated;
revoke insert, update, delete on public.circle_accepted_answers from authenticated;
revoke update on public.circle_plan_signups from authenticated;
revoke update on public.circle_question_follows from authenticated;
revoke delete on public.circle_plans from authenticated;
revoke delete on public.circle_invites from authenticated;
