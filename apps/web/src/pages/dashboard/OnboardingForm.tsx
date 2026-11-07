import { onboardingSchema, usernameSchema } from '@fandom/schemas';
import { SUPPORTED_LOCALES, type Locale } from '@fandom/shared';
import type { MeResponse } from '@fandom/types';
import { Alert, Button, Card, Checkbox, Input, Select } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FormField } from '@/components/AuthLayout';
import { useZodForm } from '@/hooks/useZodForm';
import { api, ApiError } from '@/lib/api';
import { countryOptions, timezoneOptions } from '@/lib/countries';
import { errorMessage } from '@/lib/errors';
import { currentLocale } from '@/lib/i18n';
import { queryKeys } from '@/lib/query';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function OnboardingForm() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const locale = currentLocale();
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const timezones = useMemo(timezoneOptions, []);
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { values, errors, set, handleSubmit } = useZodForm(onboardingSchema, {
    username: '',
    displayName: '',
    birthdate: '',
    country: locale === 'pt-BR' ? 'BR' : '',
    locale: locale as Locale,
    timezone: timezones.includes(detectedTz) ? detectedTz : 'America/Sao_Paulo',
    acceptTerms: false as boolean,
    acceptPrivacy: false as boolean,
    marketingEmail: false,
  });

  const debouncedUsername = useDebounced(values.username.trim().toLowerCase(), 400);
  const usernameValid = usernameSchema.safeParse(debouncedUsername).success;
  const availability = useQuery({
    queryKey: ['username-availability', debouncedUsername],
    queryFn: ({ signal }) =>
      api<{ available: boolean }>(`/v1/me/username-availability?username=${encodeURIComponent(debouncedUsername)}`, { signal }),
    enabled: usernameValid,
    staleTime: 10_000,
  });

  const submit = useMutation({
    mutationFn: (body: typeof values) => api<MeResponse>('/v1/me/onboarding', { method: 'POST', body }),
    onSuccess: (res) => {
      void i18n.changeLanguage(res.profile.locale);
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'username_taken') {
        void qc.invalidateQueries({ queryKey: ['username-availability'] });
      }
    },
  });

  const onSubmit = handleSubmit((data) => submit.mutate(data));
  const maxBirthdate = new Date().toISOString().slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">{t('onboarding.eyebrow')}</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-wide sm:text-4xl">{t('onboarding.title')}</h1>
      <p className="mt-3 text-mist/65">{t('onboarding.subtitle')}</p>
      <Card className="mt-8 rounded-3xl p-6 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
          {submit.error && <Alert variant="danger" className="sm:col-span-2">{errorMessage(submit.error, t)}</Alert>}
          <div className="sm:col-span-2">
            <FormField id="username" label={t('onboarding.username')} error={errors.username}>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-mist/40">@</span>
                <Input
                  id="username"
                  className="pl-8"
                  autoComplete="username"
                  maxLength={24}
                  value={values.username}
                  onChange={(e) => set('username', e.target.value.toLowerCase())}
                  aria-invalid={Boolean(errors.username)}
                />
              </div>
              {usernameValid && !errors.username && (
                <p className="text-xs" aria-live="polite">
                  {availability.isFetching ? (
                    <span className="text-mist/50">{t('onboarding.checking')}</span>
                  ) : availability.data?.available ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <Check className="size-3" /> {t('onboarding.usernameAvailable')}
                    </span>
                  ) : availability.data ? (
                    <span className="inline-flex items-center gap-1 text-red-300">
                      <X className="size-3" /> {t('onboarding.usernameTaken')}
                    </span>
                  ) : null}
                </p>
              )}
            </FormField>
          </div>
          <FormField id="displayName" label={t('onboarding.displayName')} error={errors.displayName}>
            <Input id="displayName" maxLength={50} value={values.displayName} onChange={(e) => set('displayName', e.target.value)} aria-invalid={Boolean(errors.displayName)} />
          </FormField>
          <FormField id="birthdate" label={t('onboarding.birthdate')} error={errors.birthdate} hint={t('onboarding.birthdateHint')}>
            <Input id="birthdate" type="date" max={maxBirthdate} min="1900-01-02" value={values.birthdate} onChange={(e) => set('birthdate', e.target.value)} aria-invalid={Boolean(errors.birthdate)} />
          </FormField>
          <FormField id="country" label={t('onboarding.country')} error={errors.country}>
            <Select id="country" value={values.country} onChange={(e) => set('country', e.target.value)} aria-invalid={Boolean(errors.country)}>
              <option value="">{t('onboarding.selectCountry')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField id="locale" label={t('onboarding.locale')} error={errors.locale}>
            <Select id="locale" value={values.locale} onChange={(e) => set('locale', e.target.value as Locale)}>
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l}>{t(`common.languages.${l}`)}</option>
              ))}
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="timezone" label={t('onboarding.timezone')} error={errors.timezone}>
              <Select id="timezone" value={values.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <label className="flex gap-3 text-sm text-mist/80">
              <Checkbox name="acceptTerms" checked={values.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} aria-invalid={Boolean(errors.acceptTerms)} />
              <span>
                {t('onboarding.acceptTermsPrefix')}{' '}
                <Link to="/legal/terms" target="_blank" className="text-mystic-300 underline">{t('onboarding.terms')}</Link>
              </span>
            </label>
            {errors.acceptTerms && <p role="alert" className="pl-7 text-xs text-red-300">{t('validation.must_accept')}</p>}
            <label className="flex gap-3 text-sm text-mist/80">
              <Checkbox name="acceptPrivacy" checked={values.acceptPrivacy} onChange={(e) => set('acceptPrivacy', e.target.checked)} aria-invalid={Boolean(errors.acceptPrivacy)} />
              <span>
                {t('onboarding.acceptPrivacyPrefix')}{' '}
                <Link to="/legal/privacy" target="_blank" className="text-mystic-300 underline">{t('onboarding.privacy')}</Link>
              </span>
            </label>
            {errors.acceptPrivacy && <p role="alert" className="pl-7 text-xs text-red-300">{t('validation.must_accept')}</p>}
            <label className="flex gap-3 text-sm text-mist/65">
              <Checkbox name="marketingEmail" checked={values.marketingEmail} onChange={(e) => set('marketingEmail', e.target.checked)} />
              <span>{t('onboarding.marketing')}</span>
            </label>
          </div>
          <p className="flex items-start gap-2 text-xs text-mist/50 sm:col-span-2">
            <ShieldCheck className="size-4 shrink-0 text-mystic-300" /> {t('onboarding.minorNotice')}
          </p>
          <Button type="submit" size="lg" className="sm:col-span-2" loading={submit.isPending}>
            {t('onboarding.submit')}
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
