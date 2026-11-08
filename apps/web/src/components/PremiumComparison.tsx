import { premiumBonus, PREMIUM_PERKS, type PlanCode } from '@fandom/shared';
import { cn } from '@fandom/ui';
import { Check, Crown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanBadge } from './premium';

const PLANS: PlanCode[] = ['free', 'plus', 'ultra'];
const yes = <Check className="mx-auto size-4 text-emerald-300" aria-hidden="true" />;
const no = <Minus className="mx-auto size-4 text-mist/30" aria-hidden="true" />;

/** Free vs Plus vs Ultra, generated from the same limits the server enforces. */
export function PremiumComparison() {
  const { t } = useTranslation();
  const P = PREMIUM_PERKS;
  const rows: { key: string; cells: Record<PlanCode, ReactNode>; sr?: Record<PlanCode, string> }[] = [
    { key: 'universes', cells: { free: yes, plus: yes, ultra: yes } },
    { key: 'xpBonus', cells: { free: no, plus: `+${P.xpBonusPercent.plus}%`, ultra: `+${P.xpBonusPercent.ultra}%` } },
    { key: 'speed', cells: { free: `${P.speedDailyXpCap.free} XP`, plus: `${P.speedDailyXpCap.plus} XP`, ultra: `${P.speedDailyXpCap.ultra} XP` } },
    { key: 'hangman', cells: { free: P.hangmanRewardedWins.free, plus: P.hangmanRewardedWins.plus, ultra: P.hangmanRewardedWins.ultra } },
    { key: 'survival', cells: { free: no, plus: `${P.survivalDailyXpCap.plus} XP`, ultra: `${P.survivalDailyXpCap.ultra} XP` } },
    { key: 'vip', cells: { free: no, plus: yes, ultra: yes } },
    { key: 'stats', cells: { free: no, plus: yes, ultra: yes } },
    { key: 'shields', cells: { free: no, plus: t('premiumPerks.table.perWeek', { count: P.streakShieldsPerWeek.plus }), ultra: t('premiumPerks.table.perWeek', { count: P.streakShieldsPerWeek.ultra }) } },
    { key: 'missions', cells: { free: no, plus: t('premiumPerks.table.plusMissions'), ultra: t('premiumPerks.table.allMissions') } },
    { key: 'events', cells: { free: t('premiumPerks.table.freeEvents'), plus: t('premiumPerks.table.plusEvents'), ultra: t('premiumPerks.table.allEvents') } },
    { key: 'badge', cells: { free: no, plus: <PlanBadge plan="plus" />, ultra: <PlanBadge plan="ultra" /> } },
  ];
  const quiz = 60;
  return (
    <section className="mx-auto mt-20 max-w-4xl" aria-labelledby="compare-title">
      <h2 id="compare-title" className="text-center font-display text-2xl font-bold tracking-wide">{t('premiumPerks.table.title')}</h2>
      <p className="mt-2 text-center text-sm text-mist/60">{t('premiumPerks.table.subtitle')}</p>
      <div className="glass mt-8 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th scope="col" className="p-4 font-semibold text-mist/70">{t('premiumPerks.table.perk')}</th>
              {PLANS.map((p) => (
                <th key={p} scope="col" className={cn('p-4 text-center font-display font-bold', p === 'ultra' && 'text-gold-200', p === 'plus' && 'text-arcane-200')}>
                  {p === 'ultra' && <Crown className="mr-1 inline size-4" />}{t(`dashboard.planNames.${p}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-white/5 last:border-0">
                <th scope="row" className="p-4 text-left font-medium text-mist/85">{t(`premiumPerks.table.rows.${r.key}`)}</th>
                {PLANS.map((p) => (
                  <td key={p} className={cn('p-4 text-center tabular-nums', p !== 'free' && 'font-semibold')}>{r.cells[p]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-sm text-mist/65">
        {t('premiumPerks.table.example', { base: quiz, plus: quiz + premiumBonus(quiz, 'plus'), ultra: quiz + premiumBonus(quiz, 'ultra') })}
      </p>
    </section>
  );
}
