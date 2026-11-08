import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3901';
const PASSWORD = 'Senha123forte';

async function signedIn(page: Page, request: APIRequestContext) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-lib-${stamp}@example.test`;
  const reg = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${reg.accessToken}` },
    data: { username: `lib_${stamp}`, displayName: `Leitor ${stamp}`, birthdate: '1995-05-05', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('sign-up teaches how to confirm the email, step by step', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  const email = `e2e-verify-${Date.now().toString(36)}@gmail.com`;
  await page.goto('/register');
  await expect(page.getByText('Como funciona a confirmação de e-mail')).toBeVisible();
  await expect(page.getByText('Enviamos na hora um link de confirmação (vale por 48 horas).')).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).last().click();

  await expect(page).toHaveURL(/\/confirm-email\?welcome=1$/);
  await expect(page.getByText('Conta criada! Bem-vindo ao Fandom Universe.')).toBeVisible();
  await expect(page.getByText(`Enviamos um link de confirmação para ${email}.`)).toBeVisible();
  await expect(page.getByText('Clique em “Confirmar e-mail”')).toBeVisible();
  // A Gmail address gets a shortcut that searches for our message.
  await expect(page.getByRole('link', { name: 'Abrir o Gmail' })).toHaveAttribute('href', /mail\.google\.com.*Fandom/);
  await page.getByText('Não encontrou o e-mail?').click();
  await expect(page.getByText(/Confira as pastas Spam ou Lixo eletrônico/)).toBeVisible();
  await expect(page.getByText(/Só o e-mail mais recente funciona/)).toBeVisible();

  await page.getByRole('button', { name: 'Reenviar e-mail' }).click();
  await expect(page.getByRole('button', { name: /Reenviar em \d+ s/ })).toBeDisabled();
  await expect(page.getByText('Enviamos um novo link. Use sempre o e-mail mais recente.')).toBeVisible();

  await page.getByRole('link', { name: 'Continuar e completar meu perfil' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('link', { name: 'Como confirmar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail em 3 passos' })).toBeVisible();
});

test('book library: real books per universe and a personal reading shelf', async ({ page, request }) => {
  await signedIn(page, request);
  await page.goto('/universes/marvel?tab=archive&section=books');
  await expect(page.getByRole('heading', { name: 'Guerra Civil' })).toBeVisible();
  await expect(page.getByText('Mark Millar e Steve McNiven · 2006–2007')).toBeVisible();
  await expect(page.getByText('Você leu 0 de 10 livros')).toBeVisible();

  const civilWar = page.getByRole('group', { name: 'Estante: Guerra Civil' });
  await civilWar.getByRole('button', { name: 'Lido' }).click();
  await expect(civilWar.getByRole('button', { name: 'Lido' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Você leu 1 de 10 livros')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Estante: Watchmen' })).toHaveCount(0); // a DC book, not in Marvel
  await page.getByRole('group', { name: 'Estante: Marvels' }).getByRole('button', { name: 'Quero ler' }).click();
  await expect(page.getByText('1 na lista · 0 lendo')).toBeVisible();

  await page.getByRole('radio', { name: 'Minha estante' }).click();
  await expect(page.getByRole('heading', { name: 'Guerra Civil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Desafio Infinito' })).toHaveCount(0);

  // Survives a reload (stored on the server).
  await page.reload();
  await expect(page.getByText('Você leu 1 de 10 livros')).toBeVisible();

  // Harry Potter: the seven books in the book section.
  await page.goto('/universes/harry-potter?tab=archive&section=books');
  await expect(page.getByRole('heading', { name: 'Harry Potter e as Relíquias da Morte' })).toBeVisible();
});

test('the Anime and Video Games universes are open, with identity, games and soundtrack', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/universes');
  await expect(page.getByRole('heading', { name: 'Animes', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();

  await page.locator('a[href="/universes/animes"]').first().click();
  await expect(page.getByRole('heading', { name: 'Animes', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shōnen' })).toBeVisible();
  await expect(page.getByTestId('universe-music')).toContainText('Céu de festival');
  await page.getByRole('tab', { name: 'Arquivo' }).click();
  await expect(page.getByRole('heading', { name: 'One Piece' }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Jogos e quizzes' }).click();
  await expect(page.getByRole('heading', { name: 'Otaku de carteirinha' })).toBeVisible();

  await page.goto('/universes/games');
  await expect(page.getByRole('heading', { name: 'Estrategista' })).toBeVisible();
  await page.getByRole('tab', { name: 'Arquivo' }).click();
  await page.getByRole('tab', { name: 'Livros' }).click();
  await expect(page.getByRole('heading', { name: 'O Último Desejo' })).toBeVisible();
});
