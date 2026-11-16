#!/usr/bin/env bash
# Rebuilds a throwaway database from the stub, applies the VALLO Intelligence
# search file twice (it must be safe to run twice), then runs e2e.sql, which
# ends E2E_OK. Needs a local Postgres 16 on /var/tmp/pgl:5544 (see ../offers/README.md).
set -euo pipefail
cd "$(dirname "$0")"
P="${PSQL:-psql -q -h /var/tmp/pgl -p 5544 -U postgres}"
F=../../migrations/pending/intelligence_search_2026-11-16.sql
$P -c "drop database if exists intel_search_t" -c "create database intel_search_t" >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -d intel_search_t -f local_stub.sql >/dev/null
$P -v ON_ERROR_STOP=1 -d intel_search_t -f "$F" 2>&1 | grep -v "^NOTICE.*already exists" || true
$P -v ON_ERROR_STOP=1 -d intel_search_t -f "$F" 2>&1 | grep -v "^NOTICE.*already exists" || true
$P -d intel_search_t -f e2e.sql 2>&1 | grep -E "E2E_(OK|FAIL)|ERROR" || true
