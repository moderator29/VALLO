# Offers: local database tests

The offers SQL (`supabase/migrations/pending/offers_01..03`) is tested on a
throwaway local Postgres 16 with a stub of the live schema, not the live
database.

    initdb -D /var/tmp/pgl/data -A trust && pg_ctl -D /var/tmp/pgl/data -o '-p 5544 -k /var/tmp/pgl' start
    supabase/tests/offers/run.sh                      # rebuild: stub, then the three pending files
    psql -h /var/tmp/pgl -p 5544 -U postgres -d offers_t -f supabase/tests/offers/e2e.sql   # expects E2E_OK
    supabase/tests/offers/run.sh && supabase/tests/offers/race.sh                            # expects RACE_OK

`e2e.sql` covers the buyer journey (cash, mortgage, instalment, blank amount,
bad amounts), idempotent replay, the eligibility gate, a four-version
negotiation with its history intact, wrong turn, superseded and expired
versions, a suspended listing, acceptance, the walls (no transaction, no paid,
no in_review, no edit once agreed), stages, documents, a stranger refused,
decline and withdraw, the expiry job, and admin permissions. `race.sh` runs two
tabs of one seller and a second offer accepting at once and expects exactly one
agreement and one approval event.
