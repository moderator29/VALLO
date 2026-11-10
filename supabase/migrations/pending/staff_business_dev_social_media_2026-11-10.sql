-- TWO NEW STAFF POSITIONS: BUSINESS DEVELOPMENT EXECUTIVE AND SOCIAL MEDIA
-- MANAGER (founder, 10 November 2026). Extends Track K
-- (20260925133647_track_k_staff_scopes_handbook_and_only_the_super_admin_grants.sql)
-- and named positions (20260929094459_named_staff_positions_with_default_scope_bundles.sql)
-- exactly as they already work: a super admin grants a position, which sets a
-- scope bundle; nothing here changes who may grant it or how.
--
-- Business Development gets `listing_approval`, the SAME scope that already
-- lets a Listings Reviewer review, verify, approve-and-publish and restrict a
-- member on a property case (founder ruling, 10 Nov: "3 yes they do"). It is
-- not a new permission; Business Development Executives are simply added to
-- the set of positions that may hold it.
--
-- Social Media Manager gets a new `social_media` scope, with no listing,
-- moderation or financial access of any kind: campaigns, the content
-- calendar, the media library and approvals, nothing else.
--
-- `staff_scope_words` is also extended to the four scopes the live enum
-- already carries (trust_safety, roommates, circle, analyst) that this
-- function never learned to name; they have shown as a blank gap in the
-- scope line since whichever migration added them. Fixed here as the
-- smallest safe addition alongside the two new scopes.
--
-- APPLIED by the lead on 10 November 2026, in two steps (a new enum value
-- must commit before anything in the same database session can use it; one
-- transaction cannot do both). Verified live: both titles, both scope
-- bundles, the extended scope words, and that every EXISTING bundle (the
-- CEO's, checked) is untouched. Kept here as the record; do not run again.
--
-- Run the two blocks below as TWO SEPARATE statements if this is ever
-- reapplied (for instance in a fresh environment), never pasted as one.

-- STEP 1 (commits on its own):
-- alter type public.staff_scope add value if not exists 'business_development';
-- alter type public.staff_scope add value if not exists 'social_media';

-- STEP 2:
begin;
set local lock_timeout = '5s';

alter table public.staff_grants drop constraint if exists staff_grants_position_known;
alter table public.staff_grants add constraint staff_grants_position_known check (
  position is null or position in (
    'moderator', 'support_agent', 'kyc_reviewer', 'listings_reviewer', 'agreements_officer',
    'trust_safety_lead', 'compliance_officer', 'finance_officer', 'operations_manager',
    'cfo', 'coo', 'ceo', 'business_development_executive', 'social_media_manager'));

create or replace function private.staff_position_title(p_position text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_position
    when 'moderator' then 'Moderator'
    when 'support_agent' then 'Support Agent'
    when 'kyc_reviewer' then 'KYC Reviewer'
    when 'listings_reviewer' then 'Listings Reviewer'
    when 'agreements_officer' then 'Agreements Officer'
    when 'trust_safety_lead' then 'Head of Trust and Safety'
    when 'compliance_officer' then 'Compliance Officer'
    when 'finance_officer' then 'Finance Officer'
    when 'operations_manager' then 'Operations Manager'
    when 'cfo' then 'Chief Financial Officer'
    when 'coo' then 'Chief Operating Officer'
    when 'ceo' then 'Chief Executive Officer'
    when 'business_development_executive' then 'Business Development Director'
    when 'social_media_manager' then 'Social Media Manager'
  end;
$function$;

create or replace function private.staff_position_scopes(p_position text)
returns public.staff_scope[]
language sql
immutable
set search_path to ''
as $function$
  select case p_position
    when 'moderator' then array['moderation']::public.staff_scope[]
    when 'support_agent' then array['support']::public.staff_scope[]
    when 'kyc_reviewer' then array['kyc_review']::public.staff_scope[]
    when 'listings_reviewer' then array['listing_approval']::public.staff_scope[]
    when 'agreements_officer' then array['agreements', 'guarantee']::public.staff_scope[]
    when 'trust_safety_lead' then array['listing_approval', 'kyc_review', 'moderation', 'support']::public.staff_scope[]
    when 'compliance_officer' then array['kyc_review', 'compliance']::public.staff_scope[]
    when 'finance_officer' then array['guarantee', 'finance']::public.staff_scope[]
    when 'operations_manager' then array['support', 'agreements', 'operations']::public.staff_scope[]
    when 'cfo' then array['agreements', 'guarantee', 'finance', 'compliance']::public.staff_scope[]
    when 'coo' then array['listing_approval', 'moderation', 'support', 'agreements', 'operations']::public.staff_scope[]
    when 'ceo' then array['listing_approval', 'kyc_review', 'moderation', 'support', 'agreements', 'guarantee',
                          'finance', 'compliance', 'operations']::public.staff_scope[]
    when 'business_development_executive' then array['business_development', 'listing_approval']::public.staff_scope[]
    when 'social_media_manager' then array['social_media']::public.staff_scope[]
  end;
$function$;

create or replace function private.staff_scope_words(p_scopes public.staff_scope[])
returns text
language sql
immutable
set search_path to ''
as $function$
  select string_agg(case s
      when 'listing_approval' then 'Listing approval'
      when 'kyc_review' then 'KYC review'
      when 'moderation' then 'Reports and moderation'
      when 'support' then 'Support'
      when 'agreements' then 'Agreement approval'
      when 'guarantee' then 'Guarantee claims'
      when 'finance' then 'Finance'
      when 'compliance' then 'Compliance'
      when 'operations' then 'Operations'
      when 'trust_safety' then 'Trust and Safety'
      when 'roommates' then 'Roommates moderation'
      when 'circle' then 'Circle moderation'
      when 'analyst' then 'Read-only analyst'
      when 'business_development' then 'Business development'
      when 'social_media' then 'Social media'
    end, ', ' order by s)
  from unnest(p_scopes) s;
$function$;

revoke all on function private.staff_position_title(text) from public, anon, authenticated;
revoke all on function private.staff_position_scopes(text) from public, anon, authenticated;
revoke all on function private.staff_scope_words(public.staff_scope[]) from public, anon, authenticated;

-- Self-checks.
do $check$
begin
  if private.staff_position_title('business_development_executive') is distinct from 'Business Development Director' then
    raise exception 'staff_business_dev_social_media: business_development_executive title wrong';
  end if;
  if private.staff_position_scopes('business_development_executive') is distinct from
     array['business_development', 'listing_approval']::public.staff_scope[] then
    raise exception 'staff_business_dev_social_media: business_development_executive bundle wrong';
  end if;
  if private.staff_position_scopes('social_media_manager') is distinct from array['social_media']::public.staff_scope[] then
    raise exception 'staff_business_dev_social_media: social_media_manager bundle wrong';
  end if;
  -- Every existing position keeps its exact bundle (nothing above was narrowed).
  if private.staff_position_scopes('ceo') is distinct from
     array['listing_approval', 'kyc_review', 'moderation', 'support', 'agreements', 'guarantee',
           'finance', 'compliance', 'operations']::public.staff_scope[] then
    raise exception 'staff_business_dev_social_media: an existing bundle changed';
  end if;
  if private.staff_scope_words(array['business_development', 'social_media']::public.staff_scope[])
     is distinct from 'Business development, Social media' then
    raise exception 'staff_business_dev_social_media: scope words wrong';
  end if;
end
$check$;

notify pgrst, 'reload schema';

commit;
