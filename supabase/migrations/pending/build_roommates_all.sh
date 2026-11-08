#!/usr/bin/env bash
# Builds ROOMMATES_ALL.sql, the one file the founder pastes into the Supabase
# SQL Editor, from the tested parts in order. Run from this folder.
set -euo pipefail
cd "$(dirname "$0")"
{
  cat <<'HEAD'
-- =====================================================================
-- VALLO ROOMMATES: THE ONE SQL DROP
-- =====================================================================
-- Paste this whole file into the Supabase SQL Editor and press Run once.
--
-- What it does, in order:
--   Part 1  tables, row level security, storage buckets, chat on a mutual yes
--   Part 2  the matching engine, the private reads, every write and its
--           notifications, saved search alerts, the nightly expiry job
--   Part 3  the feed card column, "good for sharing" on property listings,
--           two Circle categories and three Vallo-started communities
--   Part 5  the schools directory (55 schools, email domains checked)
--   Part 7  Trust and Safety: one case engine for every module, member
--           restrictions and appeals, staff scopes, the admin desks' reads
--   Part 6  bookkeeping: the migration list records this drop and three
--           hand-run migrations of 8 November
--
-- Safe to run twice: every table and index is IF NOT EXISTS, every policy
-- is dropped before it is created, every function is CREATE OR REPLACE,
-- every seed is ON CONFLICT DO NOTHING. Nothing existing is deleted. Two
-- existing objects are widened, never narrowed: the saved collections kind
-- check (adds roommate kinds) and the Circle category check (adds two).
-- One existing trigger function is upgraded: a direct chat is allowed
-- between two people with an accepted roommate connection.
--
-- Built by build_roommates_all.sh from the roommates_*.sql parts, each one
-- tested on a local copy of the schema (supabase/tests/roommates).
-- =====================================================================

-- Part 0: four new staff scopes (outside the transaction, as Postgres
-- prefers for new enum values).
alter type public.staff_scope add value if not exists 'trust_safety';
alter type public.staff_scope add value if not exists 'roommates';
alter type public.staff_scope add value if not exists 'circle';
alter type public.staff_scope add value if not exists 'analyst';

begin;
HEAD
  for part in roommates_1_core.sql roommates_2_engine.sql roommates_3_integrations.sql roommates_5_institutions.sql roommates_7_trust_safety.sql roommates_6_bookkeeping.sql; do
    printf '\n\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> %s\n\n' "$part"
    cat "$part"
  done
  printf '\ncommit;\n'
} > ROOMMATES_ALL.sql
echo "ROOMMATES_ALL.sql: $(wc -l < ROOMMATES_ALL.sql) lines"
