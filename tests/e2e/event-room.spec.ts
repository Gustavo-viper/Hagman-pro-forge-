import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

async function account(page: Page, request: APIRequestContext, prefix: string, role?: string) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-${prefix}-${stamp}@example.test`;
  const { accessToken } = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { username: `${prefix}_${stamp}`, displayName: `${prefix} ${stamp}`, birthdate: '1993-05-05', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  // Fixture only: production grants roles with BOOTSTRAP_SUPER_ADMIN_EMAILS / `cli.ts grant-role`.
  if (role) await db.query('INSERT INTO user_roles (user_id, role) SELECT id, $2 FROM users WHERE email = $1', [email, role]);
  await db.end();
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { stamp, name: `${prefix} ${stamp}` };
}

/** "YYYY-MM-DDTHH:mm" in the local timezone (browser and test runner share the machine). */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test('admin creates an event; registered fan chats live, plays the quiz night and sees the scoreboard; cancel notifies', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const adminCtx = await browser.newContext();
  const fanCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const fanPage = await fanCtx.newPage();
  const { stamp } = await account(admin, request, 'evadm', 'admin');
  const title = `Noite ${stamp}`;

  // 1. Admin creates an event starting in 10 minutes (the room opens 30 minutes before).
  await admin.goto('/admin');
  await admin.getByRole('button', { name: 'Novo evento' }).click();
  await admin.getByLabel('Universo', { exact: true }).selectOption('supernatural');
  await admin.getByLabel('Tipo').selectOption('tournament');
  await admin.getByLabel('Título (português)').fill(title);
  await admin.getByLabel('Descrição (português)').fill('Quiz ao vivo entre caçadores.');
  await admin.getByLabel('Início').fill(localInput(new Date(Date.now() + 10 * 60_000)));
  await admin.getByLabel('Fim').fill(localInput(new Date(Date.now() + 70 * 60_000)));
  await admin.getByLabel('Link da live/reunião (opcional)').fill('https://meet.example.com/noite');
  await admin.getByLabel('Quiz da noite (opcional)').selectOption({ label: 'Manual do caçador' });
  await admin.getByRole('button', { name: 'Criar evento' }).click();
  await expect(admin.getByRole('link', { name: title })).toBeVisible();

  // 2. The fan joins the universe, registers and enters the room.
  const fan = await account(fanPage, request, 'evfan');
  await fanPage.goto('/universes/supernatural');
  await fanPage.getByRole('button', { name: 'Entrar neste universo' }).click();
  await expect(fanPage.getByText('Você é membro deste universo')).toBeVisible();
  await fanPage.getByRole('tab', { name: 'Eventos' }).click();
  const card = fanPage.locator('.glass', { has: fanPage.getByRole('heading', { name: title }) });
  await expect(card.getByText('Quiz ao vivo', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Participar' }).click();
  await card.getByRole('link', { name: 'Entrar na sala' }).click();
  await expect(fanPage.getByRole('heading', { name: title })).toBeVisible();
  await expect(fanPage.getByText('Ao vivo', { exact: true })).toBeVisible();
  await expect(fanPage.getByRole('link', { name: 'Abrir transmissão ao vivo' })).toHaveAttribute('href', 'https://meet.example.com/noite');

  // 3. Admin (moderator) watches the room; the fan's message arrives in real time.
  await admin.getByRole('link', { name: title }).click();
  await expect(admin.getByText('Ao vivo', { exact: true })).toBeVisible();
  await fanPage.getByLabel('Escreva uma mensagem…').fill(`Olá caçadores ${stamp}!`);
  await fanPage.getByRole('button', { name: 'Enviar' }).click();
  await expect(fanPage.getByText(`Olá caçadores ${stamp}!`)).toBeVisible();
  await expect(admin.getByText(`Olá caçadores ${stamp}!`)).toBeVisible();

  // 4. The fan plays the quiz of the night; the scoreboard updates live for the admin.
  await expect(admin.getByText('Ninguém jogou ainda. Seja o primeiro!')).toBeVisible();
  await fanPage.getByRole('link', { name: 'Jogar o quiz da noite' }).click();
  for (let i = 0; i < 6; i++) {
    await expect(fanPage.getByText(`Pergunta ${i + 1} de 6`)).toBeVisible();
    await fanPage.getByRole('radio').first().click();
    if (i < 5) await fanPage.getByRole('button', { name: 'Próxima' }).click();
  }
  await fanPage.getByRole('button', { name: 'Ver resultado' }).click();
  await expect(admin.locator('ol').getByText(fan.name)).toBeVisible();
  await fanPage.getByRole('link', { name: 'Voltar para a sala do evento' }).click();
  await expect(fanPage.getByText('Placar ao vivo', { exact: true })).toBeVisible();
  await expect(fanPage.locator('ol').getByText(fan.name)).toBeVisible();

  // 5. Admin cancels; the open room flips to cancelled without a reload.
  await admin.goto('/admin');
  admin.once('dialog', (d) => void d.accept());
  const row = admin.locator('li', { has: admin.getByRole('link', { name: title }) });
  await row.getByRole('button', { name: 'Cancelar evento' }).click();
  await expect(row.getByText('Cancelado')).toBeVisible();
  await expect(fanPage.getByText('Este evento foi cancelado pela equipe.', { exact: false })).toBeVisible();

  await adminCtx.close();
  await fanCtx.close();
});
