set lock_timeout = '5s';

-- Fast-start plan item 1: measure the real cold start. Two new boot metrics
-- (splash hidden, opening done) and two honest labels: whether this load was
-- the first of the session (cold) and how the document reached the screen.
alter table public.web_vitals_samples
  add column if not exists cold boolean,
  add column if not exists start_kind text;

alter table public.web_vitals_samples
  add constraint web_vitals_samples_start_kind_check
  check (start_kind is null or start_kind in ('network', 'instant', 'frugal', 'kept')) not valid;

alter table public.web_vitals_samples drop constraint web_vitals_samples_metric_check;
alter table public.web_vitals_samples
  add constraint web_vitals_samples_metric_check
  check (metric in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'BOOT_HIDE', 'BOOT_OPEN')) not valid;
