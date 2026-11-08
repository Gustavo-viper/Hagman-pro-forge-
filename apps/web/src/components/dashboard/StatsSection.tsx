import { PLAN_RANK, PREMIUM_PERKS } from '@fandom/shared';
import type { PlayerStats } from '@fandom/types';
import { Skeleton } from '@fandom/ui';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PremiumLock, useMyPlan } from '@/components/premium';
import { ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { formatNumber, localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

// Validated pair (dataviz validator, dark surface #100f17): base XP and premium bonus.
const SERIES = { base: '#3987e5', bonus: '#c98500' } as const;
const CHART_H = 160;

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Stacked daily columns: base XP with the premium bonus on top. Hover/focus shows the day. */
function XpChart({ data }: { data: PlayerStats['xpByDay'] }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...data.map((d) => d.xp + d.bonus));
  // Recessive grid: zero, half and the rounded max.
  const top = Math.ceil(max / 10) * 10;
  const day = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const w = 100 / data.length;
  const h = (v: number) => (v / top) * CHART_H;
  const hovered = hover !== null ? data[hover] : undefined;
  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-mist/70" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.base }} /> {t('stats.legend.base')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.bonus }} /> {t('stats.legend.bonus')}</span>
      </div>
      <div className="relative pl-8" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 100 ${CHART_H}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible" role="img" aria-label={t('stats.chartLabel')}>
          {[0, top / 2, top].map((v) => (
            <line key={v} x1="0" x2="100" y1={CHART_H - h(v)} y2={CHART_H - h(v)} stroke="currentColor" className={v === 0 ? 'text-white/25' : 'text-white/[0.07]'} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const x = i * w + w * 0.18;
            const bw = w * 0.64;
            const baseH = h(d.xp);
            const bonusH = h(d.bonus);
            const gap = d.xp > 0 && d.bonus > 0 ? 2 : 0;
            return (
              <g key={d.day} opacity={hover === null || hover === i ? 1 : 0.45}>
                {d.xp > 0 && <rect x={x} width={bw} y={CHART_H - baseH} height={baseH} fill={SERIES.base} rx={d.bonus > 0 ? 0 : 0.8} />}
                {d.bonus > 0 && <rect x={x} width={bw} y={CHART_H - baseH - gap - bonusH} height={bonusH} fill={SERIES.bonus} rx={0.8} />}
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute left-0 top-0 flex h-40 w-6 flex-col justify-between text-right text-[10px] tabular-nums text-mist/45" aria-hidden="true">
          <span>{top}</span><span>{top / 2}</span><span>0</span>
        </div>
        {/* Hit targets: the whole column, larger than the mark (HTML layer: reliable hover and touch). */}
        <div className="absolute inset-y-0 left-8 right-0 flex" aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.day} className="h-full flex-1" data-testid="xp-day" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          ))}
        </div>
        {hovered && (
          <div
            className="glass pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{ left: `calc(2rem + (100% - 2rem) * ${Math.min(0.88, Math.max(0.12, ((hover! + 0.5) * w) / 100))})` }}
            role="status"
          >
            <p className="font-semibold text-mist">{day(hovered.day, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="mt-1 flex items-center gap-1.5 text-mist/80"><span className="size-2 rounded-sm" style={{ background: SERIES.base }} />{t('stats.legend.base')}: {formatNumber(hovered.xp, locale)}</p>
            <p className="flex items-center gap-1.5 text-mist/80"><span className="size-2 rounded-sm" style={{ background: SERIES.bonus }} />{t('stats.legend.bonus')}: {formatNumber(hovered.bonus, locale)}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between pl-8 text-[10px] text-mist/45" aria-hidden="true">
        <span>{day(data[0]!.day, { day: 'numeric', month: 'short' })}</span>
        <span>{day(data[Math.floor(data.length / 2)]!.day, { day: 'numeric', month: 'short' })}</span>
        <span>{day(data.at(-1)!.day, { day: 'numeric', month: 'short' })}</span>
      </div>
      <details className="mt-3 text-xs text-mist/60">
        <summary className="cursor-pointer select-none hover:text-mist">{t('stats.tableView')}</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead><tr className="text-mist/50"><th scope="col" className="py-1">{t('stats.day')}</th><th scope="col">{t('stats.legend.base')}</th><th scope="col">{t('stats.legend.bonus')}</th></tr></thead>
          <tbody>
            {data.filter((d) => d.xp + d.bonus > 0).map((d) => (
              <tr key={d.day} className="border-t border-white/5"><td className="py-1">{day(d.day, { day: 'numeric', month: 'short' })}</td><td>{d.xp}</td><td>{d.bonus}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-4">
      <p className="text-xs text-mist/55">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-mist/45">{hint}</p>}
    </div>
  );
}

/** Detailed statistics (Fandom Plus perk); Free users see what it includes and how to unlock it. */
export function StatsSection() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const plan = useMyPlan();
  const allowed = PLAN_RANK[plan] >= PLAN_RANK[PREMIUM_PERKS.statsPlan];
  const stats = useQuery({ queryKey: ['me', 'stats'], queryFn: ({ signal }) => api<PlayerStats>('/v1/me/stats', { signal }), enabled: allowed });
  const n = (v: number) => formatNumber(v, locale);

  return (
    <section className="mt-12" aria-labelledby="stats-title">
      <h2 id="stats-title" className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide"><BarChart3 className="size-5 text-mystic-300" /> {t('stats.title')}</h2>
      {!allowed ? (
        <div className="mt-4"><PremiumLock plan="plus" title={t('stats.lockedTitle')}>{t('stats.lockedInfo')}</PremiumLock></div>
      ) : stats.isPending ? (
        <Skeleton className="mt-4 h-72" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label={t('stats.tiles.xp', { days: stats.data.periodDays })} value={n(stats.data.totals.xpPeriod)} hint={t('stats.tiles.bonusHint', { xp: n(stats.data.totals.bonusPeriod) })} />
            <Tile label={t('stats.tiles.activeDays')} value={`${stats.data.totals.activeDays}/${stats.data.periodDays}`} />
            <Tile label={t('stats.tiles.accuracy')} value={pct(stats.data.totals.accuracy)} hint={t('stats.tiles.perfectHint', { count: stats.data.totals.perfectQuizzes })} />
            <Tile label={t('stats.tiles.games')} value={n(stats.data.totals.gamesPlayed)} hint={t('stats.tiles.missionsHint', { count: stats.data.totals.missionsCompleted })} />
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="mb-4 text-sm font-semibold text-mist/80">{t('stats.chartTitle', { days: stats.data.periodDays })}</h3>
            <XpChart data={stats.data.xpByDay} />
          </div>
          {stats.data.xpBySource.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-mist/80">{t('stats.sourcesTitle')}</h3>
              <ul className="mt-3 space-y-2">
                {stats.data.xpBySource.map((s) => (
                  <li key={s.source} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="truncate text-mist/75">{t(`stats.sources.${s.source}`, { defaultValue: s.source })}</span>
                    <span className="h-2 rounded-full bg-white/[0.05]">
                      <span className="block h-2 rounded-full" style={{ width: `${(s.xp / stats.data.xpBySource[0]!.xp) * 100}%`, background: s.source === 'premium' ? SERIES.bonus : SERIES.base }} />
                    </span>
                    <span className="text-right tabular-nums text-mist/80">{n(s.xp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stats.data.universes.length > 0 && (
            <div className="glass overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-mist/55">
                    {['universe', 'level', 'accuracy', 'quizzes', 'streak', 'speed', 'survival', 'hangman'].map((c) => (
                      <th key={c} scope="col" className="p-3 font-semibold">{t(`stats.cols.${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.data.universes.map((u) => (
                    <tr key={u.slug} className="border-b border-white/5 tabular-nums last:border-0">
                      <th scope="row" className="p-3 text-left font-medium">{localized(u.name, locale)}</th>
                      <td className="p-3">{u.level} · {n(u.xp)} XP</td>
                      <td className="p-3">{pct(u.accuracy)}</td>
                      <td className="p-3">{u.quizzesCompleted}</td>
                      <td className="p-3">{u.dailyStreak}</td>
                      <td className="p-3">{u.speedBest}</td>
                      <td className="p-3">{u.survivalBest}</td>
                      <td className="p-3">{u.hangmanWins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
