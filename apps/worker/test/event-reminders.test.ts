import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderEmail } from '../src/jobs/email.js';
import { collectEventReminders } from '../src/jobs/event-reminders.js';

const url = process.env.TEST_DATABASE_URL;

describe('event emails', () => {
  it('renders reminder and cancellation', () => {
    const r = renderEmail({ to: 'a@b.test', template: 'event_reminder', locale: 'pt-BR', link: 'https://x.test/e', details: { title: 'Noite de quiz', when: 'sábado, 5 de dezembro', startsIn: '1h' } });
    expect(r.text).toContain('Noite de quiz começa em 1 hora');
    expect(renderEmail({ to: 'a@b.test', template: 'event_cancelled', locale: 'en', link: 'https://x.test', details: { title: 'Quiz', when: 'Dec 5' } }).subject).toBe('Event cancelled — Fandom Universe');
  });
});

describe.runIf(Boolean(url))('event reminders job', () => {
  const client = new pg.Client({ connectionString: url });
  beforeAll(() => client.connect());
  afterAll(() => client.end());

  it('sends the 24h and the 1h reminder once each', async () => {
    const now = new Date('2030-01-10T12:00:00Z');
    const u = (await client.query<{ id: string }>('INSERT INTO users (email) VALUES ($1) RETURNING id', [`${randomUUID()}@t.test`])).rows[0]!.id;
    await client.query("INSERT INTO profiles (user_id, locale, timezone) VALUES ($1, 'pt-BR', 'America/Sao_Paulo')", [u]);
    const mk = async (hoursAhead: number) => {
      const start = new Date(now.getTime() + hoursAhead * 3_600_000);
      const e = (await client.query<{ id: string }>(
        `INSERT INTO events (universe_id, slug, title, description, starts_at, ends_at)
         SELECT id, $1, '{"pt-BR":"Evento","en":"Event"}', '{"pt-BR":"d","en":"d"}', $2, $3 FROM universes WHERE slug = 'dc' RETURNING id`,
        [`ev-${randomUUID().slice(0, 8)}`, start, new Date(start.getTime() + 3_600_000)],
      )).rows[0]!.id;
      await client.query('INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)', [e, u]);
      return e;
    };
    await mk(20); // inside 24h window
    await mk(0.5); // inside 1h window
    await mk(48); // too far
    const first = await collectEventReminders(client, 'https://fandom.test', now);
    expect(first.map((e) => e.details?.startsIn).sort()).toEqual(['1h', '24h']);
    expect(first[0]!.link).toMatch(/^https:\/\/fandom\.test\/universes\/dc\/events\//);
    expect(await collectEventReminders(client, 'https://fandom.test', now)).toHaveLength(0);
    // 19 hours later the first event enters the 1h window: one more reminder.
    const later = await collectEventReminders(client, 'https://fandom.test', new Date(now.getTime() + 19.5 * 3_600_000));
    expect(later.map((e) => e.details?.startsIn)).toEqual(['1h']);
  });
});
