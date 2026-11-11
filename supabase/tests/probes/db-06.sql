-- DB-06: privileges on public tables match what a policy can allow.
-- anon holds no write on any public table or sequence, and new tables made
-- by postgres start that way. authenticated holds exactly the checked-in
-- allowlist below (i = insert, u = update, d = delete); each pair has a
-- permissive policy behind it. A new write grant, or one left without a
-- policy, fails this probe until it is added here deliberately.
--
-- 11 November 2026: AND THE COLUMN GRANTS, which this probe could not see.
--
-- A grant in Postgres is per table OR per column, and until today everything
-- here was spelled per table and per command. That left two blind spots, and
-- both of them were hiding a live defect.
--
--   The command allowlist says notifications is `du`, and it is: UPDATE is
--   granted. On exactly one column. `20261108115654_notification_archive.sql`
--   added `archived_at`, widened the policy and did not widen the grant, so
--   archiving is refused 42501 for every member of this platform and the
--   allowlist above reads as satisfied. 273 notifications live, 0 ever
--   archived. The fix is pending in
--   `migrations/pending/notifications_archive_grant_2026-11-11.sql`; the
--   column is declared under `colpending` below so this probe is green
--   either side of the founder running it.
--
--   SELECT was not read at all. Fifteen of this project's tables publish only
--   some of their columns: an address, a coordinate, a hash, a provider
--   reference and a reviewer's note stay behind the service role while the
--   rest of the row is public. Nothing pinned that. A `grant select on
--   public.listings to anon` would have handed out every address on the
--   platform and no probe would have made a sound.
--
-- Both are read below from `pg_attribute.attacl`, the catalogue that
-- `information_schema.role_column_grants` reports, and both are
-- declared as the SHORT side: the columns a column-scoped write grant covers
-- (a handful), and the columns a role may NOT read (the redaction list).
-- Declaring the redaction list rather than the readable one is deliberate: a
-- column added to a column-scoped table carries no grant of its own, so the
-- new column arrives unreadable and undeclared, and this probe says so. That
-- is exactly how `listings.shared_living_ok` and `listings.max_occupants`
-- reached the live database unreadable (pending/roommates_3_integrations.sql
-- adds the columns and grants nothing), which is why /agent/listings/<id>/sharing
-- tells a lister their own listing is not theirs.
--
-- 29 September 2026: the list was brought up to the live database after CI
-- had run no job since 23 September. Added, each checked against its policy
-- (all `to authenticated`, all scoped to auth.uid() or an admin role):
-- conversation_archives idu, inspection_truth i, kyc_consents i,
-- listing_broadcast_marks idu, member_notes i (admins), refund_requests i,
-- support_ticket_attachments i, tenancy_pins i, tenancy_reviews i,
-- viewing_windows idu, admin_saved_views id (admins insert, owner deletes).
-- agent_verification_checks lost its delete; wallet_pots
-- and wallet_entries went with custody (Track A).
--
-- 6 October 2026: first_runs_seen i, from b4_first_run_store. Insert only, no
-- update and no delete by design, behind first_runs_seen_write_own
-- (`for insert to authenticated with check (user_id = (select auth.uid()))`),
-- read behind first_runs_seen_read_own. Declared here because the grant is
-- deliberate: this probe reads the live database, so from the moment the
-- migration was applied it failed on every branch and on main, not only on the
-- branch that added it.
--
-- 7 October 2026: restaurant_deposit_rules idu, from d75a_restaurant_deposits.
-- A restaurant owner sets their own table deposit rule, behind
-- restaurant_deposit_rules_owner_insert / _owner_update / _owner_delete (all
-- `to authenticated`, scoped by private.owns_business(business_id)).
--
-- 17 October 2026: passport_settings iu, from pass01_passport_settings
-- (20261013171854). A member's own passport switches, behind
-- passport_settings_insert_own and passport_settings_update_own (both
-- `to authenticated`, `user_id = (select auth.uid())` in using and with check).
-- No delete grant: switching the passport off is an update.
--
-- 9 November 2026: the Roommates release (migration roommates_all, applied
-- live the same day) and the moderation desk brought write grants this list
-- never declared, which is what the probe is for. Each one was checked against
-- pg_policies before being written down, and they split two ways.
--
-- Declared here, because a permissive policy for `authenticated` stands behind
-- every command: institutions idu, roommate_group_expenses idu,
-- roommate_group_posts id, roommate_group_shortlist id, roommate_group_votes
-- idu, roommate_listings idu, roommate_profiles idu, roommate_saved_searches
-- idu. Three more are declared for UPDATE only, because that is the only
-- command a policy allows and the only one the app uses directly (a group is
-- created through the definer roommate_create_group, then edited with a plain
-- update): roommate_groups u, roommate_match_weights u, roommate_verifications
-- u.
--
-- NOT declared, and revoked instead by
-- pending/revoke_write_grants_with_no_policy_2026-11-09.sql: every write grant
-- with no permissive policy behind it. RLS is on for all of them with a read
-- policy present, so those writes were already refused and nothing used them
-- (the two places the app touches these tables, readMyActiveGroups and the
-- thread's RoommateMatch line, are reads). A grant no policy can ever satisfy
-- is not security, it is litter, and the probe's third assertion is right to
-- refuse it: member_restrictions idu, moderation_appeals idu,
-- moderation_case_events idu, moderation_case_evidence idu,
-- moderation_case_reports idu, moderation_cases idu (staff decisions land
-- through the definer moderation_decide), roommate_group_members idu,
-- roommate_interests idu, roommate_viewings idu, and the insert and delete
-- halves of roommate_groups, roommate_match_weights and
-- roommate_verifications.
-- 10 November 2026: the staff desks' tables (staff_tasks i/u, staff_task_comments i,
-- staff_announcements iu, staff_announcement_reads iu, social_posts iu,
-- bd_prospects iu, bd_prospect_activity i, coo_escalations iu,
-- staff_access_recommendations iu, staff_weekly_reports iu), from
-- END_OF_BATCH_3_2026-11-10.sql, applied live the same day. Each write
-- grant has a permissive policy for the same command behind it, `to
-- authenticated`, admin or super_admin only (private.has_role), checked
-- against pg_policies on the live database before being written down. No
-- delete grant on any of them by design. Staff reach them through the service
-- client, so these policies only serve an admin on their own session.
--
-- 10 November 2026 (staff roles, pending/staff_roles_step2_2026-11-10.sql, NOT
-- APPLIED when this was written): content_items iu, marketing_campaign_results
-- iu, marketing_campaigns iu, staff_desk_entries iu, support_policy_notes iu,
-- support_qa_reviews i, tech_incident_updates i, tech_incidents iu. Each grant
-- has a permissive policy for the same command behind it (`<table>_admin_write`
-- for insert, `<table>_admin_update` for update), `to authenticated`, admin or
-- super_admin only through private.has_role. No delete grant on any of them;
-- the two insert-only tables (incident updates, QA reviews) are append-only.
-- This probe reads the live database, so it fails until step 2 is applied.
--
do $$
declare
  member constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  admin constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  n int;
  extra text;
  missing text;
  dead text;
begin
  -- 29 September: the console's second factor. An admin or a staff member
  -- holds their role only on a session that proved a security key, so this
  -- probe's session carries one for every admin and for the QA member (who
  -- some probes make staff), rolled back with everything else.
  insert into public.console_step_ups (user_id, session_id, expires_at)
  select console_probe_uid, '00000000-0000-4000-8000-00000000c0de', now() + interval '1 hour'
    from (select user_id from public.user_roles where role in ('admin', 'super_admin')
          union select '03f3dd52-ea28-4852-9abe-e5b0a67c2a43'::uuid
          union select '957b3bd2-cce3-425d-bba9-5cd876ca3d62'::uuid) s(console_probe_uid)
  on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
  -- The allowlist.
  with allow(tbl, cmds) as (values
      ('accommodation_amenities', 'idu'),
      ('accommodation_photos', 'idu'),
      ('accommodations', 'idu'),
      ('admin_saved_views', 'id'),
      ('agent_applications', 'iu'),
      ('agent_documents', 'iu'),
      ('agent_hours', 'idu'),
      ('agent_verification_checks', 'iu'),
      ('agents', 'idu'),
      ('ai_conversations', 'idu'),
      ('ai_learned_preferences', 'iu'),
      ('ai_messages', 'idu'),
      ('area_members', 'idu'),
      ('area_moderator_applications', 'idu'),
      ('areas', 'iu'),
      ('availability', 'idu'),
      ('badges', 'idu'),
      ('bank_accounts', 'u'),
      ('bd_prospect_activity', 'i'),
      ('bd_prospects', 'iu'),
      ('blocks', 'id'),
      ('bookings', 'i'),
      ('bot_settings', 'idu'),
      ('business_documents', 'id'),
      ('business_photos', 'idu'),
      ('business_verification_checks', 'idu'),
      ('businesses', 'idu'),
      ('calendar_feeds', 'id'),
      ('calendar_imports', 'iu'),
      ('cancellation_policies', 'idu'),
      ('circle_invites', 'iu'),
      ('circle_memberships', 'du'),
      ('circle_plan_signups', 'id'),
      ('circle_plans', 'iu'),
      ('circle_question_follows', 'id'),
      ('circle_shared_shortlists', 'id'),
      ('circle_vouches', 'id'),
      ('content_items', 'iu'),
      ('conversation_archives', 'idu'),
      ('conversation_prefs', 'idu'),
      ('conversations', 'i'),
      ('coo_escalations', 'iu'),
      ('event_attendees', 'idu'),
      ('events', 'idu'),
      ('feature_flags', 'idu'),
      ('firm_members', 'idu'),
      ('first_runs_seen', 'i'),
      ('follows', 'id'),
      ('inspection_confirmations', 'i'),
      ('inspection_report_items', 'iu'),
      ('inspection_report_photos', 'i'),
      ('inspection_reports', 'iu'),
      ('inspection_requests', 'idu'),
      ('inspection_truth', 'i'),
      ('institutions', 'idu'),
      ('kyc_consents', 'i'),
      ('landmarks', 'idu'),
      ('listing_access', 'idu'),
      ('listing_amenities', 'idu'),
      ('listing_broadcast_marks', 'idu'),
      ('listing_mandates', 'idu'),
      ('listing_photos', 'idu'),
      ('listing_videos', 'idu'),
      ('listings', 'idu'),
      ('local_governments', 'idu'),
      ('marketing_campaign_results', 'iu'),
      ('marketing_campaigns', 'iu'),
      ('member_notes', 'i'),
      ('message_attachments', 'i'),
      ('message_flags', 'u'),
      ('message_reactions', 'idu'),
      ('messages', 'i'),
      ('mutes', 'id'),
      ('notice_preferences', 'idu'),
      ('notifications', 'du'),
      ('occupations', 'idu'),
      ('passport_settings', 'iu'),
      ('payment_methods', 'u'),
      ('payout_accounts', 'du'),
      ('post_helpful', 'id'),
      ('post_media', 'id'),
      ('post_reactions', 'id'),
      ('post_reposts', 'id'),
      ('post_views', 'i'),
      ('posts', 'idu'),
      ('price_check_watches', 'id'),
      ('professional_profiles', 'idu'),
      ('profiles', 'u'),
      ('rate_calendar', 'idu'),
      ('rate_plans', 'idu'),
      ('refund_requests', 'i'),
      ('reply_templates', 'idu'),
      ('reports', 'idu'),
      ('reservations', 'iu'),
      ('restaurant_deposit_rules', 'idu'),
      ('restaurant_profiles', 'idu'),
      ('review_responses', 'idu'),
      ('reviews', 'i'),
      ('risk_alerts', 'idu'),
      ('room_inventory', 'idu'),
      ('room_types', 'idu'),
      ('roommate_group_expenses', 'idu'),
      ('roommate_group_posts', 'id'),
      ('roommate_group_shortlist', 'id'),
      ('roommate_group_votes', 'idu'),
      ('roommate_groups', 'u'),
      ('roommate_listings', 'idu'),
      ('roommate_match_weights', 'u'),
      ('roommate_profiles', 'idu'),
      ('roommate_saved_searches', 'idu'),
      ('roommate_verifications', 'u'),
      ('saved_collection_items', 'idu'),
      ('saved_collections', 'idu'),
      ('saved_items', 'idu'),
      ('saved_places', 'id'),
      ('saved_searches', 'idu'),
      ('service_windows', 'idu'),
      ('social_posts', 'iu'),
      ('social_profiles', 'idu'),
      ('staff_access_recommendations', 'iu'),
      ('staff_announcement_reads', 'iu'),
      ('staff_announcements', 'iu'),
      ('staff_desk_entries', 'iu'),
      ('staff_task_comments', 'i'),
      ('staff_tasks', 'iu'),
      ('staff_weekly_reports', 'iu'),
      ('stories', 'idu'),
      ('story_comment_reactions', 'id'),
      ('story_comments', 'idu'),
      ('story_reactions', 'id'),
      ('story_views', 'i'),
      ('support_policy_notes', 'iu'),
      ('support_qa_reviews', 'i'),
      ('support_ticket_attachments', 'i'),
      ('support_ticket_messages', 'i'),
      ('support_tickets', 'idu'),
      ('tech_incident_updates', 'i'),
      ('tech_incidents', 'iu'),
      ('tenancy_pins', 'i'),
      ('tenancy_reviews', 'i'),
      ('units', 'idu'),
      ('user_badges', 'idu'),
      ('user_roles', 'idu'),
      ('viewing_windows', 'idu')
  ),
  expected as (
    select tbl, case c when 'i' then 'INSERT' when 'u' then 'UPDATE' else 'DELETE' end cmd
      from allow, regexp_split_to_table(cmds, '') c
  ),
  live as (
    select r.role, t.relname tbl, cmds.cmd
      from pg_class t join pg_namespace ns on ns.oid = t.relnamespace
     cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) cmds(cmd)
     cross join (values ('anon'), ('authenticated')) r(role)
     where ns.nspname = 'public' and t.relkind in ('r', 'p', 'v', 'm', 'f')
       and (has_table_privilege(r.role, t.oid, cmds.cmd)
            or (cmds.cmd <> 'DELETE' and exists (
                  select 1 from pg_attribute a
                   where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
                     and has_column_privilege(r.role, t.oid, a.attnum, cmds.cmd))))
  )
  select (select string_agg(format('%s:%s.%s', l.role, l.tbl, l.cmd), ', ')
            from live l
           where l.role = 'anon' or not exists (select 1 from expected e where e.tbl = l.tbl and e.cmd = l.cmd)),
         (select string_agg(format('%s.%s', e.tbl, e.cmd), ', ')
            from expected e
           where not exists (select 1 from live l where l.role = 'authenticated' and l.tbl = e.tbl and l.cmd = e.cmd))
    into extra, missing;
  if extra is not null then raise exception 'PROBE_FAIL db-06: write grants not on the allowlist: %', extra; end if;
  if missing is not null then raise exception 'PROBE_FAIL db-06: allowlisted grants gone (update the list): %', missing; end if;

  -- Each allowlisted pair has a permissive policy behind it.
  select string_agg(format('%s.%s', l.tbl, l.cmd), ', ') into dead
    from (select t.relname tbl, cmds.cmd
            from pg_class t join pg_namespace ns on ns.oid = t.relnamespace
           cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) cmds(cmd)
           where ns.nspname = 'public' and t.relkind in ('r', 'p', 'v', 'm', 'f')
             and has_table_privilege('authenticated', t.oid, cmds.cmd)) l
   where not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = l.tbl and p.permissive = 'PERMISSIVE'
                        and p.cmd in (l.cmd, 'ALL') and p.roles && array['public', 'authenticated']::name[]);
  if dead is not null then raise exception 'PROBE_FAIL db-06: grants with no policy: %', dead; end if;

  -- ----------------------------------------------------------------- columns
  -- The column-scoped grants, which the table-level reads above cannot see.
  -- `colallow` is every INSERT or UPDATE a role holds on named columns and
  -- not on the table; `redact` is every column a role may NOT read on a table
  -- it may read something of. `colpending` and `readpending` name the columns
  -- a pending migration is about to change, so this probe is green on both
  -- sides of the founder running one.
  with colallow(role, tbl, priv, cols) as (values
      ('authenticated', 'bank_accounts',    'UPDATE', 'deleted_at, is_default, updated_at'),
      ('authenticated', 'calendar_feeds',   'INSERT', 'listing_id, room_type_id'),
      ('authenticated', 'calendar_imports', 'INSERT', 'listing_id, room_type_id, source, url'),
      ('authenticated', 'calendar_imports', 'UPDATE', 'enabled'),
      ('authenticated', 'notifications',    'UPDATE', 'read_at'),
      ('authenticated', 'payment_methods',  'UPDATE', 'deleted_at, is_default, updated_at'),
      ('authenticated', 'payout_accounts',  'UPDATE', 'is_default')
  ),
  -- pending/notifications_archive_grant_2026-11-11.sql.
  colpending(role, tbl, priv, col) as (values
      ('authenticated', 'notifications', 'UPDATE', 'archived_at')
  ),
  -- pending/listings_sharing_select_grant_2026-11-11.sql.
  readpending(role, tbl, col) as (values
      ('anon',          'listings', 'shared_living_ok'),
      ('anon',          'listings', 'max_occupants'),
      ('authenticated', 'listings', 'shared_living_ok'),
      ('authenticated', 'listings', 'max_occupants')
  ),
  redact(role, tbl, cols) as (values
      ('anon',          'accommodations', 'address, latitude, longitude, location, reviewer_id, review_notes'),
      ('authenticated', 'accommodations', 'address, latitude, longitude, location, reviewer_id, review_notes'),
      ('anon',          'businesses', 'address, latitude, longitude, location, phone, email, reviewer_id, review_notes, cac_number, registered_name, tin, representative_name, representative_phone, consents, verification_tier'),
      ('authenticated', 'businesses', 'address, latitude, longitude, location, phone, email, reviewer_id, review_notes, cac_number, registered_name, tin, representative_name, representative_phone, consents, verification_tier'),
      ('anon',          'catalogue_entries', 'latitude, longitude, location'),
      ('authenticated', 'catalogue_entries', 'latitude, longitude, location'),
      ('anon',          'fee_rates', 'created_by'),
      ('authenticated', 'identity_verifications', 'nin_hmac, bvn_hmac'),
      ('authenticated', 'inspection_safety_shares', 'created_by, token_hash, reminded_at'),
      ('anon',          'listings', 'address, landmark, latitude, longitude, reviewer_id, review_notes, verified_by, location, listing_fee_minor, listing_fee_rate_id, listing_fee_charged_at, firm_id, supply_verified_by, property_id, availability_confirmed_at, not_reconfirmed_since, closed_at, close_reason, closed_rent_payment_id, assigned_agent_id, needs_mandate_since, shared_living_ok, max_occupants, offers_enabled'),
      ('authenticated', 'listings', 'address, landmark, latitude, longitude, reviewer_id, review_notes, verified_by, location, listing_fee_minor, listing_fee_rate_id, listing_fee_charged_at, supply_verified_by, shared_living_ok, max_occupants, offers_enabled'),
      ('authenticated', 'member_subscriptions', 'provider, checkout_email_sha256, provider_plan_code, provider_customer_code, provider_subscription_code, provider_email_token, grant_id'),
      ('authenticated', 'money_credentials', 'credential_id, public_key_spki, sign_count'),
      ('anon',          'price_check_shares', 'created_by'),
      ('authenticated', 'price_check_shares', 'created_by'),
      ('authenticated', 'reservation_deposits', 'rule_id, guest_id, payee_user_id, provider, provider_ref, payee_subaccount_code, commission_bps, paystack_mode, authorization_url, access_code, processor_refund_id, updated_at'),
      ('authenticated', 'rewards_ledger', 'actor_id, idempotency_key'),
      ('authenticated', 'rewards_payouts', 'reference, bank_code, account_key, recipient_code, transfer_code, transfer_initiated_at, provider_status, risk_score, risk_reasons, failure_reason, updated_at'),
      ('anon',          'social_profiles', 'home_area_id, occupation_code, lga_code, state_code'),
      ('anon',          'user_badges', 'granted_by, reason, evidence, revoked_by')
  ),
  tabs as (
    select t.oid, t.relname::text tbl
      from pg_class t join pg_namespace ns on ns.oid = t.relnamespace
     where ns.nspname = 'public' and t.relkind in ('r', 'p', 'v', 'm', 'f')
  ),
  roles(role) as (values ('anon'), ('authenticated')),
  colgrant as (
    select r.rolname::text role, t.tbl, acl.privilege_type priv,
           string_agg(a.attname, ', ' order by a.attnum) cols
      from tabs t
      join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
     cross join lateral aclexplode(a.attacl) acl
      join pg_roles r on r.oid = acl.grantee
     where r.rolname in ('anon', 'authenticated')
       and acl.privilege_type in ('INSERT', 'UPDATE')
       and not has_table_privilege(r.rolname, t.oid, acl.privilege_type)
     group by 1, 2, 3
  ),
  redacted as (
    select r.role, t.tbl, string_agg(a.attname, ', ' order by a.attnum) cols
      from tabs t cross join roles r
      join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
     where not has_column_privilege(r.role, t.oid, a.attnum, 'SELECT')
       and exists (select 1 from pg_attribute b
                    where b.attrelid = t.oid and b.attnum > 0 and not b.attisdropped
                      and has_column_privilege(r.role, t.oid, b.attnum, 'SELECT'))
     group by 1, 2
  ),
  -- Every grant written on a NAMED COLUMN needs a policy for its command,
  -- the way the `dead` check above already demands it of a write grant on
  -- the table itself. A SELECT granted at TABLE level is not covered by
  -- either, and deliberately so: a reference table published to everybody
  -- (states, amenities, fee rates) is exactly that shape, and its policy is
  -- `using (true)`, which this test would pass anyway.
  anycolgrant as (
    select r.rolname::text role, t.tbl, acl.privilege_type priv
      from tabs t
      join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
     cross join lateral aclexplode(a.attacl) acl
      join pg_roles r on r.oid = acl.grantee
     where r.rolname in ('anon', 'authenticated')
     group by 1, 2, 3
  ),
  trouble(problem, role, tbl, priv, cols) as (
    select 'a column write grant nobody declared', g.role, g.tbl, g.priv, g.cols
      from colgrant g
     where not exists (select 1 from colallow a where a.role = g.role and a.tbl = g.tbl and a.priv = g.priv)
    union all
    select 'a declared column write grant is gone', a.role, a.tbl, a.priv, a.cols
      from colallow a
     where not exists (select 1 from colgrant g where g.role = a.role and g.tbl = a.tbl and g.priv = a.priv)
    union all
    select 'a column write grant covers a column nobody declared', g.role, g.tbl, g.priv, col
      from colgrant g
      join colallow a on a.role = g.role and a.tbl = g.tbl and a.priv = g.priv
     cross join unnest(string_to_array(g.cols, ', ')) col
     where col <> all (string_to_array(a.cols, ', '))
       and not exists (select 1 from colpending p
                        where p.role = g.role and p.tbl = g.tbl and p.priv = g.priv and p.col = col)
    union all
    select 'a declared column write grant lost a column', a.role, a.tbl, a.priv, col
      from colallow a
      join colgrant g on g.role = a.role and g.tbl = a.tbl and g.priv = a.priv
     cross join unnest(string_to_array(a.cols, ', ')) col
     where col <> all (string_to_array(g.cols, ', '))
    union all
    -- THE ONE THAT CATCHES A NEW COLUMN ON A COLUMN-SCOPED TABLE.
    select 'a column this role cannot read and nobody declared', d.role, d.tbl, 'SELECT', col
      from redacted d
     cross join unnest(string_to_array(d.cols, ', ')) col
     where not exists (select 1 from redact x
                        where x.role = d.role and x.tbl = d.tbl
                          and col = any (string_to_array(x.cols, ', ')))
    union all
    -- AND THE ONE THAT CATCHES A REDACTION BEING HANDED OUT.
    select 'a redacted column this role can now read', x.role, x.tbl, 'SELECT', col
      from redact x
     cross join unnest(string_to_array(x.cols, ', ')) col
     where has_column_privilege(x.role, ('public.' || quote_ident(x.tbl))::regclass, col, 'SELECT')
       and not exists (select 1 from readpending p where p.role = x.role and p.tbl = x.tbl and p.col = col)
    union all
    select 'a column grant with no policy behind it', g.role, g.tbl, g.priv, ''
      from anycolgrant g
     where not exists (select 1 from pg_policies p
                        where p.schemaname = 'public' and p.tablename = g.tbl
                          and p.permissive = 'PERMISSIVE' and p.cmd in (g.priv, 'ALL')
                          and p.roles && array['public', g.role]::name[])
  )
  select string_agg(format('%s (%s:%s.%s %s)', problem, role, tbl, priv, cols), ', ' order by problem, role, tbl)
    into extra
    from trouble;
  if extra is not null then raise exception 'PROBE_FAIL db-06: column grants: %', extra; end if;

  -- Sequences.
  if exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
              where ns.nspname = 'public' and c.relkind = 'S'
                and (has_sequence_privilege('anon', c.oid, 'USAGE') or has_sequence_privilege('anon', c.oid, 'UPDATE'))) then
    raise exception 'PROBE_FAIL db-06: anon can advance a public sequence';
  end if;

  -- A table created now starts with no anon write.
  create table public.probe_db06_new (id int);
  if has_table_privilege('anon', 'public.probe_db06_new', 'INSERT, UPDATE, DELETE') then
    raise exception 'PROBE_FAIL db-06: a new table grants anon a write';
  end if;
  drop table public.probe_db06_new;

  -- Control: a member's own writes still go through.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated', 'session_id', '00000000-0000-4000-8000-00000000c0de')::text, true);
  update public.profiles set updated_at = now() where id = member;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-06: member profile update rows=%', n; end if;
  insert into public.blocks (user_id, other_id) values (member, admin);
  delete from public.blocks where user_id = member and other_id = admin;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROBE_FAIL db-06: member unblock rows=%', n; end if;

  -- authenticated: the writes no policy allowed are refused by privilege.
  begin insert into public.notifications default values;
    raise exception 'PROBE_FAIL db-06: member inserted a notification';
  exception when insufficient_privilege then null; end;
  begin update public.messages set read_at = now() where false;
    raise exception 'PROBE_FAIL db-06: member could update messages';
  exception when insufficient_privilege then null; end;
  begin insert into public.terms_acceptances default values;
    raise exception 'PROBE_FAIL db-06: member inserted a terms acceptance';
  exception when insufficient_privilege then null; end;
  begin delete from public.reviews where false;
    raise exception 'PROBE_FAIL db-06: member could delete reviews';
  exception when insufficient_privilege then null; end;
  begin insert into public.agent_badges default values;
    raise exception 'PROBE_FAIL db-06: member inserted an agent badge';
  exception when insufficient_privilege then null; end;

  -- anon: every write is refused by privilege.
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin insert into public.user_roles default values;
    raise exception 'PROBE_FAIL db-06: anon inserted a role';
  exception when insufficient_privilege then null; end;
  begin insert into public.bank_accounts default values;
    raise exception 'PROBE_FAIL db-06: anon inserted a bank account';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set updated_at = now() where false;
    raise exception 'PROBE_FAIL db-06: anon could update profiles';
  exception when insufficient_privilege then null; end;
  begin insert into public.post_views default values;
    raise exception 'PROBE_FAIL db-06: anon inserted a post view';
  exception when insufficient_privilege then null; end;
  begin delete from public.listings where false;
    raise exception 'PROBE_FAIL db-06: anon could delete listings';
  exception when insufficient_privilege then null; end;
  begin perform nextval('public.agent_ref_seq');
    raise exception 'PROBE_FAIL db-06: anon advanced agent_ref_seq';
  exception when insufficient_privilege then null; end;

  raise exception 'PROBE_OK db-06';
end
$$;
