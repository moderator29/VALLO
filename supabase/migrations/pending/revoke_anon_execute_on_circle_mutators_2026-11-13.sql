/*
 * FOUR MEMBERSHIP-CHANGING RPCs NEED NO ANONYMOUS DOOR.
 * (Agent BE-BUGS, 13 November 2026. Not applied. The founder runs this.)
 *
 * ---------------------------------------------------------------------------
 * THE MEASURED PROBLEM
 *
 * Supabase's security advisor (lint 0028,
 * anon_security_definer_function_executable) names 40 SECURITY DEFINER
 * functions the `anon` role may call over /rest/v1/rpc. Most of them are
 * honest public doors (area prices, the leaderboard, platform statistics, the
 * directory) or token doors (a calendar feed, a landlord line, a safety
 * share). Four of them CHANGE CIRCLE MEMBERSHIP:
 *
 *   public.accept_circle_invite(uuid)
 *   public.decline_circle_invite(uuid)
 *   public.circle_remove_member(uuid, uuid)
 *   public.circle_update_community(...)
 *
 * NOTHING IS OPEN TODAY, and that is said first so this file is not read as an
 * emergency. Each of the four was read out of pg_proc and each refuses an
 * unsigned caller, in one of two ways:
 *
 *   circle_remove_member      'if uid is null then return ''signed_out''; end if;'
 *   circle_update_community   the same explicit line
 *   accept_circle_invite      'where id = p_invite_id
 *                                and invitee_id = (select auth.uid())
 *                                and status = ''pending'''
 *                             With no session auth.uid() is null, so the
 *                             comparison is null, never true, the select finds
 *                             nothing and the function raises RM201 before it
 *                             reaches the membership insert.
 *   decline_circle_invite     the same shape, raising RM202.
 *
 * So the first two refuse by a guard and the second two refuse because a
 * comparison against null is not true. Both are correct. The second pair is
 * the weaker arrangement, because it is one `=` away from opening: an
 * `is not distinct from`, or a rewrite that treats a missing invitee as a
 * wildcard, would let an anonymous caller act and no test would say so.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES
 *
 * Revokes EXECUTE on those four from `anon`, and from `public` so the grant
 * cannot arrive again by inheritance. `authenticated` and `service_role` keep
 * theirs untouched, so every real caller is unaffected: the app calls all four
 * on a signed-in member's own client.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *
 *   It changes NO function body. The guards above stay exactly as they are;
 *   this removes a door that is already locked rather than replacing the lock.
 *   It touches none of the other 36 functions in that advisor finding. Several
 *   of them are deliberately anonymous and revoking them would break the
 *   signed-out site.
 *   It does not grant anything to anybody.
 *   It drops nothing and deletes nothing, so the connector will not freeze on
 *   it, and it creates no cron job.
 *   It does not address lint 0029 (454 functions callable by `authenticated`).
 *   That is this platform's deliberate RPC pattern and each of those functions
 *   does its own authority check.
 *
 * ---------------------------------------------------------------------------
 * SAFE TO RUN TWICE: YES. A revoke of a privilege that is not held is a no-op
 * in PostgreSQL, so a second run changes nothing and raises nothing.
 *
 * ---------------------------------------------------------------------------
 * READ BACK AFTER RUNNING.
 *
 *   select p.proname,
 *          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_may,
 *          has_function_privilege('authenticated', p.oid, 'EXECUTE') as member_may
 *     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 *    where n.nspname = 'public'
 *      and p.proname in ('accept_circle_invite', 'decline_circle_invite',
 *                        'circle_remove_member', 'circle_update_community')
 *    order by 1;
 *
 * Expected: four rows, anon_may false on every one, member_may true on every
 * one. If member_may ever reads false, Circle is broken for signed-in members
 * and the grant must go back on; nothing in this file removes it.
 *
 * Then, in the app, a signed-in member accepting a Circle invite must still
 * work. That is the one check this file cannot make from here.
 */

revoke execute on function public.accept_circle_invite(uuid) from anon;
revoke execute on function public.accept_circle_invite(uuid) from public;

revoke execute on function public.decline_circle_invite(uuid) from anon;
revoke execute on function public.decline_circle_invite(uuid) from public;

revoke execute on function public.circle_remove_member(uuid, uuid) from anon;
revoke execute on function public.circle_remove_member(uuid, uuid) from public;

revoke execute on function public.circle_update_community(uuid, text, text, text, text[]) from anon;
revoke execute on function public.circle_update_community(uuid, text, text, text, text[]) from public;
