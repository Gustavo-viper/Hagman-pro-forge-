import { HttpStatus, Injectable } from '@nestjs/common';
import { IDENTITY_SCOPED_CATEGORIES } from '@fandom/shared';
import type { CreateReplyInput, CreateTopicInput, ForumListInput, ReportInput } from '@fandom/schemas';
import type { CursorPage, ForumAuthor, ForumReply, ForumTopicDetail, ForumTopicSummary } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DatabaseService } from '../database/database.service.js';
import { SectionsService } from './sections.service.js';

interface TopicRow {
  id: string; universe_id: string; universe_slug: string; category: string; identity_scope: string | null; author_id: string;
  title: string; body: string; status: string; reply_count: number; last_activity_at: Date; created_at: Date;
  username: string | null; display_name: string | null; author_identity: string | null;
}

const TOPIC_SELECT = `
  SELECT t.id, t.universe_id, u.slug AS universe_slug, t.category, t.identity_scope, t.author_id, t.title, t.body, t.status,
         t.reply_count, t.last_activity_at, t.created_at, p.username, p.display_name, up.identity->>'key' AS author_identity
    FROM forum_topics t
    JOIN universes u ON u.id = t.universe_id
    JOIN profiles p ON p.user_id = t.author_id
    LEFT JOIN universe_profiles up ON up.universe_id = t.universe_id AND up.user_id = t.author_id`;

const author = (id: string, r: { username: string | null; display_name: string | null; author_identity: string | null }): ForumAuthor => ({
  id, username: r.username, displayName: r.display_name, identity: r.author_identity,
});

/** Max posts per author per minute (in addition to the per-IP route throttle). */
const POST_BURST = 5;

@Injectable()
export class ForumService {
  constructor(
    private readonly db: DatabaseService,
    private readonly sections: SectionsService,
  ) {}

  /** Identity-scoped categories (common rooms) are visible only to members with an identity. */
  private async scopeFor(user: AuthenticatedUser | null, universeId: string, category: string): Promise<string | null> {
    if (!IDENTITY_SCOPED_CATEGORIES.includes(category)) return null;
    if (!user) throw AppError.unauthorized('unauthorized', 'Sign in to enter the common room');
    const identity = await this.sections.assertMember(user.id, universeId);
    if (typeof identity.key !== 'string') throw AppError.forbidden('identity_required', 'Choose your identity first');
    return identity.key;
  }

  async list(user: AuthenticatedUser | null, slug: string, category: string, q: ForumListInput): Promise<CursorPage<ForumTopicSummary> & { scope: string | null }> {
    const universe = await this.sections.universeWith(slug, category, 'forum');
    const scope = await this.scopeFor(user, universe.id, category);
    const params: unknown[] = [universe.id, category, scope];
    let cursorSql = '';
    if (q.cursor) {
      const [ts, id] = Buffer.from(q.cursor, 'base64url').toString().split('|');
      if (!ts || !id || Number.isNaN(Date.parse(ts))) throw new AppError('invalid_cursor', 'Invalid cursor', HttpStatus.UNPROCESSABLE_ENTITY);
      params.push(ts, id);
      cursorSql = ' AND (t.last_activity_at, t.id) < ($4::timestamptz, $5::uuid)';
    }
    params.push(q.limit + 1);
    const { rows } = await this.db.query<TopicRow>(
      `${TOPIC_SELECT}
        WHERE t.universe_id = $1 AND t.category = $2 AND t.status = 'visible'
          AND t.identity_scope IS NOT DISTINCT FROM $3 ${cursorSql}
        ORDER BY t.last_activity_at DESC, t.id DESC LIMIT $${params.length}`,
      params,
    );
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return {
      scope,
      items: page.map((r) => ({
        id: r.id, category: r.category, title: r.title, excerpt: r.body.slice(0, 220), author: author(r.author_id, r),
        replyCount: r.reply_count, identityScope: r.identity_scope, createdAt: r.created_at.toISOString(), lastActivityAt: r.last_activity_at.toISOString(),
      })),
      nextCursor: rows.length > q.limit && last ? Buffer.from(`${last.last_activity_at.toISOString()}|${last.id}`).toString('base64url') : null,
    };
  }

  private async assertCanPost(user: AuthenticatedUser): Promise<void> {
    if (!user.emailVerified) throw AppError.forbidden('email_not_verified', 'Verify your email to post');
    const recent = await this.db.one<{ n: number }>(
      `SELECT (SELECT count(*) FROM forum_topics WHERE author_id = $1 AND created_at > now() - interval '1 minute')
            + (SELECT count(*) FROM forum_replies WHERE author_id = $1 AND created_at > now() - interval '1 minute') AS n`,
      [user.id],
    );
    if (Number(recent?.n ?? 0) >= POST_BURST) throw new AppError('posting_too_fast', 'Slow down a little', HttpStatus.TOO_MANY_REQUESTS);
  }

  async create(user: AuthenticatedUser, slug: string, category: string, input: CreateTopicInput): Promise<ForumTopicDetail> {
    const universe = await this.sections.universeWith(slug, category, 'forum');
    await this.sections.assertMember(user.id, universe.id);
    const scope = await this.scopeFor(user, universe.id, category);
    await this.assertCanPost(user);
    const { rows } = await this.db.query<{ id: string }>(
      'INSERT INTO forum_topics (universe_id, category, identity_scope, author_id, title, body) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [universe.id, category, scope, user.id, input.title, input.body],
    );
    return this.topic(user, rows[0]!.id);
  }

  private async loadTopic(id: string): Promise<TopicRow> {
    const t = await this.db.one<TopicRow>(`${TOPIC_SELECT} WHERE t.id = $1`, [id]);
    if (!t || t.status !== 'visible') throw AppError.notFound('topic_not_found', 'Topic not found');
    return t;
  }

  async topic(user: AuthenticatedUser | null, id: string): Promise<ForumTopicDetail> {
    const t = await this.loadTopic(id);
    const scope = await this.scopeFor(user, t.universe_id, t.category);
    if (t.identity_scope !== scope) throw AppError.notFound('topic_not_found', 'Topic not found');
    const { rows } = await this.db.query<{ id: string; body: string; created_at: Date; author_id: string; username: string | null; display_name: string | null; author_identity: string | null }>(
      `SELECT r.id, r.body, r.created_at, r.author_id, p.username, p.display_name, up.identity->>'key' AS author_identity
         FROM forum_replies r JOIN profiles p ON p.user_id = r.author_id
         LEFT JOIN universe_profiles up ON up.universe_id = $2 AND up.user_id = r.author_id
        WHERE r.topic_id = $1 AND r.status = 'visible' ORDER BY r.created_at, r.id LIMIT 500`,
      [id, t.universe_id],
    );
    return {
      id: t.id, universeSlug: t.universe_slug, category: t.category, title: t.title, body: t.body, author: author(t.author_id, t),
      replyCount: t.reply_count, identityScope: t.identity_scope, createdAt: t.created_at.toISOString(), lastActivityAt: t.last_activity_at.toISOString(),
      mine: user?.id === t.author_id,
      replies: rows.map((r): ForumReply => ({ id: r.id, body: r.body, author: author(r.author_id, r), createdAt: r.created_at.toISOString(), mine: user?.id === r.author_id })),
    };
  }

  async reply(user: AuthenticatedUser, topicId: string, input: CreateReplyInput): Promise<ForumTopicDetail> {
    const t = await this.loadTopic(topicId);
    await this.sections.assertMember(user.id, t.universe_id);
    const scope = await this.scopeFor(user, t.universe_id, t.category);
    if (t.identity_scope !== scope) throw AppError.notFound('topic_not_found', 'Topic not found');
    await this.assertCanPost(user);
    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO forum_replies (topic_id, author_id, body) VALUES ($1, $2, $3)', [topicId, user.id, input.body]);
      await tx.query('UPDATE forum_topics SET reply_count = reply_count + 1, last_activity_at = now() WHERE id = $1', [topicId]);
    });
    return this.topic(user, topicId);
  }

  /** Authors may delete their own content (soft delete). */
  async deleteOwn(user: AuthenticatedUser, type: 'topic' | 'reply', id: string): Promise<void> {
    if (type === 'topic') {
      const r = await this.db.query("UPDATE forum_topics SET status = 'deleted' WHERE id = $1 AND author_id = $2 AND status = 'visible'", [id, user.id]);
      if (!r.rowCount) throw AppError.notFound('topic_not_found', 'Topic not found');
      return;
    }
    await this.db.transaction(async (tx) => {
      const r = await tx.query<{ topic_id: string }>(
        "UPDATE forum_replies SET status = 'deleted' WHERE id = $1 AND author_id = $2 AND status = 'visible' RETURNING topic_id",
        [id, user.id],
      );
      if (!r.rowCount) throw AppError.notFound('reply_not_found', 'Reply not found');
      await tx.query('UPDATE forum_topics SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1', [r.rows[0]!.topic_id]);
    });
  }

  async report(user: AuthenticatedUser, input: ReportInput): Promise<void> {
    const table = input.targetType === 'topic' ? 'forum_topics' : 'forum_replies';
    const target = await this.db.one<{ author_id: string }>(`SELECT author_id FROM ${table} WHERE id = $1 AND status = 'visible'`, [input.targetId]);
    if (!target) throw AppError.notFound('content_not_found', 'Content not found');
    if (target.author_id === user.id) throw new AppError('cannot_report_own', 'You cannot report your own content', HttpStatus.UNPROCESSABLE_ENTITY);
    await this.db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING`,
      [user.id, input.targetType, input.targetId, input.reason, input.details ?? null],
    );
  }
}
