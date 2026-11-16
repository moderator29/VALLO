#!/bin/sh
# Runs the copilot threads migration twice on a fresh local database, then the end to end check.
set -e
DB=copilot_threads_t
PSQL="psql -h /var/tmp/pgl -p 5544 -v ON_ERROR_STOP=1 -q"
HERE=$(cd "$(dirname "$0")" && pwd)
su postgres -c "dropdb -h /var/tmp/pgl -p 5544 --if-exists $DB && createdb -h /var/tmp/pgl -p 5544 $DB"
su postgres -c "$PSQL -d $DB -f $HERE/local_stub.sql"
su postgres -c "$PSQL -d $DB -f $HERE/../../migrations/pending/copilot_threads_2026-11-16.sql"
su postgres -c "$PSQL -d $DB -f $HERE/../../migrations/pending/copilot_threads_2026-11-16.sql"
su postgres -c "$PSQL -d $DB -f $HERE/e2e.sql"
