import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

/** Verified, onboarded fan signed in through the UI. */
async function fan(page: Page, request: APIRequestContext) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-sec-${stamp}@example.test`;
  const { accessToken } = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { username: `sec_${stamp}`, displayName: `Fã ${stamp}`, birthdate: '1994-04-04', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  await db.end();
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { stamp };
}

async function join(page: Page, slug: string) {
  await page.goto(`/universes/${slug}`);
  await page.getByRole('button', { name: 'Entrar neste universo' }).click();
  await expect(page.getByText('Você é membro deste universo')).toBeVisible();
}

test('archive sections are browsable in every universe tab', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/universes/harry-potter');
  await page.getByRole('tab', { name: 'Arquivo' }).click();
  await expect(page.getByRole('heading', { name: 'Harry Potter e a Pedra Filosofal' })).toBeVisible();
  await page.getByRole('tab', { name: 'Feitiços' }).click();
  await expect(page.getByRole('heading', { name: 'Expelliarmus' })).toBeVisible();
  await page.goto('/universes/star-wars?tab=archive&section=starship_archive');
  await expect(page.getByRole('heading', { name: 'Millennium Falcon' })).toBeVisible();
  // Feature chips on the overview jump straight to their section.
  await page.goto('/universes/bts');
  await page.getByRole('button', { name: /Discografia/ }).click();
  await expect(page.getByRole('heading', { name: 'Dynamite' })).toBeVisible();
});

test('community: create a theory, reply and see it listed', async ({ page, request }) => {
  const { stamp } = await fan(page, request);
  await join(page, 'supernatural');
  await page.getByRole('tab', { name: 'Comunidade' }).click();
  await page.getByRole('tab', { name: 'Teorias' }).click();
  await page.getByRole('button', { name: 'Novo tópico' }).click();
  await page.getByLabel('Título').fill(`Teoria ${stamp}`);
  await page.getByLabel('Mensagem').fill('<b>negrito?</b> O Impala tem alma.');
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('heading', { name: `Teoria ${stamp}` })).toBeVisible();
  await expect(page.getByText('<b>negrito?</b> O Impala tem alma.')).toBeVisible(); // escaped, not rendered as HTML
  await page.getByLabel('Sua resposta').fill('Concordo totalmente!');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByText('Concordo totalmente!')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 resposta' })).toBeVisible();
  await page.getByRole('link', { name: /Supernatural · Teorias/ }).click();
  await expect(page.getByRole('link', { name: new RegExp(`Teoria ${stamp}`) })).toBeVisible();
});

test('missions and events: claim a mission, join an event, premium room is locked', async ({ page, request }) => {
  await fan(page, request);
  await join(page, 'star-wars');
  await page.getByRole('button', { name: /Rebelde/ }).click();
  await expect(page.getByRole('button', { name: /Rebelde/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Missões' }).click();
  const oath = page.locator('div.glass', { has: page.getByRole('heading', { name: 'Juramento à facção' }) });
  await oath.getByRole('button', { name: 'Resgatar recompensa' }).click();
  await expect(page.getByText('Missão concluída! +15 XP')).toBeVisible();
  await expect(oath.getByText('Concluída')).toBeVisible();

  await page.getByRole('tab', { name: 'Eventos' }).click();
  const quizNight = page.locator('div.glass', { has: page.getByRole('heading', { name: 'Noite de quiz Star Wars' }) });
  await quizNight.getByRole('button', { name: 'Participar' }).click();
  await expect(quizNight.getByText('Inscrito')).toBeVisible();
  const premium = page.locator('div.glass', { has: page.getByRole('heading', { name: 'Sala exclusiva Premium' }) });
  await premium.getByRole('button', { name: 'Participar' }).click();
  await expect(premium.getByText('Este evento é exclusivo para assinantes Fandom Premium.')).toBeVisible();
});

test('Harry Potter ranking tab shows the house cup', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/universes/harry-potter?tab=ranking');
  await expect(page.getByRole('heading', { name: 'Competição entre casas' })).toBeVisible();
  for (const h of ['Grifinória', 'Sonserina', 'Corvinal', 'Lufa-Lufa']) await expect(page.getByText(new RegExp(`\\d\\. ${h}`))).toBeVisible();
});
