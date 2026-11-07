import { LEGAL_VERSIONS } from '@fandom/shared';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/lib/i18n';
import { PRIVACY, TERMS } from './content';

export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const content = (doc === 'terms' ? TERMS : PRIVACY)[locale];
  const version = doc === 'terms' ? LEGAL_VERSIONS.terms_of_use : LEGAL_VERSIONS.privacy_policy;
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-wide">{content.title}</h1>
      <p className="mt-2 text-sm text-mist/50">{t('legal.version', { version })}</p>
      <p className="glass mt-6 rounded-xl p-4 text-xs text-gold-100/80">{t('legal.reviewNotice')}</p>
      <div className="mt-10 space-y-8">
        {content.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-xl font-semibold tracking-wide text-gold-200">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-mist/75">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
