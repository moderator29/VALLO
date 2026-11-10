-- Closes the one alert that keeps probe db-p2-02 red (checked live 9 November
-- 2026). On 13 October 2026 at 21:20 UTC something posted to the old Payluk
-- webhook without a valid signature; the route refused it (HTTP 401) and
-- raised "Webhook: payluk, signature invalid". Payluk was never switched on,
-- no arrangement exists, so nothing was at risk: the refusal WAS the right
-- outcome. The alert has sat open ever since, and db-p2-02 asserts that no
-- alert of this family is left open on the desk.
--
-- Data only, one row, reversible (set status back to 'open' and clear the two
-- stamps). Run once; running it twice changes nothing.
update public.risk_alerts
   set status = 'resolved',
       resolved_at = coalesce(resolved_at, now()),
       acknowledged_at = coalesce(acknowledged_at, now())
 where id = 'fe28957f-0267-4bb2-8cde-361fa72eb33b'
   and status = 'open'
   and title = 'Webhook: payluk, signature invalid';
