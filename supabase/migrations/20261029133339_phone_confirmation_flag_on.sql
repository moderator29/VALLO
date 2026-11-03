insert into public.feature_flags (key, enabled, note)
values ('phone_confirmation', true, 'Mobile number confirmation by code. New accounts must confirm one at sign-up once an SMS vendor (Termii) is wired; until then nothing asks for a code that cannot arrive.')
on conflict (key) do update set enabled = true, updated_at = now();
