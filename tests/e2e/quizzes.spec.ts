import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:3901';
const PASSWORD = 'Senha123forte';

async function signedInFan(page: Page, request: import('@playwright/test').APIRequestContext) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-quiz-${stamp}@example.test`;
  const reg = await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } });
  const { accessToken } = await reg.json();
  await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { username: `quiz_${stamp}`, displayName: `Quizzer ${stamp}`, birthdate: '1997-03-03', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { stamp };
}

async function answerAll(page: Page, total: number, pick: (i: number) => number = () => 0) {
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(`Pergunta ${i + 1} de ${total}`)).toBeVisible();
    await page.getByRole('radio').nth(pick(i)).click();
    if (i < total - 1) await page.getByRole('button', { name: 'Próxima' }).click();
  }
  await page.getByRole('button', { name: 'Ver resultado' }).click();
}

test('join a universe, play its quiz, earn XP and appear in the ranking', async ({ page, request }) => {
  const { stamp } = await signedInFan(page, request);
  await page.goto('/universes/star-wars');
  await page.getByRole('button', { name: 'Entrar neste universo' }).click();
  await expect(page.getByText('Você é membro deste universo')).toBeVisible();

  // Choose a faction (manual identity).
  await page.getByRole('button', { name: /Jedi/ }).click();
  await expect(page.getByRole('button', { name: /Jedi/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Jogos e quizzes' }).click();
  await expect(page.getByRole('heading', { name: 'Academia Jedi' })).toBeVisible();
  await page.locator('div.glass').filter({ has: page.getByRole('heading', { name: 'Academia Jedi' }) }).last().getByRole('link', { name: 'Jogar' }).click();
  await answerAll(page, 6);
  await expect(page.getByText(/^\d\/6$/)).toBeVisible();
  await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible();
  await expect(page.getByText('Darth Vader é Anakin Skywalker, pai de Luke.')).toBeVisible();

  await page.getByRole('link', { name: 'Ver ranking' }).click();
  await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true');
  const row = page.getByRole('listitem').filter({ hasText: `Quizzer ${stamp}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Jedi');
});

test('Harry Potter sorting quiz assigns a house', async ({ page, request }) => {
  await signedInFan(page, request);
  await page.goto('/universes/harry-potter');
  await page.getByRole('button', { name: 'Entrar neste universo' }).click();
  await expect(page.getByText('Sua identidade aqui é definida pelo teste.')).toBeVisible();
  await page.getByRole('link', { name: 'Qual é a sua casa?' }).click();
  // Always pick the 2nd option: the result must be one of the four houses.
  await answerAll(page, 6, () => 1);
  await expect(page.getByText('Seu resultado')).toBeVisible();
  const house = (await page.locator('p.font-display.text-5xl').innerText()).trim();
  expect(['Grifinória', 'Sonserina', 'Corvinal', 'Lufa-Lufa']).toContain(house);
  await page.getByRole('link', { name: 'Ver minha identidade' }).click();
  await expect(page.getByRole('button', { name: new RegExp(house) })).toHaveAttribute('aria-pressed', 'true');
});
