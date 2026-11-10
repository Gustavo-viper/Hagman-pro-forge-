import { expect, test } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

test('subscribe to Fandom Plus through the checkout and manage the subscription', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  const email = `e2e-pay-${Date.now().toString(36)}@example.test`;
  await page.goto('/register');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).last().click();
  // Sign-up lands on the email confirmation guide, then continues to the dashboard.
  await expect(page).toHaveURL(/\/confirm-email\?welcome=1$/);
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail em 3 passos' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar e completar meu perfil' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Fixture: mark the email verified (no SMTP in E2E) and complete onboarding through the API.
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  await db.end();
  // The API caches the user for 60s; signing in again refreshes it (as a real user would).
  expect((await request.post(`${API}/v1/auth/login`, { data: { email, password: PASSWORD } })).status()).toBe(200);
  const session = JSON.parse((await page.evaluate(() => localStorage.getItem('fandom.session')))!);
  const onboard = await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      username: `pay_${Date.now().toString(36)}`, displayName: 'Assinante E2E', birthdate: '1990-01-01', country: 'BR',
      locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true,
    },
  });
  expect(onboard.status()).toBe(201);

  await page.goto('/premium');
  await expect(page.getByRole('heading', { name: 'Desbloqueie o seu lado Premium' })).toBeVisible();
  const plus = page.locator('div.glass', { has: page.getByRole('heading', { name: 'Fandom Plus' }) });
  await plus.getByRole('button', { name: 'Assinar agora' }).click();

  // Back from the (fake) payment page: the API verifies with payment_check before activating.
  await expect(page).toHaveURL(/\/account\/subscription/);
  await expect(page.getByText('Pagamento confirmado! Seus benefícios já estão liberados.')).toBeVisible();
  await expect(page.getByText('Fandom Plus', { exact: true })).toBeVisible();
  await expect(page.getByText('Válido até')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Pago' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /R\$\s29,90 · Pix/ })).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click();
  await expect(page.getByText('Termina em')).toBeVisible();
  await page.getByRole('button', { name: 'Reativar assinatura' }).click();
  await expect(page.getByText('Válido até')).toBeVisible();

  await page.goto('/premium');
  await expect(page.getByText('Você já é Fandom Plus.')).toBeVisible();
  const ultra = page.locator('div.glass', { has: page.getByRole('heading', { name: 'Fandom Ultra' }) });
  await expect(ultra.getByText('Você poderá trocar de plano quando o período atual terminar.')).toBeVisible();
});
