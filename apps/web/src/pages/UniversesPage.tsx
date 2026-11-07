import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '@/components/Layout';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/states';
import { UniverseCard } from '@/components/UniverseCard';
import { useUniverses } from '@/hooks/data';

export default function UniversesPage() {
  const { t } = useTranslation();
  const universes = useUniverses();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading title={t('universes.title')} subtitle={t('universes.subtitle')} />
      <div className="mt-12">
        {universes.isPending ? (
          <CardGridSkeleton className="h-80" />
        ) : universes.isError ? (
          <ErrorState error={universes.error} title={t('landing.universes.error')} onRetry={() => void universes.refetch()} />
        ) : universes.data.length === 0 ? (
          <EmptyState>{t('landing.universes.empty')}</EmptyState>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {universes.data.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <UniverseCard universe={u} className="h-full" />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
