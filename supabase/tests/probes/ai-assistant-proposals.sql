-- AI-ASSISTANT-PROPOSALS (Phase 2). Needs 20261101105455_ai_assistant_proposals.
--  1. no proposal without the kind's permission; unknown kinds refused
--  2. a proposal is single use, hash-bound, owner-only, and expires
--  3. revoking the permission (or switching off) makes a pending proposal fail closed
--  4. a failed result can be retried only as a NEW proposal
do $$
declare
  m constant uuid := '957b3bd2-cce3-425d-bba9-5cd876ca3d62';
  o constant uuid := '03f3dd52-ea28-4852-9abe-e5b0a67c2a43';
  r jsonb;
  pid uuid;
  ph text;
  pay jsonb := '{"listing_id":"00000000-0000-0000-0000-000000000001","slot":"2026-11-10T10:00"}';
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', m), true);

  perform public.ai_assistant_activate('2026-11-01', '2026-11-01', true, true, array['discovery']);
  r := public.ai_proposal_create('viewing_request', pay);
  if (r->>'ok')::boolean or r->>'reason' <> 'not_granted' then raise exception 'PROBE_FAIL 1a: %', r; end if;
  r := public.ai_proposal_create('transfer_money', pay);
  if (r->>'ok')::boolean or r->>'reason' <> 'unknown_kind' then raise exception 'PROBE_FAIL 1b: %', r; end if;
  perform public.ai_assistant_set_permission('bookings_viewings', true);
  r := public.ai_proposal_create('payment_review', pay);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 1c: payment proposal without payment_assist'; end if;

  r := public.ai_proposal_create('viewing_request', pay);
  if not (r->>'ok')::boolean then raise exception 'PROBE_FAIL 2 control: %', r; end if;
  pid := (r->>'id')::uuid; ph := r->>'payload_hash';

  -- another member cannot see or decide it
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', o), true);
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if (r->>'ok')::boolean or r->>'reason' <> 'not_found' then raise exception 'PROBE_FAIL 2a: %', r; end if;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', m), true);

  r := public.ai_proposal_decide(pid, 'confirm', repeat('0', 64));
  if (r->>'ok')::boolean or r->>'reason' <> 'hash_mismatch' then raise exception 'PROBE_FAIL 2b: %', r; end if;
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if not (r->>'ok')::boolean or r->'payload' is distinct from pay then raise exception 'PROBE_FAIL 2c: %', r; end if;
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if (r->>'ok')::boolean or r->>'reason' <> 'already_decided' then raise exception 'PROBE_FAIL 2d replay: %', r; end if;

  -- retry only after a recorded failure
  r := public.ai_proposal_retry(pid);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 4a: retried without a failure'; end if;
  r := public.ai_proposal_result(pid, '{"ok":false,"reason":"slot_taken"}'::jsonb);
  if not (r->>'ok')::boolean then raise exception 'PROBE_FAIL 4b: %', r; end if;
  r := public.ai_proposal_result(pid, '{"ok":true}'::jsonb);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 4c: a result was written twice'; end if;
  r := public.ai_proposal_retry(pid);
  if not (r->>'ok')::boolean or (r->>'id')::uuid = pid then raise exception 'PROBE_FAIL 4d: %', r; end if;

  -- expiry
  r := public.ai_proposal_create('save_listing', '{"listing_id":"x"}'::jsonb);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 2e: save without saved_prefs'; end if;
  perform public.ai_assistant_set_permission('saved_prefs', true);
  r := public.ai_proposal_create('save_listing', '{"listing_id":"x"}'::jsonb);
  pid := (r->>'id')::uuid; ph := r->>'payload_hash';
  reset role;
  update public.ai_action_proposals set expires_at = now() - interval '1 minute' where id = pid;
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', m), true);
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if (r->>'ok')::boolean or r->>'reason' <> 'expired' then raise exception 'PROBE_FAIL 2f: %', r; end if;

  -- revoked permission fails closed
  r := public.ai_proposal_create('save_listing', '{"listing_id":"y"}'::jsonb);
  pid := (r->>'id')::uuid; ph := r->>'payload_hash';
  perform public.ai_assistant_set_permission('saved_prefs', false);
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 3a: confirmed after revoke: %', r; end if;

  -- switched off fails closed
  perform public.ai_assistant_set_permission('saved_prefs', true);
  r := public.ai_proposal_create('save_listing', '{"listing_id":"z"}'::jsonb);
  pid := (r->>'id')::uuid; ph := r->>'payload_hash';
  perform public.ai_assistant_deactivate();
  r := public.ai_proposal_decide(pid, 'confirm', ph);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 3b: confirmed while OFF: %', r; end if;
  r := public.ai_proposal_create('save_listing', '{"listing_id":"z"}'::jsonb);
  if (r->>'ok')::boolean then raise exception 'PROBE_FAIL 3c: proposal created while OFF'; end if;

  raise exception 'PROBE_OK ai-assistant-proposals';
end $$;
