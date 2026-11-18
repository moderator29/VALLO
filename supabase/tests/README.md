# Database probes

`supabase/tests/probes/*.sql` are the database's regression tests: RLS
policies, grants, triggers and SECURITY DEFINER functions, checked against the
live database as the roles that actually call them (`anon`, `authenticated`).
The unit suite (`vitest`) never reaches the database, so this folder is the only
thing that fails when a migration revokes a grant a policy needs, opens a money
table to the API roles, or lets a member publish their own listing.

## The contract (one file = one probe)

- The file is ONE `do $$ ... $$;` block. Comments above it are fine.
- It switches into an API role with `set local role authenticated` (or `anon`)
  and `perform set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`.
  The QA uids are member `957b3bd2-cce3-425d-bba9-5cd876ca3d62` and admin
  `03f3dd52-ea28-4852-9abe-e5b0a67c2a43`. Never put credentials in a probe.
- It runs a CONTROL that must succeed (so a probe that is refused everything
  cannot pass), then each refusal, catching the expected SQLSTATE.
- It ALWAYS ends in `raise exception 'PROBE_OK <file name without .sql>'`, and
  reports a failure as `raise exception 'PROBE_FAIL <id>: <what>'`. Because it
  always raises, it always rolls back.
- It files its own fixtures inside its transaction (a fresh auth user, which
  the signup trigger gives a profile; an agent; a listing published on an
  approved mandate; a business, hotel or thread) and never borrows rows that
  happen to be on the live database. On 16 November 2026 the founder deleted
  every example row (the Vallo Examples user, its listings, hotels and
  threads) and 32 probes that borrowed them failed at once; they now file
  their own. The QA member and admin above, and reference tables, are the
  only standing rows a probe may rely on.
- It reads grants with `has_table_privilege` / `has_column_privilege` /
  `has_function_privilege` or `pg_class.relacl`, never `information_schema`'s
  grant views, which answer only about the observing role.

`scripts/db-probes/contract.mjs` holds the rule; `apps/web/src/lib/db-probes/contract.test.ts`
checks every file in this folder against it on every `vitest` run, database or
not.

## Running them

### From a shell or CI

```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres' \
  node scripts/db-probes/run.mjs            # all probes
node scripts/db-probes/run.mjs --only db-20,mon-10-money-grants
node scripts/db-probes/run.mjs --check      # contract only, no database
node scripts/db-probes/run.mjs --list       # the files, one per line
```

Each probe goes to `psql` in its own transaction (`begin; <probe>; rollback;`)
with a 60 s statement timeout and a 5 s lock timeout. PASS means psql exited
non-zero and printed `PROBE_OK <id>` on an `ERROR:` line (a NOTICE never
counts); everything else, including a probe that finished without raising, is
FAIL. A probe may not call `dblink` or `pg_net`, which act outside its
transaction. Exit status: 0 all passed, 1 any failed, 2 the runner
could not run (no `DATABASE_URL`, no `psql`). Needs `psql` (`postgresql-client`).

Use the SESSION pooler (port 5432) or the direct connection, as the `postgres`
user: the probes build fixtures as the owner and `set role` into `anon` and
`authenticated` (see "Why the postgres user" below).

### In CI

`.github/workflows/ci.yml` job **Database probes** runs the same command when
the repository secret `PROBES_DATABASE_URL` is set. Without it the job FAILS
with a warning and a step summary saying the database was NOT checked, so it
can never pass without running. Make it a required check only after the
secret exists and the probes are green.

**Founder, one step (the secret):** Supabase dashboard, project
`uccixoonmbhrnyczyigt`, **Connect** → **Session pooler**, copy the URI with the
database password filled in. Then GitHub → the repository → Settings → Secrets
and variables → Actions → **New repository secret**: name
`PROBES_DATABASE_URL`, value that URI. It is a secret, never a variable.

**Why the `postgres` user and not a narrower role.** Several probes build
their own fixtures before switching into an API role (an escrow in a given
state, a ledger row, a draft business) and remove them again, which needs the
table owner's rights; a role that can only become `anon` or `authenticated`
fails those probes. Everything still rolls back, and the runner refuses
`dblink`/`pg_net`, the two ways to write outside the transaction. The
exposure is the secret itself: any workflow on a branch of this repository
can read it, which is acceptable only while everyone who can push already
holds production access. If that changes, move the job to `push` on `main`
only, or to a GitHub environment with required reviewers.

### In a Claude session with the Supabase MCP

There is no connection string in a session, so each file goes through
`apply_migration` (never `execute_sql`, which runs with `rolbypassrls` and can
never demonstrate a refusal):

1. `node scripts/db-probes/run.mjs --list` for the files.
2. For each, `apply_migration` with `name: probe_<id>` and the file's contents.
3. The expected answer is an ERROR whose text contains `PROBE_OK <id>`. A
   `PROBE_FAIL` or any other error is a failure.
4. Because the migration failed, nothing is recorded; confirm with
   `select version, name from supabase_migrations.schema_migrations order by version desc limit 3`.

## Adding a probe

Name it after the finding it pins, lower case (`db-01.sql`), or after what it
checks when it pins a class (`db-20.sql` is every policy's function grants).
Make it FAIL first against the defect (or a rolled-back mutation that
reintroduces it), then pass against the fix.
