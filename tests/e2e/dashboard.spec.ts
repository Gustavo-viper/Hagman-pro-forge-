import { expect, test } from '@playwright/test';
import { signIn } from './session.js';

test('new user completes onboarding, earns XP and joins a universe', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard');
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
  await expect(page.getByText('Você ainda não entrou em nenhum universo')).toBeVisible();

  const discover = page.locator('section', { has: page.getByRole('heading', { name: 'Descobrir universos' }) });
  await discover.locator('article', { hasText: 'Supernatural' }).getByRole('button', { name: 'Entrar' }).click();

  const mine = page.locator('section', { has: page.getByRole('heading', { name: 'Meus universos' }) });
  await expect(mine.getByRole('heading', { name: 'Supernatural' })).toBeVisible();
  await expect(mine.getByText('Membro · Nível 1')).toBeVisible();

  await page.goto('/universes/supernatural');
  await expect(page.getByText('Você é membro deste universo')).toBeVisible();
  await page.getByRole('button', { name: 'Sair do universo' }).click();
  await expect(page.getByRole('button', { name: 'Entrar neste universo' })).toBeVisible();
});
