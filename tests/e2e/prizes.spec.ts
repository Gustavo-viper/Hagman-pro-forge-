import { deflateSync, crc32 } from 'node:zlib';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
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

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Adult fan with a confirmed email and a complete profile (email confirmation is a fixture: no SMTP in E2E). */
async function fan(request: APIRequestContext, label: string, opts: { admin?: boolean } = {}) {
  const s = stamp();
  const email = `e2e-prize-${label}-${s}@example.test`;
  const name = `${label} ${s}`;
  const reg = await (await request.post(`${API}/v1/auth/register`, { data: { email, password: PASSWORD } })).json();
  const onboarding = await request.post(`${API}/v1/me/onboarding`, {
    headers: { Authorization: `Bearer ${reg.accessToken}` },
    data: { username: `pz_${s}`, displayName: name, birthdate: '1991-03-03', country: 'BR', locale: 'pt-BR', timezone: 'America/Sao_Paulo', acceptTerms: true, acceptPrivacy: true },
  });
  expect(onboarding.status()).toBe(201);
  await sql('UPDATE users SET email_verified = true WHERE email = $1', [email]);
  // Fixture admin (production uses BOOTSTRAP_SUPER_ADMIN_EMAILS / grant-role).
  if (opts.admin) await sql("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = $1", [email]);
  return { email, name, id: reg.user.id as string };
}

/** Each actor gets an isolated browser context, signed in through the real login form. */
async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeEditable();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

/** A real PNG (no image libraries in the E2E package): diagonal gradient, `w`×`h`. */
function png(w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = (x * 255) / w;
      raw[row + 2 + x * 3] = 60;
      raw[row + 3 + x * 3] = (y * 255) / h;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** `datetime-local` value in the browser's timezone, `minutes` from now. */
const localInput = async (page: Page, minutes: number) =>
  page.evaluate((m) => {
    const d = new Date(Date.now() + m * 60_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }, minutes);

async function openAdmin(page: Page) {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Concursos culturais' })).toBeVisible();
}

test('VIP plan is sold at R$ 79,90 and VIP draws only open with an authorization certificate', async ({ browser, request }) => {
  const admin = await fan(request, 'admin', { admin: true });
  const vip = await fan(request, 'vip');
  const free = await fan(request, 'free');

  // The VIP plan, monthly only, bought through the real checkout (fake InfinitePay in E2E).
  const vipPage = await signIn(browser, vip.email);
  await vipPage.goto('/premium');
  const vipCard = vipPage.locator('div.glass', { has: vipPage.getByRole('heading', { name: 'Fandom VIP', exact: true }) });
  await expect(vipCard.getByText(/R\$\s79,90/)).toBeVisible();
  await expect(vipCard.getByText('Número da sorte nos sorteios de chaves Steam', { exact: false })).toBeVisible();
  await vipPage.getByRole('radio', { name: 'Anual' }).click();
  await expect(vipCard.getByText('Disponível só no plano mensal.')).toBeVisible();
  await expect(vipCard.getByText(/R\$\s79,90/)).toBeVisible();
  await vipCard.getByRole('button', { name: 'Assinar agora' }).click();
  await expect(vipPage).toHaveURL(/\/account\/subscription/);
  await expect(vipPage.getByText('Pagamento confirmado! Seus benefícios já estão liberados.')).toBeVisible();
  await expect(vipPage.getByText('Fandom VIP', { exact: true })).toBeVisible();
  await expect(vipPage.getByRole('cell', { name: /R\$\s79,90 · Pix/ })).toBeVisible();

  // Admin: a draft cannot open without the certificate and the rules.
  const adminPage = await signIn(browser, admin.email);
  await openAdmin(adminPage);
  await expect(adminPage.getByText('exigem autorização prévia da Secretaria de Prêmios e Apostas', { exact: false })).toBeVisible();
  const title = `Sorteio de chave Steam ${stamp()}`;
  const form = adminPage.getByRole('form', { name: 'Novo sorteio' });
  await form.getByLabel('Título').fill(title);
  await form.getByLabel('Descrição').fill('Uma chave Steam de jogo aleatório para assinantes VIP.');
  await form.getByLabel('Inscrições até').fill(await localInput(adminPage, 120));
  await form.getByRole('button', { name: 'Salvar rascunho' }).click();
  const row = adminPage.locator('li.glass', { hasText: title });
  await expect(row.getByText('Rascunho')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Abrir inscrições' })).toBeDisabled();
  const [draft] = await sql<{ id: string }>("SELECT id FROM draws WHERE title->>'pt-BR' = $1", [title]);
  // The API enforces the lock too, not only the disabled button.
  const adminToken = (await (await request.post(`${API}/v1/auth/login`, { data: { email: admin.email, password: PASSWORD } })).json()).accessToken;
  const forced = await request.post(`${API}/v1/admin/draws/${draft!.id}/open`, { headers: { Authorization: `Bearer ${adminToken}` } });
  expect(forced.status()).toBe(409);
  expect((await forced.json()).code).toBe('authorization_required');
  // Drafts are not public.
  expect((await request.get(`${API}/v1/draws/${draft!.id}`)).status()).toBe(404);

  await row.getByLabel('Nº do certificado de autorização').fill('SPA/MF 04.012345/2026');
  await row.getByLabel('Link do regulamento (https)').fill('https://forgestudios.example/regulamento-steam.pdf');
  await row.getByRole('button', { name: 'Salvar autorização' }).click();
  await expect(row.getByRole('button', { name: 'Abrir inscrições' })).toBeEnabled();
  await row.getByRole('button', { name: 'Abrir inscrições' }).click();
  await expect(row.getByText('Aberto', { exact: true })).toBeVisible();

  // Free fan: sees the draw, the certificate and an honest lock.
  const freePage = await signIn(browser, free.email);
  await freePage.getByRole('link', { name: 'Prêmios' }).filter({ visible: true }).first().click();
  await expect(freePage).toHaveURL(/\/premios$/);
  await freePage.getByRole('link', { name: new RegExp(title) }).click();
  await expect(freePage).toHaveURL(new RegExp(`/sorteios/${draft!.id}$`));
  await expect(freePage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(freePage.getByText('Certificado de Autorização SPA/MF nº SPA/MF 04.012345/2026')).toBeVisible();
  await expect(freePage.getByRole('link', { name: 'Ler o regulamento' })).toHaveAttribute('href', 'https://forgestudios.example/regulamento-steam.pdf');
  await expect(freePage.getByText('Os sorteios são exclusivos para assinantes do Fandom VIP.')).toBeVisible();
  await expect(freePage.getByRole('link', { name: 'Assinar o VIP' })).toHaveAttribute('href', '/premium');
  await expect(freePage.getByRole('button', { name: 'Pegar meu número da sorte' })).toHaveCount(0);

  // VIP: gets lucky number 00001.
  await vipPage.goto(`/sorteios/${draft!.id}`);
  await vipPage.getByRole('button', { name: 'Pegar meu número da sorte' }).click();
  await expect(vipPage.getByText('Seu número da sorte')).toBeVisible();
  await expect(vipPage.getByText('00001')).toBeVisible();
  await vipPage.goto('/premios');
  await expect(vipPage.getByText('Nº 1', { exact: true })).toBeVisible();

  // Entries close; the admin runs the draw with a public external value.
  await sql("UPDATE draws SET entries_close_at = now() - interval '1 minute' WHERE id = $1", [draft!.id]);
  await adminPage.reload();
  await expect(row.getByText('Aguardando apuração')).toBeVisible();
  await row.getByLabel('Valor externo', { exact: false }).fill('Loteria Federal 06012 · 1º prêmio 48213');
  adminPage.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Realizar sorteio' }).click();
  await expect(row.getByText(`1º · ${vip.name} · ${vip.email} · nº 1`)).toBeVisible();
  await row.getByLabel('Chave Steam').fill('ABCDE-FGHIJ-KLMNO');
  await row.getByRole('button', { name: 'Entregar' }).click();
  await expect(row.getByText('Entregue')).toBeVisible();
  // Stored sealed, never in clear text.
  const [stored] = await sql<{ code_sealed: string }>("SELECT code_sealed FROM prizes WHERE source = 'draw' AND source_id = $1", [draft!.id]);
  expect(stored!.code_sealed).toMatch(/^v1:/);
  expect(stored!.code_sealed).not.toContain('ABCDE');

  // Public, verifiable result, and the key in the winner's prizes.
  await vipPage.goto(`/sorteios/${draft!.id}`);
  await expect(vipPage.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  await expect(vipPage.getByText(`1º · ${vip.name}`)).toBeVisible();
  await vipPage.getByText('Como conferir o resultado').click();
  await expect(vipPage.getByText('Loteria Federal 06012 · 1º prêmio 48213')).toBeVisible();
  await vipPage.goto('/premios');
  await expect(vipPage.getByLabel('Código do prêmio')).toHaveText('ABCDE-FGHIJ-KLMNO');
});

test('free cultural wallpaper contest: upload, moderation, community vote and a Crunchyroll gift code for the winner', async ({ browser, request }) => {
  const admin = await fan(request, 'jury', { admin: true });
  const artist = await fan(request, 'artist');
  const voter = await fan(request, 'voter');

  const adminPage = await signIn(browser, admin.email);
  await openAdmin(adminPage);
  const slug = `wallpaper-${stamp()}`;
  const title = `Wallpaper Animes ${slug}`;
  const form = adminPage.getByRole('form', { name: 'Novo concurso' });
  await form.getByLabel('Endereço (slug)').fill(slug);
  await form.getByLabel('Título').fill(title);
  await form.getByLabel('Descrição').fill('Crie um papel de parede original inspirado no universo dos animes.');
  await form.getByLabel('Regulamento').fill('1. Arte original.\n2. Voto da comunidade e decisão final do júri.\n3. Prêmio: 1 mês de Crunchyroll.');
  await expect(form.getByLabel('Prêmio')).toHaveValue('1 mês de Crunchyroll (vale-presente)');
  await form.getByLabel('Inscrições a partir de').fill(await localInput(adminPage, -60));
  await form.getByLabel('Inscrições até').fill(await localInput(adminPage, 60));
  await form.getByLabel('Votação até').fill(await localInput(adminPage, 120));
  await form.getByRole('button', { name: 'Salvar rascunho' }).click();
  const row = adminPage.locator('li.glass', { hasText: title });
  await row.getByRole('button', { name: 'Publicar' }).click();
  await expect(row.getByText('Inscrições abertas')).toBeVisible();

  // Artist: free entry, image re-processed by the server, waits for moderation.
  const artistPage = await signIn(browser, artist.email);
  await artistPage.goto('/premios');
  await artistPage.getByRole('link', { name: new RegExp(title) }).click();
  await expect(artistPage).toHaveURL(new RegExp(`/concursos/${slug}$`));
  await expect(artistPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(artistPage.getByText('Inscrição grátis')).toBeVisible();
  await expect(artistPage.getByText('não há patrocínio nem parceria oficial', { exact: false })).toBeVisible();
  const submit = artistPage.getByRole('form', { name: 'Enviar papel de parede' });
  await submit.getByLabel('Imagem (JPG, PNG ou WebP)').setInputFiles({ name: 'pequena.png', mimeType: 'image/png', buffer: png(640, 360) });
  await submit.getByLabel('Título').fill('Céu de Tóquio');
  await submit.getByRole('checkbox').check();
  await submit.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(submit.getByRole('alert')).toHaveText('A imagem precisa ter pelo menos 1080×720 pixels.');
  await submit.getByLabel('Imagem (JPG, PNG ou WebP)').setInputFiles({ name: 'ceu.png', mimeType: 'image/png', buffer: png(1280, 800) });
  await expect(submit.getByRole('img', { name: 'Prévia' })).toBeVisible();
  await submit.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(artistPage.getByText('Em análise pela moderação.')).toBeVisible();
  await expect(artistPage.getByText('Ainda não há artes aprovadas.')).toBeVisible();

  // Moderation in the admin.
  await adminPage.reload();
  await expect(row.getByText('1 inscrição aguardando moderação')).toBeVisible();
  await row.getByRole('button', { name: 'Aprovar' }).click();
  await expect(row.getByText('1 inscrição aguardando moderação')).toHaveCount(0);

  // Voting phase: the voter sees the artwork (cross-origin image from the API) and votes.
  await sql("UPDATE contests SET submissions_close_at = now() - interval '1 minute' WHERE slug = $1", [slug]);
  const voterPage = await signIn(browser, voter.email);
  await voterPage.goto(`/concursos/${slug}`);
  await expect(voterPage.getByText('Votação aberta')).toBeVisible();
  const art = voterPage.getByRole('img', { name: 'Céu de Tóquio' });
  await expect(art).toBeVisible();
  await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(640);
  await expect(voterPage.getByText('votos', { exact: false })).toHaveCount(0); // counts stay hidden while voting
  await voterPage.getByRole('button', { name: 'Votar' }).click();
  await expect(voterPage.getByRole('button', { name: 'Seu voto' })).toHaveAttribute('aria-pressed', 'true');
  // No vote button on one's own artwork.
  await artistPage.reload();
  await expect(artistPage.getByText('Aprovada e visível na galeria.')).toBeVisible();
  await expect(artistPage.getByRole('button', { name: 'Votar' })).toHaveCount(0);

  // Judging: the jury declares the winner and delivers the gift code.
  await sql("UPDATE contests SET voting_close_at = now() - interval '1 second' WHERE slug = $1", [slug]);
  await adminPage.reload();
  await expect(row.getByText('Em julgamento')).toBeVisible();
  await expect(row.getByText('1 voto', { exact: true })).toBeVisible();
  adminPage.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Declarar vencedor' }).click();
  await expect(row.getByText(`Vencedor: “Céu de Tóquio”, de ${artist.name}`)).toBeVisible();
  await row.getByLabel('Código do vale').fill('CRUNCHY-1MES-0001');
  await row.getByRole('button', { name: 'Entregar' }).click();
  await expect(row.getByText('Entregue')).toBeVisible();

  await artistPage.goto(`/concursos/${slug}`);
  await expect(artistPage.getByText(`Vencedor: “Céu de Tóquio”, de ${artist.name}`)).toBeVisible();
  await expect(artistPage.getByText('1 voto', { exact: true })).toBeVisible();
  await artistPage.goto('/premios');
  await expect(artistPage.getByLabel('Código do prêmio')).toHaveText('CRUNCHY-1MES-0001');
});
