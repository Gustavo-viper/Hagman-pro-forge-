import type pg from 'pg';
import type { EmailJobData, Locale } from '@fandom/shared';

/**
 * Event reminders: one email ~24 h before and one ~1 h before the start, per participant.
 * Rows are marked in the same transaction (SKIP LOCKED), so concurrent workers never
 * double-send. A participant who registers less than 1 h before gets only the 1 h reminder.
 */
export async function collectEventReminders(client: pg.ClientBase, appUrl: string, now = new Date()): Promise<EmailJobData[]> {
  const base = appUrl.replace(/\/+$/, '');
  const emails: EmailJobData[] = [];
  for (const kind of ['1h', '24h'] as const) {
    const column = kind === '1h' ? 'reminded_1h_at' : 'reminded_24h_at';
    const window = kind === '1h' ? "interval '1 hour'" : "interval '24 hours'";
    const lower = kind === '1h' ? 'e.starts_at > $1' : "e.starts_at > $1::timestamptz + interval '1 hour'";
    await client.query('BEGIN');
    try {
      const { rows } = await client.query<{
        event_id: string; user_id: string; email: string; locale: Locale; timezone: string; title: Record<Locale, string>;
        starts_at: Date; slug: string;
      }>(
        `SELECT p.event_id, p.user_id, u.email, pr.locale, pr.timezone, e.title, e.starts_at, un.slug
           FROM event_participants p
           JOIN events e ON e.id = p.event_id AND e.status = 'published'
           JOIN universes un ON un.id = e.universe_id
           JOIN users u ON u.id = p.user_id AND u.status = 'active'
           JOIN profiles pr ON pr.user_id = p.user_id
          WHERE p.${column} IS NULL AND ${lower} AND e.starts_at <= $1::timestamptz + ${window}
          ORDER BY p.event_id, p.user_id
          FOR UPDATE OF p SKIP LOCKED
          LIMIT 1000`,
        [now],
      );
      for (const r of rows) {
        await client.query(
          `UPDATE event_participants SET ${column} = now()${kind === '1h' ? ', reminded_24h_at = COALESCE(reminded_24h_at, now())' : ''}
            WHERE event_id = $1 AND user_id = $2`,
          [r.event_id, r.user_id],
        );
        emails.push({
          to: r.email,
          template: 'event_reminder',
          locale: r.locale,
          link: `${base}/universes/${r.slug}/events/${r.event_id}`,
          details: {
            title: r.title[r.locale] ?? r.title['pt-BR'],
            when: new Intl.DateTimeFormat(r.locale, { dateStyle: 'full', timeStyle: 'short', timeZone: r.timezone }).format(r.starts_at),
            startsIn: kind,
          },
        });
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return emails;
}
