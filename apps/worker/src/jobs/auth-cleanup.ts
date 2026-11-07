import type pg from 'pg';

/** Deletes expired/revoked sessions and used/expired one-time tokens older than the retention window. */
export async function runAuthCleanup(client: pg.ClientBase, retentionDays = 30): Promise<{ sessions: number; tokens: number }> {
  const sessions = await client.query(
    `DELETE FROM auth_sessions
      WHERE (revoked_at IS NOT NULL AND revoked_at < now() - make_interval(days => $1))
         OR expires_at < now() - make_interval(days => $1)`,
    [retentionDays],
  );
  const tokens = await client.query(
    `DELETE FROM auth_tokens
      WHERE (used_at IS NOT NULL OR expires_at < now()) AND created_at < now() - make_interval(days => $1)`,
    [retentionDays],
  );
  return { sessions: sessions.rowCount ?? 0, tokens: tokens.rowCount ?? 0 };
}
