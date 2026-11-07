import type { ForumTopicDetail } from '@fandom/types';
import { Button, Card, Select, Skeleton } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AuthorLine } from '@/components/universe/CommunityTab';
import { ErrorState } from '@/components/states';
import { universeStyle } from '@/components/UniverseCard';
import { useUniverse } from '@/hooks/data';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'personal_data', 'spoiler', 'other'] as const;

function ReportButton({ type, id }: { type: 'topic' | 'reply'; id: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('spam');
  const report = useMutation({ mutationFn: () => api('/v1/reports', { method: 'POST', body: { targetType: type, targetId: id, reason } }) });
  if (report.isSuccess) return <span className="text-xs text-emerald-300">{t('sections.reported')}</span>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-mist/45 hover:text-red-300"><Flag className="size-3" /> {t('sections.report')}</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Select aria-label={t('sections.report')} className="h-8 w-44 text-xs" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
        {REASONS.map((r) => <option key={r} value={r}>{t(`sections.reasons.${r}`)}</option>)}
      </Select>
      <Button size="sm" variant="danger" loading={report.isPending} onClick={() => report.mutate()}>{t('sections.send')}</Button>
      <button type="button" className="text-xs text-mist/50" onClick={() => setOpen(false)}>{t('admin.cancel')}</button>
      {report.isError && <span className="text-xs text-red-300">{errorMessage(report.error, t)}</span>}
    </span>
  );
}

export default function TopicPage() {
  const { slug = '', topicId = '' } = useParams();
  const { t } = useTranslation();
  const locale = currentLocale();
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const universe = useUniverse(slug);
  const key = ['forum', 'topic', topicId, session?.user.id ?? 'anon'];
  const topic = useQuery({ queryKey: key, queryFn: ({ signal }) => api<ForumTopicDetail>(`/v1/forum/topics/${topicId}`, { signal }) });
  const [body, setBody] = useState('');
  const reply = useMutation({
    mutationFn: () => api<ForumTopicDetail>(`/v1/forum/topics/${topicId}/replies`, { method: 'POST', body: { body: body.trim() } }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setBody('');
      void qc.invalidateQueries({ queryKey: ['universes', slug, 'forum'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const remove = useMutation({
    mutationFn: ({ type, id }: { type: 'topic' | 'reply'; id: string }) => api(`/v1/forum/${type === 'topic' ? 'topics' : 'replies'}/${id}`, { method: 'DELETE' }),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['universes', slug, 'forum'] });
      if (v.type === 'topic') void navigate(`/universes/${slug}?tab=community`, { replace: true });
      else void topic.refetch();
    },
  });

  if (topic.isPending || universe.isPending) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (topic.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={topic.error} /></div>;
  if (universe.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={universe.error} /></div>;
  const d = topic.data;
  const u = universe.data;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) reply.mutate();
  };

  return (
    <div style={universeStyle(u.theme)} className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to={`/universes/${slug}?tab=community&section=${d.category}`} className="inline-flex items-center gap-2 text-sm text-mist/60 hover:text-mist">
        <ArrowLeft className="size-4" /> {localized(u.name, locale)} · {t(`universe.featureNames.${d.category}`)}
      </Link>
      <Card className="mt-6 rounded-3xl p-6">
        <h1 className="font-display text-2xl font-bold">{d.title}</h1>
        <div className="mt-2"><AuthorLine author={d.author} at={d.createdAt} universe={u} /></div>
        {/* Plain text rendered by React (escaped): no HTML from users is ever interpreted. */}
        <p className="mt-5 whitespace-pre-wrap break-words leading-relaxed text-mist/85">{d.body}</p>
        <div className="mt-5 flex items-center gap-4">
          {session && !d.mine && <ReportButton type="topic" id={d.id} />}
          {d.mine && (
            <button type="button" onClick={() => { if (window.confirm(t('sections.deleteConfirm'))) remove.mutate({ type: 'topic', id: d.id }); }} className="inline-flex items-center gap-1 text-xs text-mist/45 hover:text-red-300">
              <Trash2 className="size-3" /> {t('sections.delete')}
            </button>
          )}
        </div>
      </Card>

      <h2 className="mt-8 font-display text-lg font-bold">{t('sections.replies', { count: d.replies.length })}</h2>
      <ul className="mt-4 space-y-3">
        {d.replies.map((r) => (
          <li key={r.id} className="glass rounded-2xl p-4">
            <AuthorLine author={r.author} at={r.createdAt} universe={u} />
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-mist/85">{r.body}</p>
            <div className="mt-2 flex gap-4">
              {session && !r.mine && <ReportButton type="reply" id={r.id} />}
              {r.mine && (
                <button type="button" onClick={() => remove.mutate({ type: 'reply', id: r.id })} className="inline-flex items-center gap-1 text-xs text-mist/45 hover:text-red-300">
                  <Trash2 className="size-3" /> {t('sections.delete')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {session ? (
        <form onSubmit={submit} className="glass mt-6 space-y-3 rounded-2xl p-4">
          <label htmlFor="reply-body" className="text-sm font-medium text-mist/80">{t('sections.yourReply')}</label>
          <textarea
            id="reply-body"
            value={body}
            maxLength={3000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70 focus:ring-2 focus:ring-mystic-400/25"
          />
          <Button type="submit" disabled={!body.trim()} loading={reply.isPending}>{t('sections.sendReply')}</Button>
          {reply.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(reply.error, t)}</p>}
        </form>
      ) : (
        <p className="mt-6 text-sm text-mist/55"><Link to="/login" className="underline">{t('nav.signIn')}</Link> · {t('universe.signInToJoin')}</p>
      )}
    </div>
  );
}
