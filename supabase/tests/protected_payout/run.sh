#!/usr/bin/env bash
# Rebuilds a throwaway database from the stub, applies the pending payout file
# twice (it must be safe to run twice), then runs e2e.sql, which ends E2E_OK.
# Needs a local Postgres 16 on /var/tmp/pgl:5544 (see ../offers/README.md).
set -euo pipefail
cd "$(dirname "$0")"
P="${PSQL:-psql -q -h /var/tmp/pgl -p 5544 -U postgres}"
$P -c "drop database if exists payout_t" -c "create database payout_t" >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -d payout_t -f local_stub.sql >/dev/null
$P -v ON_ERROR_STOP=1 -d payout_t -f ../../migrations/pending/protected_payout_to_lister_2026-11-15.sql 2>&1 | grep -v NOTICE || true
$P -v ON_ERROR_STOP=1 -d payout_t -f ../../migrations/pending/protected_payout_to_lister_2026-11-15.sql 2>&1 | grep -v NOTICE || true
$P -d payout_t -f e2e.sql 2>&1 | grep -E "E2E_(OK|FAIL)|ERROR" || true
