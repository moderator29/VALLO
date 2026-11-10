#!/usr/bin/env bash
# Rebuilds a throwaway database from the stub, applies the three pending offer
# files in order, then runs e2e.sql. Usage: run.sh [psql args]. Needs a local
# Postgres 16 (see README.md).
set -euo pipefail
cd "$(dirname "$0")"
P="${PSQL:-psql -q -h /var/tmp/pgl -p 5544 -U postgres}"
$P -c "drop database if exists offers_t" -c "create database offers_t" >/dev/null 2>&1
for f in local_stub.sql ../../migrations/pending/offers_01_sale_agreements.sql ../../migrations/pending/offers_02_sale_doors.sql ../../migrations/pending/offers_03_reads_documents_admin.sql; do
  $P -v ON_ERROR_STOP=1 -d offers_t -f "$f" 2>&1 | grep -v NOTICE || true
done
