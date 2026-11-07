import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
});

test('landing renders universes and plans from the API', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Todos os seus universos');
  await expect(page.getByRole('heading', { name: 'Harry Potter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Supernatural' })).toBeVisible();
  for (const name of ['Marvel', 'DC', 'Star Wars', "Grey's Anatomy", 'Station 19', 'BTS']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.locator('#plans').scrollIntoViewIfNeeded();
  await expect(page.getByText('R$ 14,90')).toBeVisible();
  await page.getByRole('radio', { name: 'Anual' }).click();
  await expect(page.getByText('R$ 149,90')).toBeVisible();
  expect(errors).toEqual([]);
});

test('language switcher translates the UI', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByLabel('Idioma').filter({ visible: true }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('All your universes');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('universe page shows the identity system', async ({ page }) => {
  await page.goto('/universes/harry-potter');
  await expect(page.getByRole('heading', { name: 'Grifinória' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lufa-Lufa' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entre para participar' })).toBeVisible();
});

test('Star Wars page shows factions and translated features', async ({ page }) => {
  await page.goto('/universes/star-wars');
  await expect(page.getByRole('heading', { name: 'Star Wars', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Caçador de recompensas' })).toBeVisible();
  await expect(page.getByText('Atlas da galáxia', { exact: true })).toBeVisible();
});

test('unknown routes and universes render 404', async ({ page }) => {
  await page.goto('/nao-existe');
  await expect(page.getByText('404')).toBeVisible();
  await page.goto('/universes/nao-existe');
  await expect(page.getByText('404')).toBeVisible();
});

test('protected dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
});

test('auth forms validate with the shared schemas', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('E-mail').fill('not-an-email');
  await page.getByLabel('Senha', { exact: true }).fill('abcdefgh');
  await page.getByLabel('Confirmar senha').fill('different1');
  await page.getByRole('button', { name: 'Criar conta' }).last().click();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  await expect(page.getByText('Use letras e números na senha.')).toBeVisible();
});
