import { onboardingSchema, signUpSchema } from '@fandom/schemas';
import type { SubscriptionPlanSummary } from '@fandom/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { PlanCards } from '@/components/PlanCards';
import { issueKey } from '@/hooks/useZodForm';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { localized } from '@/lib/format';
import { AuthRequestError } from '@/lib/session';
import i18n from '@/lib/i18n';
import en from '@/i18n/locales/en.json';
import ptBR from '@/i18n/locales/pt-BR.json';

const plans: SubscriptionPlanSummary[] = [
  { code: 'free', name: { 'pt-BR': 'Free', en: 'Free' }, description: { 'pt-BR': 'd', en: 'd' }, benefits: { 'pt-BR': ['Criar conta'], en: ['Create account'] }, prices: [{ interval: 'month', currency: 'BRL', amountMinor: 0 }], sortOrder: 0 },
  { code: 'plus', name: { 'pt-BR': 'Fandom Plus', en: 'Fandom Plus' }, description: { 'pt-BR': 'd', en: 'd' }, benefits: { 'pt-BR': ['Selo'], en: ['Seal'] }, prices: [{ interval: 'month', currency: 'BRL', amountMinor: 1490 }, { interval: 'year', currency: 'BRL', amountMinor: 14990 }], sortOrder: 10 },
];

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR');
});

describe('i18n', () => {
  const keys = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  it('pt-BR and en have identical keys', () => {
    expect(keys(en).sort()).toEqual(keys(ptBR).sort());
  });
  it('falls back to pt-BR for localized texts', () => {
    expect(localized({ 'pt-BR': 'Olá', en: 'Hello' }, 'en')).toBe('Hello');
    expect(localized(undefined, 'en')).toBe('');
  });
});

describe('error messages', () => {
  it('translates API codes and falls back to generic', () => {
    expect(errorMessage(new ApiError(409, 'username_taken', 'x'), i18n.t)).toBe('Este nome de usuário já está em uso.');
    expect(errorMessage(new ApiError(500, 'unknown_code', 'x'), i18n.t)).toBe('Algo deu errado. Tente novamente.');
    expect(errorMessage(new AuthRequestError(401, 'invalid_credentials'), i18n.t)).toBe('E-mail ou senha incorretos.');
  });
});

describe('form validation keys', () => {
  it('maps shared schema issues to translated keys', () => {
    const r = signUpSchema.safeParse({ email: 'bad', password: 'abcdefgh', confirmPassword: 'x' });
    expect(r.success).toBe(false);
    const ks = r.error!.issues.map(issueKey);
    expect(ks).toContain('invalid_email');
    expect(ks).toContain('password_weak');
    for (const k of ks) expect(i18n.exists(`validation.${k}`)).toBe(true);
  });
  it('maps literal(true) to must_accept', () => {
    const r = onboardingSchema.safeParse({ acceptTerms: false });
    const issue = r.error!.issues.find((i) => i.path[0] === 'acceptTerms')!;
    expect(issueKey(issue)).toBe('must_accept');
  });
});

describe('PlanCards', () => {
  it('shows real prices, toggles billing interval and never renders a dead checkout button', () => {
    wrap(<PlanCards plans={plans} />);
    expect(screen.getByText(/R\$\s14,90/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }));
    expect(screen.getByText(/R\$\s149,90/)).toBeInTheDocument();
    expect(screen.getByText(/economize 16%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Começar grátis' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('Assinaturas em breve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assinar/i })).toBeNull();
  });
});
