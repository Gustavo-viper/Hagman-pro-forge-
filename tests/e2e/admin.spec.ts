import { expect, test, type APIRequestContext } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

async function signUpApi(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(201);
  return (await res.json()) as { accessToken: string; user: { id: string } };
}

test('admin finds a user, grants a plan, blocks it and suspends the account', async ({ page, request }) => {
  const stamp = Date.now().toString(36);
  const adminEmail = `e2e-admin-${stamp}@example.test`;
  const fanEmail = `e2e-fan-${stamp}@example.test`;
  await signUpApi(request, adminEmail);
  const fan = await signUpApi(request, fanEmail);
  await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${fan.accessToken}` },
    data: { username: `fan_${stamp}`, displayName: `Fã ${stamp}`, birthdate: '1995-05-05', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  // Fixture: promote the first account to admin (production uses BOOTSTRAP_SUPER_ADMIN_EMAILS / grant-role).
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = $1", [adminEmail]);
  await db.end();

  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Admin' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible();
  await expect(page.getByText('Assinantes ativos')).toBeVisible();

  await page.getByPlaceholder('Buscar por e-mail, nome ou @usuário').fill(fanEmail);
  await page.getByRole('link', { name: new RegExp(`Fã ${stamp}`) }).click();
  await expect(page.getByRole('heading', { name: `Fã ${stamp}` })).toBeVisible();

  await page.getByLabel('Duração').selectOption('30');
  await page.getByLabel('Motivo (obrigatório, fica registrado)').fill('Pagou por Pix direto');
  await page.getByRole('button', { name: 'Liberar Fandom Plus por 30 dias' }).click();
  await expect(page.getByText('Feito! Alteração registrada.')).toBeVisible();
  await expect(page.getByText(/Fandom Plus válido até/)).toBeVisible();
  await expect(page.getByText('Plano liberado pelo admin')).toBeVisible();
  const me = await request.get(`${API}/v1/me`, { headers: { Authorization: `Bearer ${fan.accessToken}` } });
  expect((await me.json()).subscription.planCode).toBe('plus');

  await page.getByRole('button', { name: 'Bloquear plano' }).click();
  await page.getByPlaceholder('Motivo (obrigatório, fica registrado)').fill('Não renovou');
  await page.getByRole('button', { name: 'Bloquear plano agora' }).click();
  await expect(page.getByText(/Fandom Plus válido até/)).toBeHidden();
  const after = await request.get(`${API}/v1/me`, { headers: { Authorization: `Bearer ${fan.accessToken}` } });
  expect((await after.json()).subscription.planCode).toBe('free');

  await page.getByRole('button', { name: 'Suspender conta' }).click();
  await page.getByPlaceholder('Motivo (obrigatório, fica registrado)').fill('Teste de suspensão');
  await page.getByRole('button', { name: 'Suspender conta' }).last().click();
  await expect(page.getByRole('button', { name: 'Reativar conta' })).toBeVisible();
  const login = await request.post(`${API}/v1/auth/login`, { data: { email: fanEmail, password: PASSWORD } });
  expect(login.status()).toBe(403);
});

test('regular users cannot open the admin panel', async ({ page, request }) => {
  const email = `e2e-noadmin-${Date.now().toString(36)}@example.test`;
  await signUpApi(request, email);
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/admin');
  await expect(page.getByText('Acesso restrito à equipe da Forge Studios.')).toBeVisible();
});
