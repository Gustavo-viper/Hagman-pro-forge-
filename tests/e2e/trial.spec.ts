import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

/** Verified adult member of a universe, signed in through the UI. */
async function adult(page: Page, request: APIRequestContext, universe: string) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-trial-${stamp}@example.test`;
  const reg = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  // Verify before the first authenticated call (the API caches the user for a minute).
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  await db.end();
  const auth = { Authorization: `Bearer ${reg.accessToken}` };
  await request.post(`${API}/v1/me/onboarding`, {
    headers: auth,
    data: { username: `trial_${stamp}`, displayName: `Teste ${stamp}`, birthdate: '1991-01-01', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  await request.post(`${API}/v1/universes/${universe}/membership`, { headers: auth });
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('visitors are invited to create an account and try Plus for free', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/premium');
  await expect(page.getByText('Experimente o Fandom Plus grátis por 7 dias')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta e testar' })).toHaveAttribute('href', '/register');
});

test('a Free fan starts the 7-day trial once and unlocks statistics, survival and the VIP lounge', async ({ page, request }) => {
  await adult(page, request, 'dc');

  // Before: statistics are locked, with the free trial as the call to action.
  await expect(page.getByText('Estatísticas detalhadas são do Fandom Plus')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Testar grátis por 7 dias' })).toBeVisible();

  await page.goto('/premium');
  await page.getByRole('button', { name: 'Começar teste grátis' }).click();
  await expect(page.getByText(/Pronto! Você tem o Fandom Plus até/)).toBeVisible();
  // The plan cards now offer to subscribe (not "renew"), for Plus and Ultra alike.
  await expect(page.locator('div.glass', { has: page.getByRole('heading', { name: 'Fandom Ultra' }) }).getByRole('button', { name: 'Assinar agora' })).toBeEnabled();

  await page.goto('/account/subscription');
  await expect(page.getByText('Teste grátis', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Assinar para continuar' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reativar/ })).toHaveCount(0);

  // Perks are live: bonus badge, survival unlocked, shield on the daily card.
  await page.goto('/universes/dc?tab=quizzes');
  await expect(page.getByText('Bônus de XP ativo: +20%')).toBeVisible();
  const survival = page.locator('div.glass').filter({ has: page.getByRole('heading', { name: 'Modo Sobrevivência', exact: true }) }).last();
  await expect(survival.getByRole('link', { name: 'Jogar' })).toBeVisible();
  await expect(page.getByText('Proteção de sequência: 1 dia por semana (usada: 0)')).toBeVisible();

  // Statistics on the dashboard, with the chart's table view.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Suas estatísticas' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'XP por dia nos últimos 30 dias' })).toBeVisible();
  await expect(page.getByText('XP nos últimos 30 dias')).toBeVisible();
  await page.getByTestId('xp-day').last().hover();
  await expect(page.getByRole('status').filter({ hasText: 'XP: 50' })).toBeVisible();
  await page.getByText('Ver como tabela').click();
  await expect(page.getByRole('cell', { name: '50' }).first()).toBeVisible(); // welcome XP today

  // Only once per account: the offer disappears.
  await page.goto('/premium');
  await expect(page.getByRole('button', { name: 'Começar teste grátis' })).toHaveCount(0);
});
