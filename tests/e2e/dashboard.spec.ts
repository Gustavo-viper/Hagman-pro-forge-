import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Senha123forte';

async function signUp(page: Page): Promise<string> {
  const email = `e2e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;
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
  return email;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
});

test('sign up, onboarding, XP and universe membership', async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole('heading', { name: 'Crie sua identidade de fã' })).toBeVisible();

  // Client-side validation (same Zod schema as the API).
  await page.getByRole('button', { name: /Concluir/ }).click();
  await expect(page.getByText('É necessário aceitar para continuar.').first()).toBeVisible();

  const username = `e2e_${Date.now().toString(36)}`;
  await page.getByLabel('Nome de usuário').fill(username);
  await expect(page.getByText('Disponível!')).toBeVisible();
  await page.getByLabel('Nome de exibição').fill('Caçadora E2E');
  await page.getByLabel('Data de nascimento').fill('1998-04-20');
  await page.getByLabel('País').selectOption('BR');
  await page.locator('input[name="acceptTerms"]').check();
  await page.locator('input[name="acceptPrivacy"]').check();
  await page.getByRole('button', { name: /Concluir/ }).click();

  await expect(page.getByRole('heading', { name: 'Olá, Caçadora E2E' })).toBeVisible();
  await expect(page.getByText('Nível 1 · 50 XP')).toBeVisible();
  await expect(page.getByText('Confirme seu e-mail pelo link')).toBeVisible();
  await page.getByRole('button', { name: 'Reenviar e-mail' }).click();
  await expect(page.getByText('Enviado! Confira sua caixa de entrada.')).toBeVisible();

  const discover = page.locator('section', { has: page.getByRole('heading', { name: 'Descobrir universos' }) });
  await discover.locator('article', { hasText: 'Supernatural' }).getByRole('button', { name: 'Entrar' }).click();
  const mine = page.locator('section', { has: page.getByRole('heading', { name: 'Meus universos' }) });
  await expect(mine.getByText('Membro · Nível 1')).toBeVisible();

  await page.goto('/universes/supernatural');
  await expect(page.getByText('Você é membro deste universo')).toBeVisible();
  await page.getByRole('button', { name: 'Sair do universo' }).click();
  await expect(page.getByRole('button', { name: 'Entrar neste universo' })).toBeVisible();
});

test('session survives reload, sign out ends it, sign in restores it', async ({ page }) => {
  const email = await signUp(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Crie sua identidade de fã' })).toBeVisible();

  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sair' }).filter({ visible: true }).click();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  // Wait for the page transition to finish before typing.
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeEditable();

  await page.getByLabel('E-mail').fill(email);
  await expect(page.getByLabel('E-mail')).toHaveValue(email);
  await page.getByLabel('Senha').fill('SenhaErrada1');
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();

  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('duplicate email and password reset request', async ({ page, context }) => {
  const email = await signUp(page);
  await context.clearCookies();
  await page.evaluate(() => localStorage.removeItem('fandom.session'));

  await page.goto('/register');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).last().click();
  await expect(page.getByText('Já existe uma conta com este e-mail.')).toBeVisible();

  await page.goto('/forgot-password');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Se existir uma conta com esse e-mail')).toBeVisible();

  await page.goto('/reset-password?token=invalidtoken_invalidtoken_invalid');
  await page.getByLabel('Senha', { exact: true }).fill('NovaSenha456');
  await page.getByLabel('Confirmar senha').fill('NovaSenha456');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('Este link é inválido ou expirou.')).toBeVisible();
});
