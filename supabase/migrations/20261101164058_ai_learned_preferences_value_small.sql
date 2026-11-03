-- Security review (1 November 2026): members write their own learned
-- preferences directly under RLS, so the value is bounded in the database,
-- not only by the app. A preference is a word or two; 1000 bytes is generous.
alter table public.ai_learned_preferences
  add constraint ai_learned_preferences_value_small check (octet_length(value::text) <= 1000) not valid;
alter table public.ai_learned_preferences validate constraint ai_learned_preferences_value_small;
