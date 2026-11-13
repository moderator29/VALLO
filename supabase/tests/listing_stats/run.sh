#!/usr/bin/env bash
# Rebuilds a throwaway database from the stub, applies the pending listing
# stats file TWICE (it must be safe to run twice), then runs e2e.sql.
# Needs a local Postgres 16 (see ../offers/README.md for the one-line start).
set -euo pipefail
cd "$(dirname "$0")"
P="${PSQL:-psql -q -h /var/tmp/pgl -p 5544 -U postgres}"
$P -c "drop database if exists stats_t" -c "create database stats_t" >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -d stats_t -f local_stub.sql >/dev/null
for run in 1 2; do
  $P -v ON_ERROR_STOP=1 -d stats_t -f ../../migrations/pending/listing_stats_2026-11-13.sql 2>&1 | grep -E "probe|ERROR" || true
done
$P -v ON_ERROR_STOP=1 -d stats_t -f e2e.sql 2>&1 | grep -E "E2E_OK|ERROR"
