import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';

const API = 'http://localhost:3901';
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';
const PASSWORD = 'Senha123forte';

async function member(page: Page, request: APIRequestContext, universe: string) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-game-${stamp}@example.test`;
  const { accessToken } = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  const auth = { Authorization: `Bearer ${accessToken}` };
  await request.post(`${API}/v1/me/onboarding`, {
    headers: auth,
    data: { username: `game_${stamp}`, displayName: `Gamer ${stamp}`, birthdate: '1996-06-06', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  await request.post(`${API}/v1/universes/${universe}/membership`, { headers: auth });
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { name: `Gamer ${stamp}` };
}

async function sql<T extends pg.QueryResultRow>(text: string, params: unknown[]): Promise<T[]> {
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  try {
    return (await db.query<T>(text, params)).rows;
  } finally {
    await db.end();
  }
}

const card = (page: Page, title: string) => page.locator('div.glass').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();

test('daily challenge: answer the 5 questions once, see the review and today’s board', async ({ page, request }) => {
  const { name } = await member(page, request, 'marvel');
  await page.goto('/universes/marvel?tab=quizzes');
  await expect(page.getByRole('heading', { name: 'Jogos', exact: true })).toBeVisible();
  await expect(card(page, 'Desafio diário').getByText('Disponível hoje')).toBeVisible();
  await card(page, 'Desafio diário').getByRole('link', { name: 'Jogar' }).click();
  await expect(page.getByRole('heading', { name: 'Desafio diário', level: 1 })).toBeVisible();

  const groups = page.getByRole('radiogroup');
  await expect(groups).toHaveCount(5);
  const submit = page.getByRole('button', { name: 'Enviar respostas' });
  for (let i = 0; i < 5; i++) {
    await expect(submit).toBeDisabled();
    await groups.nth(i).getByRole('radio').first().click();
  }
  await submit.click();
  await expect(page.getByText('Seu resultado de hoje')).toBeVisible();
  await expect(page.getByText(/^\d\/5$/)).toBeVisible();
  await expect(page.getByText('1 dia seguido')).toBeVisible();
  await expect(submit).toHaveCount(0);

  await page.goto('/universes/marvel?tab=quizzes');
  await expect(card(page, 'Desafio diário').getByText(/Hoje: \d\/5/)).toBeVisible();
  await expect(page.getByRole('list').filter({ hasText: name })).toBeVisible();
});

test('speed round: answer every question before the clock ends and land on the board', async ({ page, request }) => {
  const { name } = await member(page, request, 'dc');
  await page.goto('/universes/dc/games/speed');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByText('0 acertos')).toBeVisible();
  // Answer with the right option a few times, reading it from the database (test oracle only).
  for (let i = 0; i < 4; i++) {
    const prompt = (await page.locator('h2').first().textContent())!.trim();
    const [q] = await sql<{ correct_key: string; options: { key: string; text: { 'pt-BR': string } }[] }>(
      `SELECT x.correct_key, x.options FROM questions x JOIN quizzes z ON z.id = x.quiz_id JOIN universes u ON u.id = z.universe_id
        WHERE u.slug = 'dc' AND x.prompt->>'pt-BR' = $1`, [prompt]);
    const text = q!.options.find((o) => o.key === q!.correct_key)!.text['pt-BR'];
    await page.getByRole('radio', { name: text, exact: true }).click();
    await expect(page.getByText(`${i + 1} ${i === 0 ? 'acerto' : 'acertos'}`, { exact: true })).toBeVisible();
    await expect(page.locator('h2').first()).not.toHaveText(prompt);
  }
  // Then run out the remaining questions (the round also ends when the pool is exhausted).
  while (await page.getByRole('heading', { name: 'Tempo esgotado' }).count() === 0 && await page.getByText('Tempo esgotado').count() === 0) {
    const radios = page.getByRole('radio');
    if (await radios.count() === 0) break;
    await radios.first().click();
    await page.waitForTimeout(550);
  }
  await expect(page.getByText('Tempo esgotado')).toBeVisible();
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
  await page.getByRole('link', { name: 'Ver placares' }).click();
  await page.getByRole('radio', { name: 'Relógio' }).click();
  await expect(page.getByRole('list').filter({ hasText: name })).toBeVisible();
});

test('hangman: play with the physical keyboard, win XP and resume an unfinished game', async ({ page, request }) => {
  const { name } = await member(page, request, 'star-wars');
  await page.goto('/universes/star-wars?tab=quizzes');
  await card(page, 'Forca do universo').getByRole('link', { name: 'Jogar' }).click();
  await page.getByRole('button', { name: 'Nova partida' }).click();
  await expect(page.getByText(/^Dica:/)).toBeVisible();
  await expect(page.getByLabel('6 vidas restantes')).toBeVisible();

  // One wrong letter first, then leave and come back: the game resumes where it was.
  const [row] = await sql<{ word: string }>(
    "SELECT state->>'word' AS word FROM game_sessions s JOIN profiles p ON p.user_id = s.user_id WHERE p.display_name = $1 AND s.status = 'active'", [name]);
  const word = row!.word;
  const letters = [...new Set([...word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()].filter((c) => /[A-Z]/.test(c)))];
  const wrong = [...'QZXJKWVYFBPGHMUDCLTNS'].find((l) => !letters.includes(l))!;
  await page.keyboard.press(wrong.toLowerCase());
  await expect(page.getByLabel('5 vidas restantes')).toBeVisible();
  await expect(page.getByRole('button', { name: `Letra ${wrong}` })).toBeDisabled();
  await page.goto('/universes/star-wars?tab=quizzes');
  await card(page, 'Forca do universo').getByRole('link', { name: 'Continuar partida' }).click();
  await expect(page.getByLabel('5 vidas restantes')).toBeVisible();

  for (const l of letters) {
    await page.keyboard.press(l.toLowerCase());
    await expect(page.getByRole('button', { name: `Letra ${l}` })).toBeDisabled();
  }
  await expect(page.getByText('Você acertou!')).toBeVisible();
  await expect(page.getByText('+15 XP')).toBeVisible();
  await expect(page.getByTestId('hangman-word')).toContainText(word!.replace(/\s/g, '').slice(0, 3), { ignoreCase: true });
  await page.getByRole('link', { name: 'Ver placares' }).click();
  await page.getByRole('radio', { name: 'Forca' }).click();
  await expect(page.getByRole('list').filter({ hasText: name })).toBeVisible();
});
