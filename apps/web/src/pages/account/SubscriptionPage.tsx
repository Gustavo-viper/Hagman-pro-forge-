import type { ConfirmPaymentResponse, PaymentSummary } from '@fandom/types';
import { Alert, Badge, Button, Card, Skeleton, Spinner } from '@fandom/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Crown, ExternalLink, Receipt } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/states';
import { useSubscriptionDetails } from '@/hooks/data';
import { useCheckout } from '@/hooks/useCheckout';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';

const STATUS_VARIANT: Record<PaymentSummary['status'], 'success' | 'gold' | 'danger' | 'default'> = {
  paid: 'success',
  pending: 'gold',
  failed: 'danger',
  expired: 'default',
  refunded: 'default',
};

/** Handles the return from the InfinitePay checkout: the API verifies it with the provider. */
function CheckoutReturn() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const orderNsu = params.get('order_nsu');
  const transactionNsu = params.get('transaction_nsu');
  const slug = params.get('slug');
  const started = useRef(false);
  const confirm = useMutation({
    mutationFn: () => api<ConfirmPaymentResponse>('/v1/billing/confirm', { method: 'POST', body: { orderNsu, transactionNsu, slug } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });

  useEffect(() => {
    if (!orderNsu || !transactionNsu || !slug || started.current) return;
    started.current = true;
    confirm.mutate();
  }, [orderNsu, transactionNsu, slug, confirm]);

  if (!orderNsu) return null;
  if (confirm.isPending || confirm.isIdle) {
    return (
      <Alert variant="info" className="mb-6 items-center">
        <Spinner className="size-5" /> {t('subscription.confirming')}
      </Alert>
    );
  }
  if (confirm.isError) return <div className="mb-6"><ErrorState error={confirm.error} /></div>;
  const paid = confirm.data.status === 'paid';
  return (
    <Alert variant={paid ? 'success' : 'warning'} className="mb-6 items-center">
      {paid ? <CheckCircle2 className="size-5 shrink-0" /> : <Clock className="size-5 shrink-0" />}
      <span className="flex-1">{paid ? t('subscription.paid') : t('subscription.pendingPayment')}</span>
      <Button size="sm" variant="ghost" onClick={() => setParams({}, { replace: true })}>OK</Button>
    </Alert>
  );
}

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const details = useSubscriptionDetails();
  const checkout = useCheckout();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['me'] });
  const cancel = useMutation({ mutationFn: () => api('/v1/billing/subscription/cancel', { method: 'POST' }), onSuccess: refresh });
  const reactivate = useMutation({ mutationFn: () => api('/v1/billing/subscription/reactivate', { method: 'POST' }), onSuccess: refresh });
  const actionError = cancel.error ?? reactivate.error ?? checkout.error;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-wide">{t('subscription.title')}</h1>
      <p className="mt-2 text-mist/60">{t('subscription.subtitle')}</p>
      <div className="mt-8">
        <CheckoutReturn />
        {details.isPending ? (
          <div className="space-y-6"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
        ) : details.isError ? (
          <ErrorState error={details.error} onRetry={() => void details.refetch()} />
        ) : (
          (() => {
            const d = details.data;
            const s = d.subscription;
            const isPaid = s.planCode !== 'free';
            return (
              <>
                <Card className="relative overflow-hidden rounded-3xl p-6">
                  <div className="absolute -right-20 -top-20 size-60 rounded-full bg-gold-400/10 blur-3xl" aria-hidden="true" />
                  <div className="relative flex flex-wrap items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <span className="grid size-14 place-items-center rounded-2xl bg-gold-400/15 text-gold-300"><Crown className="size-7" /></span>
                      <div>
                        <p className="font-display text-2xl font-bold">{t(`dashboard.planNames.${s.planCode}`)}</p>
                        <p className="text-sm text-mist/60">
                          {t(`dashboard.statuses.${s.status}`)}
                          {s.interval && ` · ${s.interval === 'month' ? t('landing.plans.monthly') : t('landing.plans.yearly')}`}
                          {d.currentPrice && isPaid && ` · ${money(d.currentPrice.amountMinor, d.currentPrice.currency, locale)}`}
                        </p>
                      </div>
                    </div>
                    {isPaid && s.currentPeriodEnd && (
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-widest text-mist/50">{s.cancelAtPeriodEnd ? t('subscription.endsOn') : t('subscription.validUntil')}</p>
                        <p className="font-display text-xl font-bold">{formatDate(s.currentPeriodEnd, locale)}</p>
                      </div>
                    )}
                  </div>
                  <p className="relative mt-5 text-sm text-mist/60">{isPaid ? (s.cancelAtPeriodEnd ? t('subscription.cancelledNote') : t('subscription.prepaidNote')) : t('subscription.freeNote')}</p>
                  <div className="relative mt-6 flex flex-wrap gap-3">
                    {isPaid && d.renewablePlan && s.interval && !s.cancelAtPeriodEnd && (
                      <Button loading={checkout.isPending || checkout.isSuccess} disabled={!d.canCheckout} onClick={() => checkout.mutate({ planCode: d.renewablePlan as 'plus' | 'ultra', interval: s.interval! })}>
                        {t('premium.renew')}
                      </Button>
                    )}
                    {!isPaid && <Button asChild><Link to="/premium">{t('dashboard.seePlans')}</Link></Button>}
                    {isPaid && !s.cancelAtPeriodEnd && (s.status === 'active' || s.status === 'past_due') && (
                      <Button variant="ghost" loading={cancel.isPending} onClick={() => { if (window.confirm(t('subscription.cancelConfirm'))) cancel.mutate(); }}>
                        {t('subscription.cancel')}
                      </Button>
                    )}
                    {isPaid && s.status === 'cancelled' && (
                      <Button variant="glass" loading={reactivate.isPending} onClick={() => reactivate.mutate()}>{t('subscription.reactivate')}</Button>
                    )}
                    {isPaid && <Button asChild variant="ghost"><Link to="/premium">{t('subscription.seeAllPlans')}</Link></Button>}
                  </div>
                  {actionError && <p role="alert" className="relative mt-3 text-sm text-red-300">{errorMessage(actionError, t)}</p>}
                </Card>

                <section className="mt-10">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-wide"><Receipt className="size-5" /> {t('subscription.history')}</h2>
                  <div className="mt-4">
                    {d.payments.length === 0 ? (
                      <EmptyState>{t('subscription.noPayments')}</EmptyState>
                    ) : (
                      <div className="glass overflow-x-auto rounded-2xl">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wider text-mist/50">
                            <tr>
                              <th className="px-4 py-3 font-medium">{t('subscription.date')}</th>
                              <th className="px-4 py-3 font-medium">{t('dashboard.plan')}</th>
                              <th className="px-4 py-3 font-medium">{t('subscription.amount')}</th>
                              <th className="px-4 py-3 font-medium">{t('subscription.status')}</th>
                              <th className="px-4 py-3 font-medium" />
                            </tr>
                          </thead>
                          <tbody>
                            {d.payments.map((p) => (
                              <tr key={p.id} className="border-t border-white/5">
                                <td className="px-4 py-3">{formatDate(p.paidAt ?? p.createdAt, locale)}</td>
                                <td className="px-4 py-3">
                                  {t(`dashboard.planNames.${p.planCode}`)} · {p.interval === 'month' ? t('landing.plans.monthly') : t('landing.plans.yearly')}
                                </td>
                                <td className="px-4 py-3">
                                  {money(p.paidAmountMinor ?? p.amountMinor, p.currency, locale)}
                                  {p.installments && p.installments > 1 ? ` (${p.installments}x)` : ''}
                                  {p.captureMethod ? ` · ${p.captureMethod === 'pix' ? 'Pix' : t('subscription.card')}` : ''}
                                </td>
                                <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[p.status]}>{t(`subscription.paymentStatus.${p.status}`)}</Badge></td>
                                <td className="px-4 py-3 text-right">
                                  {p.receiptUrl && (
                                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-mystic-300 hover:underline">
                                      {t('subscription.receipt')} <ExternalLink className="size-3" />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
