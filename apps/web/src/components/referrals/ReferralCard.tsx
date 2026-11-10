import { Badge, Button, cn, Progress, Skeleton } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Check, Clock, Copy, Gift, Send, Share2, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/states';
import { useReferrals } from '@/hooks/data';
import { formatDate } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** "Invite friends" panel: personal link, share buttons, tier progress and invited friends. */
export function ReferralCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const ref = useReferrals();
  const [copied, setCopied] = useState(false);

  if (ref.isPending) return <Skeleton className={cn('h-72 rounded-3xl', className)} />;
  if (ref.isError) return <div className={className}><ErrorState error={ref.error} onRetry={() => void ref.refetch()} /></div>;
  const r = ref.data;
  const message = t('referrals.shareMessage', { link: r.link });
  const enc = encodeURIComponent;
  const shares = [
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(message)}` },
    { key: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${enc(r.link)}&text=${enc(t('referrals.shareShort'))}` },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(message)}` },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(r.link)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link stays selectable */
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Fandom Universe', text: t('referrals.shareShort'), url: r.link });
    } catch {
      /* cancelled */
    }
  };
  const next = r.nextTier;
  const prevMin = [...r.tiers].reverse().find((tier) => r.qualified >= tier.min)?.min ?? 0;
  const progress = next ? (r.qualified - prevMin) / (next.min - prevMin) : 1;

  return (
    <section id="convites" className={cn('glass glass-sheen rounded-3xl p-6 sm:p-8', className)} aria-labelledby="referrals-title" data-testid="referral-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="referrals-title" className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide">
            <Gift className="size-6 text-gold-300" /> {t('referrals.title')}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-mist/65">{t('referrals.subtitle')}</p>
        </div>
        <div className="rounded-2xl bg-gold-400/15 px-5 py-3 text-center ring-1 ring-gold-300/30">
          <p className="font-display text-3xl font-bold text-gold-100">{r.discountPercent}%</p>
          <p className="text-xs text-gold-200/80">{t('referrals.yourDiscount')}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          readOnly
          value={r.link}
          aria-label={t('referrals.yourLink')}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-4 py-3 font-mono text-sm text-mist outline-none focus:border-[color:var(--color-mystic-400)]"
        />
        <Button onClick={() => void copy()} variant={copied ? 'glass' : 'primary'}>
          {copied ? <Check /> : <Copy />} {copied ? t('referrals.copied') : t('referrals.copy')}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {shares.map((s) => (
          <Button key={s.key} asChild size="sm" variant="glass">
            <a href={s.href} target="_blank" rel="noopener noreferrer"><Send /> {s.label}</a>
          </Button>
        ))}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <Button size="sm" variant="glass" onClick={() => void nativeShare()}><Share2 /> {t('referrals.moreApps')}</Button>
        )}
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p className="font-semibold">
            {t('referrals.qualified', { count: r.qualified })}
            {r.pending > 0 && <span className="text-mist/55"> · {t('referrals.pending', { count: r.pending })}</span>}
          </p>
          <p className="text-mist/60">
            {next ? t('referrals.next', { count: next.min - r.qualified, percent: next.percent }) : t('referrals.maxed')}
          </p>
        </div>
        <Progress value={progress} className="mt-3" label={t('referrals.progress')} />
        <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {r.tiers.map((tier) => {
            const reached = r.qualified >= tier.min;
            return (
              <motion.li
                key={tier.min}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('rounded-2xl border p-4 text-center', reached ? 'border-gold-300/50 bg-gold-400/15' : 'border-white/10 bg-white/[0.04]')}
              >
                <p className={cn('font-display text-2xl font-bold', reached ? 'text-gold-100' : 'text-mist/80')}>{tier.percent}%</p>
                <p className="mt-1 text-xs text-mist/60">{t('referrals.tierFriends', { count: tier.min })}</p>
                {reached && <Check className="mx-auto mt-2 size-4 text-gold-200" />}
              </motion.li>
            );
          })}
        </ol>
      </div>

      <p className="mt-6 text-xs text-mist/55">{t('referrals.rules')}</p>

      {r.friends.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> {t('referrals.friends')}</h3>
          <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {r.friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-mist/55">
                  {formatDate(f.joinedAt, locale)}
                  {f.status === 'qualified' && <Badge variant="success"><Check className="size-3" /> {t('referrals.status.qualified')}</Badge>}
                  {f.status === 'pending' && <Badge><Clock className="size-3" /> {t('referrals.status.pending')}</Badge>}
                  {f.status === 'revoked' && <Badge variant="danger"><XCircle className="size-3" /> {t('referrals.status.revoked')}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
