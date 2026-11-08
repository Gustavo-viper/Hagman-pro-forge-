import type { CursorPage, ForumTopicDetail, ForumTopicSummary } from '@fandom/types';
import { Alert, Button, Input, Label, Skeleton } from '@fandom/ui';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Lock, MessageSquare, PenLine } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState } from '@/components/states';
import type { UniverseDetail } from '@/hooks/data';
import { api, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { featuresOf, SectionChips } from './SectionTabs';
import { PlanName, PremiumLock } from '@/components/premium';
import { PREMIUM_CATEGORIES } from '@fandom/shared';

export function AuthorLine({ author, at, universe }: { author: ForumTopicSummary['author']; at: string; universe: UniverseDetail }) {
  const locale = currentLocale();
  const identity = author.identity ? universe.identityConfig.options?.find((o) => o.key === author.identity) : undefined;
  return (
    <p className="text-xs text-mist/55">
      <PlanName name={author.displayName ?? author.username ?? '—'} plan={author.plan} className="font-semibold text-mist/80" />
      {author.username && ` @${author.username}`}
      {identity && <span style={{ color: identity.color }}> · {identity.name[locale] ?? identity.key}</span>}
      {' · '}{formatDate(at, locale)}
    </p>
  );
}

function NewTopicForm({ universe, category, onDone }: { universe: UniverseDetail; category: string; onDone: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: () => api<ForumTopicDetail>(`/v1/universes/${universe.slug}/forum/${category}`, { method: 'POST', body: { title: title.trim(), body: body.trim() } }),
    onSuccess: (topic) => {
      void qc.invalidateQueries({ queryKey: ['universes', universe.slug, 'forum', category] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      onDone();
      void navigate(`/universes/${universe.slug}/forum/${topic.id}`);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length >= 3 && body.trim()) create.mutate();
  };
  return (
    <form onSubmit={submit} className="glass mb-6 space-y-4 rounded-2xl p-5">
      <div className="space-y-1.5">
        <Label htmlFor="topic-title">{t('sections.topicTitle')}</Label>
        <Input id="topic-title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="topic-body">{t('sections.topicBody')}</Label>
        <textarea
          id="topic-body"
          value={body}
          maxLength={5000}
          rows={6}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mist outline-none focus:border-mystic-400/70 focus:ring-2 focus:ring-mystic-400/25"
        />
      </div>
      <p className="text-xs text-mist/45">{t('sections.rules')}</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={title.trim().length < 3 || !body.trim()} loading={create.isPending}>{t('sections.publish')}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t('admin.cancel')}</Button>
      </div>
      {create.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(create.error, t)}</p>}
    </form>
  );
}

export function CommunityTab({ universe, category, onCategory, isMember }: { universe: UniverseDetail; category: string; onCategory: (c: string) => void; isMember: boolean }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const keys = featuresOf(universe, 'forum');
  const current = keys.includes(category) ? category : keys[0]!;
  const [writing, setWriting] = useState(false);
  const topics = useInfiniteQuery({
    queryKey: ['universes', universe.slug, 'forum', current, session?.user.id ?? 'anon'],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<ForumTopicSummary> & { scope: string | null }>(
        `/v1/universes/${universe.slug}/forum/${current}?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = topics.data?.pages.flatMap((p) => p.items) ?? [];
  const scope = topics.data?.pages[0]?.scope ?? null;
  const scopeName = scope ? universe.identityConfig.options?.find((o) => o.key === scope)?.name[currentLocale()] ?? scope : null;
  const locked = topics.error instanceof ApiError && ['unauthorized', 'identity_required', 'membership_required', 'premium_required'].includes(topics.error.code);
  const premiumLocked = topics.error instanceof ApiError && topics.error.code === 'premium_required';
  const vip = PREMIUM_CATEGORIES[current];

  return (
    <div>
      <SectionChips keys={keys} value={current} onChange={(c) => { setWriting(false); onCategory(c); }} />
      {scopeName && <Alert variant="info" className="mb-4"><Lock className="size-4 shrink-0" /> {t('sections.commonRoomOf', { name: scopeName })}</Alert>}
      {vip && !locked && !topics.isPending && <Alert variant="warning" className="mb-4"><Crown className="size-4 shrink-0" /> {t('premiumPerks.vipWelcome')}</Alert>}
      {session && isMember && !locked && !writing && (
        <Button className="mb-6" onClick={() => setWriting(true)}><PenLine /> {t('sections.newTopic')}</Button>
      )}
      {writing && <NewTopicForm universe={universe} category={current} onDone={() => setWriting(false)} />}
      {topics.isPending ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : premiumLocked && vip ? (
        <PremiumLock plan={vip} title={t('premiumPerks.vipLocked')}>{t('premiumPerks.vipInfo')}</PremiumLock>
      ) : locked ? (
        <EmptyState icon={<Lock className="size-8 text-[color:var(--u-glow)]" />}>{t(`sections.locked.${(topics.error as ApiError).code}`)}</EmptyState>
      ) : topics.isError ? (
        <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<MessageSquare className="size-8 text-[color:var(--u-glow)]" />}>{t('sections.noTopics')}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((topic) => (
            <li key={topic.id}>
              <Link to={`/universes/${universe.slug}/forum/${topic.id}`} className="glass block rounded-2xl p-5 transition hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold">{topic.title}</h3>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-mist/55"><MessageSquare className="size-3.5" /> {topic.replyCount}</span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-mist/65">{topic.excerpt}</p>
                <div className="mt-3"><AuthorLine author={topic.author} at={topic.createdAt} universe={universe} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {topics.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="glass" loading={topics.isFetchingNextPage} onClick={() => void topics.fetchNextPage()}>{t('admin.loadMore')}</Button>
        </div>
      )}
      {!session && <p className="mt-6 text-sm text-mist/55">{t('universe.signInToJoin')}</p>}
    </div>
  );
}
