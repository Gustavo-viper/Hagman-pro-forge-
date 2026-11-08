import type { MeResponse } from '@fandom/types';
import { Alert, Button, cn } from '@fandom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Inbox, MailCheck, MousePointerClick, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** Validity of the confirmation link (EMAIL_VERIFICATION_TTL_HOURS default on the API). */
export const VERIFICATION_LINK_HOURS = 48;
const RESEND_COOLDOWN_S = 60;

/** Webmail shortcut for well-known providers (search for our messages where possible). */
export function inboxFor(email: string): { name: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (['gmail.com', 'googlemail.com'].includes(domain)) return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#search/%22Fandom+Universe%22' };
  if (/^(outlook|hotmail|live|msn)\.(com|com\.br)$/.test(domain)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' };
  if (/^yahoo\.(com|com\.br)$/.test(domain)) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  if (['uol.com.br', 'bol.com.br'].includes(domain)) return { name: 'UOL Mail', url: 'https://email.uol.com.br/' };
  return null;
}

/**
 * Step-by-step help to confirm the email address: where to look, what to click, what to do
 * when the message does not arrive. Detects the confirmation on its own (polling /v1/me).
 */
export function EmailVerificationGuide({ email, onVerified, className }: { email: string; onVerified?: () => void; className?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [cooldown, setCooldown] = useState(0);
  const me = useQuery({
    queryKey: ['me', 'verification-check'],
    queryFn: ({ signal }) => api<MeResponse>('/v1/me', { signal }),
    refetchInterval: (q) => (q.state.data?.profile.emailVerified ? false : 5_000),
    refetchIntervalInBackground: false,
  });
  const verified = me.data?.profile.emailVerified ?? false;
  useEffect(() => {
    if (!verified) return;
    void qc.invalidateQueries({ queryKey: ['me'] });
    onVerified?.();
  }, [verified, qc, onVerified]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  const resend = useMutation({
    mutationFn: () => api<void>('/v1/auth/email-verification', { method: 'POST' }),
    onSuccess: () => setCooldown(RESEND_COOLDOWN_S),
  });
  const inbox = inboxFor(email);

  if (verified) {
    return (
      <Alert variant="success" className={className}>
        <CheckCircle2 className="size-5 shrink-0" />
        <span>{t('verify.done')}</span>
      </Alert>
    );
  }

  const steps = [
    { icon: Inbox, title: t('verify.steps.open.title'), text: t('verify.steps.open.text', { email }) },
    { icon: MousePointerClick, title: t('verify.steps.click.title'), text: t('verify.steps.click.text', { hours: VERIFICATION_LINK_HOURS }) },
    { icon: MailCheck, title: t('verify.steps.back.title'), text: t('verify.steps.back.text') },
  ];
  return (
    <section className={cn('glass rounded-3xl p-6', className)} aria-labelledby="verify-guide-title">
      <h2 id="verify-guide-title" className="font-display text-xl font-bold">{t('verify.title')}</h2>
      <p className="mt-1 text-sm text-mist/65">{t('verify.subtitle', { email })}</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-mystic-500/25 text-xs font-bold text-mystic-100">{i + 1}</span>
              <s.icon className="size-4 text-mystic-200" aria-hidden="true" />
              <p className="font-semibold">{s.title}</p>
            </div>
            <p className="mt-2 text-sm text-mist/70">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {inbox && (
          <Button asChild variant="primary">
            <a href={inbox.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> {t('verify.openInbox', { name: inbox.name })}</a>
          </Button>
        )}
        <Button variant="glass" loading={resend.isPending} disabled={cooldown > 0} onClick={() => resend.mutate()}>
          <RefreshCw /> {cooldown > 0 ? t('verify.resendIn', { seconds: cooldown }) : t('verify.resend')}
        </Button>
        <span className="text-xs text-mist/50" aria-live="polite">{resend.isSuccess ? t('verify.resent') : t('verify.autoCheck')}</span>
      </div>
      {resend.isError && <p role="alert" className="mt-2 text-sm text-red-300">{errorMessage(resend.error, t)}</p>}
      <details className="mt-5 rounded-2xl border border-white/10 p-4">
        <summary className="flex cursor-pointer select-none items-center gap-2 font-semibold"><Search className="size-4" /> {t('verify.notFound.title')}</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-mist/70">
          {(['spam', 'tabs', 'search', 'wait', 'latest', 'typo'] as const).map((k) => <li key={k}>{t(`verify.notFound.${k}`, { email })}</li>)}
        </ul>
      </details>
    </section>
  );
}
