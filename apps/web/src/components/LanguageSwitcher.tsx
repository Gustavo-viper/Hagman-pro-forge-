import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SUPPORTED_LOCALES, type Locale } from '@fandom/shared';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';

/** Changes the UI language immediately and persists it to the profile when signed in. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const persist = useMutation({
    mutationFn: (locale: Locale) => api('/v1/me/preferences', { method: 'PATCH', body: { locale } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me }),
  });

  return (
    <label className={className}>
      <span className="sr-only">{t('common.language')}</span>
      <span className="relative inline-flex items-center">
        <Globe className="pointer-events-none absolute left-2.5 size-4 text-mist/60" />
        <select
          value={i18n.language}
          onChange={(e) => {
            const locale = e.target.value as Locale;
            void i18n.changeLanguage(locale);
            if (session) persist.mutate(locale);
          }}
          className="h-9 cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs font-medium text-mist outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-mystic-400 [&>option]:bg-night"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === 'pt-BR' ? 'PT-BR' : 'EN'}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
