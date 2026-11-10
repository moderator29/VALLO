#!/usr/bin/env bash
# Builds OFFERS_ALL.sql, the one file the founder pastes, from the three parts.
set -euo pipefail
cd "$(dirname "$0")"
{
  cat <<'HEAD'
-- =====================================================================
-- VALLO OFFERS AND THE DEAL ROOM: THE ONE SQL DROP (10 November 2026)
-- =====================================================================
-- Paste once into the Supabase SQL Editor and press Run. Safe to run twice.
-- Rollback: pending/rollback/offers_rollback.sql.
--   Part 1  sale agreements: kind 'sale', the statuses, the walls (a sale can
--           never be paid, never take a transaction, never change once agreed),
--           offer policy and requirements, helpers
--   Part 2  the doors: submit, counter, accept, decline, withdraw, ask for
--           information, stages, inspection link, dispute, expiry and reminder jobs
--   Part 3  reads, the private document vault and its access log, the admin desk
-- Tested on a local copy of the schema: supabase/tests/offers (run.sh, e2e.sql,
-- race.sh: two sellers and two tabs accepting at once give one agreement).
HEAD
  for f in offers_01_sale_agreements.sql offers_02_sale_doors.sql offers_03_reads_documents_admin.sql; do
    printf '\n-- ======================= %s =======================\n' "$f"; cat "$f"
  done
} > OFFERS_ALL.sql
echo "built OFFERS_ALL.sql ($(wc -l < OFFERS_ALL.sql) lines)"
