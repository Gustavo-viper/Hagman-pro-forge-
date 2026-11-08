import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

async function sql<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  try {
    return (await db.query<T>(text, params)).rows;
  } finally {
    await db.end();
  }
}

/** Fan of a universe, optionally with a plan granted through the real admin endpoint. */
async function fan(page: Page, request: APIRequestContext, universe: string, plan?: 'plus' | 'ultra') {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-perk-${stamp}@example.test`;
  const name = `${plan ?? 'free'} ${stamp}`;
  const reg = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  const auth = { Authorization: `Bearer ${reg.accessToken}` };
  await request.post(`${API}/v1/me/onboarding`, {
    headers: auth,
    data: { username: `perk_${stamp}`, displayName: name, birthdate: '1992-02-02', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  await request.post(`${API}/v1/universes/${universe}/membership`, { headers: auth });
  await sql('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  if (plan) {
    // Fixture admin (production uses BOOTSTRAP_SUPER_ADMIN_EMAILS / grant-role), then the real grant endpoint.
    const adminEmail = `e2e-perk-admin-${stamp}@example.test`;
    await request.post(`${API}/v1/auth/register`, { data: { email: adminEmail, password: PASSWORD } });
    await sql("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = $1", [adminEmail]);
    const admin = await (await request.post(`${API}/v1/auth/login`, { data: { email: adminEmail, password: PASSWORD } })).json();
    const grant = await request.post(`${API}/v1/admin/users/${reg.user.id}/grant-plan`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { planCode: plan, days: 30, reason: 'teste de vantagens' },
    });
    expect(grant.status()).toBe(200);
  }
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { name };
}

/** Answers the open quiz correctly (the database is the test oracle). */
async function playQuizPerfectly(page: Page) {
  const quizId = page.url().split('/').pop()!.split('?')[0]!;
  const keys = await sql<{ correct_key: string; options: { key: string; text: { 'pt-BR': string } }[] }>('SELECT correct_key, options FROM questions WHERE quiz_id = $1 ORDER BY position', [quizId]);
  for (let i = 0; i < keys.length; i++) {
    const right = keys[i]!.options.find((o) => o.key === keys[i]!.correct_key)!.text['pt-BR'];
    await page.getByRole('radio', { name: right, exact: true }).click();
    if (i < keys.length - 1) await page.getByRole('button', { name: 'Próxima' }).click();
  }
  await page.getByRole('button', { name: 'Ver resultado' }).click();
}

const card = (page: Page, title: string) => page.locator('div.glass').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();

test('plans page compares Free, Plus and Ultra with the real limits', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/premium');
  const table = page.getByRole('table');
  await expect(page.getByRole('heading', { name: 'Compare os planos' })).toBeVisible();
  await expect(table.getByRole('row', { name: /Bônus de XP/ })).toContainText('+20%');
  await expect(table.getByRole('row', { name: /Bônus de XP/ })).toContainText('+50%');
  await expect(table.getByRole('row', { name: /contra o relógio/ })).toContainText('200 XP');
  await expect(page.getByText('um quiz perfeito que vale 60 XP rende 72 XP no Plus e 90 XP no Ultra', { exact: false })).toBeVisible();
  await expect(page.getByText('+20% de XP em quizzes, jogos e missões')).toBeVisible();
});

test('Free fans see what Premium unlocks: survival, premium missions, VIP lounge and the XP they would earn', async ({ page, request }) => {
  await fan(page, request, 'harry-potter');
  await page.goto('/universes/harry-potter?tab=quizzes');
  const survival = card(page, 'Modo Sobrevivência');
  await expect(survival.getByText('Exclusivo Plus')).toBeVisible();
  await expect(survival.getByRole('link', { name: 'Desbloquear com o Fandom Plus' })).toHaveAttribute('href', '/premium');
  await expect(card(page, 'Contra o relógio').getByText('Com o Plus: 120 XP por dia')).toBeVisible();

  // Upsell after earning XP in a quiz.
  await card(page, 'Conhecimentos do mundo bruxo').getByRole('link', { name: 'Jogar' }).click();
  await playQuizPerfectly(page);
  await expect(page.getByText('+60 XP', { exact: true })).toBeVisible();
  await expect(page.getByText('Com o Fandom Plus você ganharia +12 XP extras aqui (+20%).')).toBeVisible();

  await page.goto('/universes/harry-potter/games/survival');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByText('O Modo Sobrevivência é exclusivo para assinantes')).toBeVisible();

  await page.goto('/universes/harry-potter?tab=missions');
  await expect(card(page, 'Lenda Ultra').getByRole('link', { name: 'Desbloquear com o Fandom Ultra' })).toBeVisible();
  await expect(card(page, 'Maratona Plus').getByRole('link', { name: 'Desbloquear com o Fandom Plus' })).toBeVisible();

  await page.goto('/universes/harry-potter?tab=community&section=vip_lounge');
  await expect(page.getByText('Sala VIP: o espaço dos assinantes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo tópico' })).toHaveCount(0);
});

test('Plus subscribers get bonus XP, play survival and post in the VIP lounge with their badge', async ({ page, request }) => {
  const { name } = await fan(page, request, 'star-wars', 'plus');
  await page.goto('/universes/star-wars?tab=quizzes');
  await expect(page.getByText('Bônus de XP ativo: +20%')).toBeVisible();

  // Perfect quiz: 60 XP + 12 XP Plus bonus.
  await card(page, 'Academia Jedi').getByRole('link', { name: 'Jogar' }).click();
  await playQuizPerfectly(page);
  await expect(page.getByText('+60 XP', { exact: true })).toBeVisible();
  await expect(page.getByText('+12 XP bônus Fandom Plus')).toBeVisible();

  // Survival: miss on purpose after one right answer.
  await page.goto('/universes/star-wars/games/survival');
  await page.getByRole('button', { name: 'Começar' }).click();
  for (const right of [true, false]) {
    const prompt = (await page.locator('h2').first().textContent())!.trim();
    const [q] = await sql<{ correct_key: string; options: { key: string; text: { 'pt-BR': string } }[] }>(
      `SELECT x.correct_key, x.options FROM questions x JOIN quizzes z ON z.id = x.quiz_id JOIN universes u ON u.id = z.universe_id
        WHERE u.slug = 'star-wars' AND x.prompt->>'pt-BR' = $1`, [prompt]);
    const option = q!.options.find((o) => (o.key === q!.correct_key) === right)!.text['pt-BR'];
    await page.getByRole('radio', { name: option, exact: true }).click();
    if (right) await expect(page.locator('h2').first()).not.toHaveText(prompt);
  }
  await expect(page.getByText('Fim da sequência')).toBeVisible();
  await expect(page.getByText('1 acerto seguido')).toBeVisible();

  // VIP lounge with the Plus badge next to the name.
  await page.goto('/universes/star-wars?tab=community&section=vip_lounge');
  await expect(page.getByText('Você está na Sala VIP')).toBeVisible();
  await page.getByRole('button', { name: 'Novo tópico' }).click();
  await page.getByLabel('Título').fill('Encontro dos assinantes');
  await page.getByLabel('Mensagem').fill('Que a Força esteja com a Sala VIP.');
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('heading', { name: 'Encontro dos assinantes' })).toBeVisible();
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.locator('span[title="Fandom Plus"]').first()).toBeVisible();
});
