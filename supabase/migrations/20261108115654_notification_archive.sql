-- Activity Centre: add archived_at so users can archive notifications
-- without deleting them, and an index for the inbox query that now
-- filters on (user_id, archived_at IS NULL).

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- The inbox query is: WHERE user_id = $1 AND archived_at IS NULL
-- ORDER BY created_at DESC, id DESC.  The existing index on
-- (user_id, created_at DESC) no longer covers the filter, so replace it
-- with a partial index that keeps archived rows out of the scan.
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications (user_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL;

-- RLS: the existing update policy grants the owner write access to
-- read_at only.  Widen it to include archived_at so the same RLS
-- client that marks read can also archive.
-- (The policy name comes from the original migration; if it differs
-- on this database the DO block leaves it alone and the deploy log
-- will say so.)
DO $$
BEGIN
  -- Drop and recreate is the only way to change USING/WITH CHECK
  -- column grants on an existing policy in PG < 17.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'notifications_update_own'
  ) THEN
    DROP POLICY notifications_update_own ON notifications;
    CREATE POLICY notifications_update_own ON notifications
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- RPC for the Activity Centre category badges: one row per kind with total
-- and unread counts, excluding archived rows.  Runs as the caller (SECURITY
-- INVOKER is the default for functions), so RLS still applies.
CREATE OR REPLACE FUNCTION notification_category_counts()
RETURNS TABLE (kind notification_kind, total bigint, unread bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.kind,
    count(*)::bigint AS total,
    count(*) FILTER (WHERE n.read_at IS NULL)::bigint AS unread
  FROM notifications n
  WHERE n.user_id = auth.uid()
    AND n.archived_at IS NULL
  GROUP BY n.kind
  ORDER BY total DESC;
$$;
