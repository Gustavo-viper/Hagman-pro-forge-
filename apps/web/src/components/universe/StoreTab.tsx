import { Badge, cn } from '@fandom/ui';
import { motion } from 'framer-motion';
import { Construction, Gem, Gift, Image as ImageIcon, Package, Shirt, ShoppingBag, Sparkles, Ticket, Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UniverseDetail } from '@/hooks/data';
import { localized } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

/** Categories previewed in every universe store (the catalog is not open yet). */
const CATEGORIES = [
  { key: 'apparel', icon: Shirt },
  { key: 'mugs', icon: Coffee },
  { key: 'posters', icon: ImageIcon },
  { key: 'collectibles', icon: Gem },
  { key: 'digital', icon: Sparkles },
  { key: 'boxes', icon: Package },
  { key: 'events', icon: Ticket },
  { key: 'accessories', icon: Gift },
] as const;

export function StoreTab({ universe }: { universe: UniverseDetail }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const name = localized(universe.name, locale);
  return (
    <div data-testid="universe-store">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass glass-sheen rounded-3xl p-8 text-center sm:p-12"
      >
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[color:var(--u-primary)]/45 text-[color:var(--u-glow)] ring-1 ring-white/20">
          <ShoppingBag className="size-8" />
        </span>
        <Badge variant="gold" className="mt-5"><Construction className="size-3.5" /> {t('store.badge')}</Badge>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-wide sm:text-4xl">{t('store.title', { universe: name })}</h2>
        <p className="mx-auto mt-3 max-w-xl text-mist/70">{t('store.subtitle', { universe: name })}</p>
      </motion.section>

      <h3 className="mt-10 font-display text-xl font-bold tracking-wide">{t('store.preview')}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map(({ key, icon: Icon }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="glass glass-sheen rounded-2xl p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[color:var(--u-glow)]"><Icon className="size-5" /></span>
              <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-200 ring-1 ring-gold-300/30">{t('store.soon')}</span>
            </div>
            <p className="mt-4 font-semibold">{t(`store.categories.${key}`)}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={cn('h-full rounded-full bg-[color:var(--u-accent)]/70', ['w-1/4', 'w-2/5', 'w-1/3', 'w-1/2'][i % 4])} />
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-xs text-mist/45">{t('store.note')}</p>
    </div>
  );
}
